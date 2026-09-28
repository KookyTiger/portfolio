#!/usr/bin/env python3
"""Paint the back of Kay's tiger: Tripo gave it an orange, striped front and a plain beige back, and the back is what visitors see while
it climbs. The texture is a scattered atlas of small patches, so nothing is painted in image space: every texel is mapped back to its
3D point on the model (bind pose, from the GLB), the colours and stripes are defined in 3D (so they run on across patch seams), and
only the beige, back-facing, non-paw texels are recoloured. The texture's own light and shade is kept (the new orange follows its value).

  node merge/tools/tiger_tex.mjs extract assets/tiger/tiger.glb /tmp/tt          # → /tmp/tt/mesh.json (+ the current texture)
  python3 merge/tools/tiger_paint.py /tmp/tt/mesh.json assets/src/tiger/tiger-mixamo-tex/tiger_basecolor.jpg painted.png \
      [--size 2048] [--config pattern.json] [--debug regions.png]
  node merge/tools/tiger_tex.mjs swap assets/tiger/tiger.glb painted.png assets/tiger/tiger.glb

The texture input is always Tripo's original (assets/src/tiger/tiger-mixamo-tex/tiger_basecolor.jpg, 4096 px, kept locally and
gitignored; or the texture of the unpainted GLB in git history, commit 96e87df), never the texture of the painted GLB: the painter
refuses a source whose back is already orange.

Model frame (mesh.json, bind pose): Y up, the tiger faces +Z, T-pose (arms along ±X), about 0.86 tall.

The pattern follows the Sketchfab "Cartoon Tiger" Kay started from, seen from behind: four "^" strokes down the back (fat and peaked at
the spine, pointed at the sides) and a "Λ" over the tail; on the back of the head a shallow "^" across the crown between the ears, a
tall "Λ" under it, three slanted strokes on each side and a thick "^" at the nape; three short ticks over the top of each arm; an
orange tail with dark rings and a dark tip. Each stripe is a brush stroke: a centre line (Catmull-Rom through a few points, or straight
segments for a peaked "^") and a width profile along it (fat body, pointed ends), with a slightly ragged edge and a little waviness,
all from smooth 3D noise so a stroke runs on unbroken across the atlas' patch seams. Strokes for the torso and the head are authored
in the orthographic view from behind (x, y in model units, as the reference shows them) and mapped onto the surface through the
back-most texel under each point, then drawn in a chart where distance is surface distance (torso: arc around the body × height;
head: sinusoidal projection around the head centre). Mirrored strokes are jittered a little so the two sides are not identical.

Tripo cut its side stripes off where its front projection ended (blunt, sometimes ragged ends at about ±100° from the spine, on the
flanks, the legs and over the top of the arms). `continue` finds those cut ends in the texture and carries each stripe on toward the
back as a stroke that tapers to a point, so the front's stripes end like brush strokes and hand over to the back's pattern.

Also (2026-09-28, picked from three designs by two judges): the front's low side stroke and its calf stroke run on round the hips and
the backs of the legs; the back of the head warms toward the body's orange; the ink follows the texture's baked shading like Tripo's;
the cheek ruffs are found by shape (tufts standing out of the head's sphere) and kept exactly as Tripo painted them; the rasteriser is
conservative (island rims and slivers take the nearest triangle, so no seam fringes). Check with merge/tools/tiger-turntable.js.

The pattern (strokes, widths, profiles, colours) lives in DEFAULT below; --config overrides any key (deep merge). Deterministic (seeded)."""
import argparse, copy, json, math, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import cKDTree

# stroke: p = points (back view x, y for torso/head; chart units for arm/leg), w = full width at its widest (model units),
#         shape = [peak position along the stroke 0..1, m, k]: width = w * (1 - u^m)^k, u = 0 at the peak → 1 at either end
#         (m 1, k 1: a triangle; m 2, k .6: a fat body with pointed ends), mirror = also draw it mirrored (x → -x), smooth = spline or straight
def S(p, w, shape=(0.5, 2.0, 0.7), mirror=True, smooth=True): return {'p': p, 'w': w, 'shape': list(shape), 'mirror': mirror, 'smooth': smooth}

DEFAULT = {
    'seed': 7,
    # colours: None = sampled from the front of the model (median of the painted orange / the dark stripe texels there)
    'orange': {'head': None, 'torso': None, 'limb': None},
    'dark': None,
    'gain': [0.82, 1.1],                    # the new orange follows the texture's value (its baked light and shade), within these bounds
    'beige': {'sat': [0.52, 0.36], 'val': [0.42, 0.58]},   # which texels count as "plain beige": saturation falling / value rising over these
    'white': [0.25, 0.16],                  # head: texels whiter than this (saturation falling) are the cheek ruff, kept white
    'protect': [0.2, 0.4],                  # n.z over which the front is restored to the original texture (see the end of paint())
    'clean': True,                          # repaint stray dark blotches deep inside the back
    'ears': {'thick': [0.113, 0.103], 'back': [0.15, -0.05], 'rough': [0.006, 0.0025]},   # ear lobes (thin parts of the head): their backs dark brown;
                                            # thickness front-to-back (model units) where a lobe starts, n.z range over which the back fades in
                                            # (the lobe's back half, behind its mid-plane, is dark up to n.z .15 so its top rim has no light band)
    'arm_grade': [-10, 95],                 # arms: the back's colour runs from the torso's (under the arm) to the front's top colour over psi (degrees)
    'grade': True,                          # the torso's orange follows the front's sides by height, the head's by latitude
    'hip_lift': [0.5, 0.30, 0.16],         # ... but below the waist only partly: this much of the upper back's orange, faded in from y .30 to .16
                                            # (the reference's back is one even orange; the front's deep hip orange × the baked shade read brown)
    'edge': 0.0011,                         # stroke edge softness, model units (the tiger is ~0.86 tall)
    'rough': {'lo': 0.16, 'mid': 0.0013, 'hi': 0.0009},   # brushy edges: width swell (fraction, slow noise) + scallops + fine ragged edge (model units)
    'warp': 0.0030,                         # slow waviness of every stroke, model units
    'ink': 0.10,                            # value variation inside the strokes
    'jitter': 0.0022,                       # mirrored strokes: control points moved by about this much so the two sides differ a little
    'band_jitter': 0.004,                   # back bands: the two halves of each '^' shifted apart by about this much (not machine-symmetric)
    'ink_shade': 0.7,                       # the stripes' ink follows the texture's baked light and shade this much, like Tripo's (0 = flat)
    'head_warm': 0.3,                       # the back of the head leans this much toward the body's orange (the reference's head is orange)
    'ruff': True,                           # the cream cheek ruffs (tufts standing out behind the cheeks) stay exactly as Tripo painted them
    'torso': {                              # back of the body; strokes in the back view (x, y); the Λ straddles the tail's root
        'phi': [78, 125], 'R': 0.15,        # back region: fully painted within ±78° of the spine, faded out by ±125°; chart radius
                                            # (only beige texels are ever recoloured, so the fade can reach past the side into the front's orange)
        'strokes': [],                      # brush strokes (back view x, y), none: the back's stripes are bands
        # strokes drawn straight in the torso chart (arc around the body from the spine = 0.15 × radians, height y): the hips, where the
        # front's low side stroke (its tip at about 109°, y .14) runs on round the back and tapers out beside the tail
        'chart_strokes': [S([[0.285, 0.140], [0.225, 0.162], [0.165, 0.178], [0.112, 0.184]], 0.025, (0.28, 1.6, 0.9))],
        # bands: a stripe between a top and a bottom edge, both given over phi (degrees from the spine) → y; where the edges meet the
        # stripe ends in a point. The reference's back stripes are "^" mountains: a peaked top edge, a flatter bottom edge.
        'bands': [
            {'top': [[-40, 0.422], [-20, 0.443], [0, 0.467], [20, 0.444], [40, 0.423]], 'bot': [[-40, 0.422], [-20, 0.427], [0, 0.432], [20, 0.428], [40, 0.423]]},
            {'top': [[-54, 0.366], [-27, 0.388], [0, 0.412], [27, 0.389], [54, 0.367]], 'bot': [[-54, 0.366], [-27, 0.373], [0, 0.380], [27, 0.374], [54, 0.367]]},
            {'top': [[-60, 0.303], [-30, 0.332], [0, 0.360], [30, 0.333], [60, 0.304]], 'bot': [[-60, 0.303], [-30, 0.318], [0, 0.330], [30, 0.319], [60, 0.304]]},
            {'top': [[-45, 0.214], [-22, 0.270], [0, 0.313], [22, 0.271], [45, 0.215]], 'bot': [[-45, 0.214], [-22, 0.253], [0, 0.280], [22, 0.254], [45, 0.215]]},   # Λ over the tail
        ],
    },
    'head': {                               # back of the head; strokes in the back view (x, y)
        'centre': [0.0, 0.672, 0.060], 'R': 0.195,
        'dz': [0.10, -0.12],                # back region: direction.z from the head centre (fades in between)
        'strokes': [
            S([[-0.090, 0.776], [-0.046, 0.806], [-0.002, 0.826], [0.042, 0.808], [0.087, 0.778]], 0.016, (0.5, 2.4, 0.55), mirror=False),  # crown ^
            S([[-0.001, 0.772], [-0.021, 0.721], [-0.047, 0.650]], 0.021, (0.1, 1.5, 0.7), mirror=False),    # central Λ, left leg
            S([[0.001, 0.772], [0.019, 0.716], [0.045, 0.647]], 0.021, (0.1, 1.5, 0.7), mirror=False),       # central Λ, right leg
            S([[-0.042, 0.756], [-0.090, 0.723], [-0.146, 0.679]], 0.021, (0.6, 2.4, 0.5)),                 # sides, upper
            S([[-0.070, 0.664], [-0.112, 0.627], [-0.156, 0.589]], 0.019, (0.6, 2.4, 0.5)),                 # sides, middle
            S([[-0.080, 0.574], [-0.108, 0.558], [-0.138, 0.542]], 0.017, (0.55, 2.2, 0.55)),               # sides, lower
            S([[-0.070, 0.556], [-0.002, 0.628], [0.067, 0.556]], 0.030, (0.5, 1.1, 0.8), mirror=False, smooth=False),  # nape ^
        ],
    },
    'arm': {'psi': [85, 120], 'R': 0.062, 'strokes': []},     # rings on the arms: chart (|x|, psi°: 0 = back, 90 = top), both arms
    'leg': {'phi': [95, 140], 'R': 0.06,                      # legs: chart (0.06 × radians around the leg, + = outward; y); recoloured round to the side
            'strokes': [S([[0.0864, 0.071], [0.048, 0.078], [0.006, 0.082], [-0.030, 0.083]], 0.020, (0.28, 1.6, 0.9), mirror=False)]},   # the front's calf stroke, round the back
    'continue': {                           # carry the front's cut-off stripes on toward the back, tapering to a point
        'torso': {'range': [84, 135], 'len': 26, 'min_w': 0.006},        # |phi| where the cut ends are sought, extension length in degrees
        'leg': {'range': [80, 150], 'len': 38, 'min_w': 0.006},
        'arm': {'range': [70, 150], 'len': 50, 'min_w': 0.006},
    },
    'tail': {'z0': -0.150, 'axis': [[0.194, -0.150], [0.190, -0.186], [0.203, -0.220], [0.221, -0.253], [0.239, -0.277], [0.254, -0.289]],   # centre line (y, z)
             'rings': [0.36, 0.66], 'w': 0.10, 'tip': 0.95, 'tip_up': [0.40, 0.52], 'tip_noise': 0.08},   # rings at fractions of its length (width as a fraction), dark from 'tip' on
             # (seen from behind the tail points at you: its end is dark only on top, where it curls up, or it reads as a dark disc)
}

def deep(a, b):
    out = copy.deepcopy(a)
    for k, v in b.items(): out[k] = deep(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out

def ss(e0, e1, x):                                        # smoothstep (works for e0 > e1 too)
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0); return t * t * (3 - 2 * t)

def rgb2hsv(c):
    mx, mn = c.max(-1), c.min(-1); d = mx - mn; s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0); return s, mx

def load_mesh(path):
    m = json.load(open(path))
    P = np.array(m['POSITION']['array'], float).reshape(-1, 3); N = np.array(m['NORMAL']['array'], float).reshape(-1, 3)
    UV = np.array(m['TEXCOORD_0']['array'], float).reshape(-1, 2); J = np.array(m['JOINTS_0']['array'], int).reshape(-1, 4)
    W = np.array(m['WEIGHTS_0']['array'], float).reshape(-1, 4); I = np.array(m['indices'], int).reshape(-1, 3)
    names = [n.split(':')[-1] for n in m['joints']]
    groups = {'head': {'Head', 'Neck'}, 'torso': {'Hips', 'Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder'},
              'arm': {'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm'}, 'leg': {'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'},
              'foot': {'LeftFoot', 'LeftToeBase', 'RightFoot', 'RightToeBase'}}
    groups['hand'] = {n for n in names if 'Hand' in n}
    G = {}
    for g, s in groups.items():
        member = np.array([n in s for n in names]); G[g] = (W * member[J]).sum(1)
    return P, N, UV, G, I

def rasterize(UV, I, size, grow=1.5):
    """For every texel centre: which triangle covers it and the barycentrics (glTF UVs: (0,0) = top-left of the image).
    Conservative: texels whose centre lies just outside every triangle (within 'grow' texels: the rims of the UV islands, and slivers
    thinner than a texel, which would otherwise take the colour of whatever island is nearest in the atlas) get the nearest
    triangle, with its barycentrics clamped to it; a texel inside a triangle always wins."""
    tri = -np.ones((size, size), np.int32); bar = np.zeros((size, size, 3), np.float32); best = np.full((size, size), np.inf, np.float32)
    uv = UV * size - 0.5                                   # texel centres at integer coordinates
    for t, (a, b, c) in enumerate(I):
        A, B, C = uv[a], uv[b], uv[c]
        x0, x1 = int(max(0, math.floor(min(A[0], B[0], C[0]) - grow))), int(min(size - 1, math.ceil(max(A[0], B[0], C[0]) + grow)))
        y0, y1 = int(max(0, math.floor(min(A[1], B[1], C[1]) - grow))), int(min(size - 1, math.ceil(max(A[1], B[1], C[1]) + grow)))
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1])
        if abs(d) < 1e-12: continue
        l1 = ((B[1] - C[1]) * (xs - C[0]) + (C[0] - B[0]) * (ys - C[1])) / d
        l2 = ((C[1] - A[1]) * (xs - C[0]) + (A[0] - C[0]) * (ys - C[1])) / d
        l3 = 1 - l1 - l2; inside = (l1 >= -1e-4) & (l2 >= -1e-4) & (l3 >= -1e-4)
        L = np.clip(np.stack([l1, l2, l3], -1), 0, None); L /= np.maximum(L.sum(-1, keepdims=True), 1e-12)
        px = L[..., 0] * A[0] + L[..., 1] * B[0] + L[..., 2] * C[0]; py = L[..., 0] * A[1] + L[..., 1] * B[1] + L[..., 2] * C[1]
        dist = np.where(inside, 0.0, np.hypot(px - xs, py - ys))
        take = (dist <= grow) & ((dist < best[ys, xs]) | inside)
        if not take.any(): continue
        yy, xx = ys[take], xs[take]; tri[yy, xx] = t; bar[yy, xx] = L[take]; best[yy, xx] = dist[take]
    return tri, bar

class Noise:                                               # smooth 3D noise: a sum of sines in random directions, about unit amplitude
    def __init__(self, rng, freq, n=9):
        self.k = rng.normal(size=(n, 3)); self.k /= np.linalg.norm(self.k, axis=1, keepdims=True)
        self.k *= (freq * (0.6 + 0.8 * rng.random(n)))[:, None]; self.ph = rng.random(n) * 2 * np.pi
    def __call__(self, p): return np.sin(p @ self.k.T + self.ph).mean(-1) * math.sqrt(2 * len(self.ph) / 3)

# ── strokes
def curve(pts, smooth, h=0.0006):
    """The stroke's centre line, resampled every h: a Catmull-Rom spline through the points, or straight segments (a peaked ^)."""
    P = np.asarray(pts, float)
    if smooth and len(P) > 2:
        Q = np.concatenate([[2 * P[0] - P[1]], P, [2 * P[-1] - P[-2]]]); t = np.linspace(0, 1, 48, endpoint=False)[:, None]; out = []
        for i in range(1, len(Q) - 2):
            p0, p1, p2, p3 = Q[i - 1], Q[i], Q[i + 1], Q[i + 2]
            out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2 + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
        C = np.concatenate(out + [P[-1:]])
    else: C = P
    cum = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(C, axis=0), axis=1))]); n = max(2, int(cum[-1] / h) + 1); s = np.linspace(0, cum[-1], n)
    return np.stack([np.interp(s, cum, C[:, k]) for k in range(C.shape[1])], -1)

def nearest(Q, uv):
    """Distance from each point to the polyline Q and where along it (0..1) the nearest point lies."""
    d, i = cKDTree(Q).query(uv); bd = d.copy(); bt = i.astype(float)
    for j in (i - 1, i):
        j = np.clip(j, 0, len(Q) - 2); a = Q[j]; ab = Q[j + 1] - a
        tt = np.clip(((uv - a) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-14), 0, 1); dd = np.linalg.norm(uv - a - ab * tt[:, None], axis=1)
        b = dd < bd; bd = np.where(b, dd, bd); bt = np.where(b, j + tt, bt)
    return bd, bt / (len(Q) - 1)

def profile(t, peak, m, k):
    u = np.where(t < peak, (peak - t) / max(peak, 1e-6), (t - peak) / max(1 - peak, 1e-6))
    return np.clip(1 - np.clip(u, 0, 1) ** m, 0, 1) ** k

def draw(uv, Q, w, shape, E, lo, hi):
    """Coverage of one stroke at chart points uv (lo, hi: per-point edge noise)."""
    out = np.zeros(len(uv)); pad = w + 0.01
    sel = np.all((uv > Q.min(0) - pad) & (uv < Q.max(0) + pad), axis=1)
    if not sel.any(): return out
    d, t = nearest(Q, uv[sel])
    hw = 0.5 * w * profile(t, *shape); hw = hw * (1 + lo[sel]) + hi[sel] * np.clip(hw / 0.004, 0, 1)
    out[sel] = ss(hw + E, hw - E, d) * (hw > 1e-5); return out

def draw_band(ud, v, top, bot, R, E, lo, rt, rb):
    """Coverage of a band: between the bottom and the top edge (each [[phi degrees, y], ...], interpolated over phi) at texels with
    azimuth ud (degrees) and height v; lo swells the thickness, rt / rb rough up the top / bottom edge (model units)."""
    top = np.asarray(top, float); bot = np.asarray(bot, float); out = np.zeros(len(ud))
    sel = (ud > max(top[0, 0], bot[0, 0])) & (ud < min(top[-1, 0], bot[-1, 0])) & (v > bot[:, 1].min() - 0.02) & (v < top[:, 1].max() + 0.02)
    if not sel.any(): return out
    u = ud[sel]; T = np.interp(u, top[:, 0], top[:, 1]); B = np.interp(u, bot[:, 0], bot[:, 1])
    def slope(e): return np.interp(u, 0.5 * (e[1:, 0] + e[:-1, 0]), np.diff(e[:, 1]) / (R * np.radians(np.diff(e[:, 0]))))
    c = 0.5 * (T + B); h = 0.5 * (T - B) * (1 + lo[sel]); k = np.clip((T - B) / 0.008, 0, 1)
    T = c + h + rt[sel] * k; B = c - h - rb[sel] * k
    d = np.minimum((T - v[sel]) / np.sqrt(1 + slope(top) ** 2), (v[sel] - B) / np.sqrt(1 + slope(bot) ** 2))
    out[sel] = ss(-E, E, d); return out

def back_lookup(p, n, mask, chart):
    """Back view (x, y) → chart coordinates of the back-most texel of a region there (None where the view misses the region)."""
    sel = np.where(mask & (n[:, 2] < 0.35))[0]; tree = cKDTree(p[sel, :2]); zz = p[sel, 2]
    def f(q):
        d, j = tree.query(q, k=24, distance_upper_bound=0.006); ok = np.isfinite(d); j = np.minimum(j, len(sel) - 1)
        z = np.where(ok, zz[j], np.inf); b = np.argmin(z, 1); r = np.arange(len(q)); good = ok[r, b]
        out = chart[sel[j[r, b]]]
        k = 7; ker = np.ones(k) / k                                          # smooth out the texel-to-texel steps
        if good.sum() > k: out = np.stack([np.convolve(np.pad(out[:, c], k // 2, mode='edge'), ker, 'valid') for c in range(2)], -1)
        return out[good]
    return f

def find_cuts(a, b, dark, rng_a, cell_a=1.0, cell_b=0.002, min_n=150):
    """Stripes that end (cut) inside rng_a of the angle-like coordinate a (the back lies toward smaller a): per stripe, where it ends
    (a_end, b_end), its half-width there and its slope db/da near the end."""
    m = dark & (a > rng_a[0] - 20) & (a < rng_a[1])
    if m.sum() < min_n: return []
    b0 = b[m].min(); ia = ((a[m] - rng_a[0] + 20) / cell_a).astype(int); ib = ((b[m] - b0) / cell_b).astype(int)
    Gd = np.zeros((ib.max() + 1, ia.max() + 1), bool); Gd[ib, ia] = True
    Gd = ndimage.binary_closing(Gd, iterations=2); lab, nl = ndimage.label(Gd); L = lab[ib, ia]; A = a[m]; B = b[m]; out = []
    for k in range(1, nl + 1):
        q = L == k
        if q.sum() < min_n: continue
        aa, bb = A[q], B[q]; a_end = np.percentile(aa, 2)
        if a_end < rng_a[0] or a_end > rng_a[1] - 8: continue            # not cut in the range (the stripe goes on, or it is all front)
        e = aa < a_end + 5; h = 0.5 * (np.percentile(bb[e], 95) - np.percentile(bb[e], 5)) if e.sum() > 10 else 0
        f = aa < a_end + 22; slope = np.polyfit(aa[f], bb[f], 1)[0] if f.sum() > 30 and np.ptp(aa[f]) > 6 else 0.0
        b_end = np.median(bb[e]) if e.sum() > 10 else np.median(bb)
        out.append({'a': float(a_end), 'b': float(b_end), 'hw': float(h), 'slope': float(slope), 'n': int(q.sum())})
    return out

def paint(meshp, texp, outp, size, cfg, debugp=None):
    rng = np.random.default_rng(cfg['seed'])
    P, N, UV, G, I = load_mesh(meshp)
    src = Image.open(texp).convert('RGB').resize((size, size), Image.LANCZOS); T = np.asarray(src).astype(np.float32) / 255
    tri, bar = rasterize(UV, I, size); cov = tri >= 0; ti = tri[cov]; bb = bar[cov]
    vi = I[ti]                                             # (k,3) vertex ids per covered texel
    p = (P[vi] * bb[..., None]).sum(1); n = (N[vi] * bb[..., None]).sum(1); n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
    g = {k: (v[vi] * bb).sum(1) for k, v in G.items()}
    c = T[cov]; s, v = rgb2hsv(c)
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    # ── regions
    tail = (z < cfg['tail']['z0']) & (np.abs(x) < 0.1) & (y > 0.06) & (y < 0.4) & (g['torso'] > 0.5)
    torso = np.clip(g['torso'], 0, 1) * ~tail
    head = np.clip(g['head'], 0, 1)
    arm = np.clip(g['arm'] + np.where((np.abs(x) > 0.17) & (y > 0.37), g['torso'], 0), 0, 1) * (np.abs(x) > 0.15) * (1 - np.clip(g['hand'] * 1.5, 0, 1))
    torso = torso * (1 - arm)
    leg = np.clip(g['leg'] + g['foot'], 0, 1) * (y < 0.12)
    torso = torso * (1 - leg)
    hand = np.clip(g['hand'] * 1.5, 0, 1)
    # ── back-ness per region (1 = behind the side plane, where the texture is beige)
    zc_b = np.array([-0.05, -0.04, -0.02, 0.0, 0.02, 0.03]); yb = np.array([0.1, 0.18, 0.26, 0.34, 0.42, 0.5])   # torso centre line z(y)
    zc = np.interp(y, yb, zc_b); phi = np.degrees(np.arctan2(x, -(z - zc)))
    tb = ss(cfg['torso']['phi'][1], cfg['torso']['phi'][0], np.abs(phi))
    hc = np.array(cfg['head']['centre']); d = p - hc; d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    hb = ss(cfg['head']['dz'][0], cfg['head']['dz'][1], d[:, 2])
    lat = np.degrees(np.arcsin(np.clip(d[:, 1], -1, 1))); hphi = np.degrees(np.arctan2(d[:, 0], -d[:, 2]))
    # the cheek ruffs: spiky tufts standing out of the head's sphere behind the cheeks, cream on both sides; a colour test alone missed
    # the shaded side, so they are found by shape and left exactly as Tripo painted them
    hr = np.linalg.norm(p - hc, axis=1)
    ruff = head * ss(0.199, 0.208, hr) * ss(45, 55, np.abs(hphi)) * ss(114, 102, np.abs(hphi)) * ss(-46, -38, lat) * ss(9, 1, lat) if cfg.get('ruff', True) else np.zeros(len(p))
    psi = np.degrees(np.arctan2(y - 0.447, -(z - 0.0)))   # around each arm's axis (along x at y .447, z 0): 0 = straight back, +90 = top
    ab = ss(cfg['arm']['psi'][1], cfg['arm']['psi'][0], np.abs(psi))
    lx = np.where(x > 0, 0.095, -0.095); lphi = np.degrees(np.arctan2(x - lx, -(z + 0.02))) * np.sign(x)   # around each leg, + = outward
    lb = ss(cfg['leg']['phi'][1], cfg['leg']['phi'][0], np.abs(lphi)) * ss(-0.85, -0.6, n[:, 1])      # not the soles
    if cfg.get('check', True) and (tb > 0.95).sum() > 1000 and np.median(s[(tb > 0.95) & (torso > 0.9)]) > cfg['beige']['sat'][0]:
        sys.exit('tiger_paint: the back of this texture is already painted (not Tripo\'s beige); use the original texture as the source')
    wsum = torso + head + arm + leg + tail
    geo = (torso * tb + head * hb + arm * ab + leg * lb + tail) / np.maximum(wsum, 1e-6) * np.clip(wsum / 0.5, 0, 1) * (1 - ruff)
    beige = ss(cfg['beige']['sat'][0], cfg['beige']['sat'][1], s) * ss(cfg['beige']['val'][0], cfg['beige']['val'][1], v)
    white = ss(cfg['white'][0], cfg['white'][1], s) * ss(0.72, 0.85, v) * np.clip(head + leg, 0, 1)      # the cheek ruff and the paws stay white
    # the ears are thin lobes: where the head's front and back surfaces lie close together (in z at the same x, y) the texel is ear
    ec = cfg['ears']; cell = 0.004; hsel = (head > 0.3) & (y > 0.6)
    gx = np.clip(((x + 0.3) / cell).astype(int), 0, int(0.6 / cell)); gy = np.clip(((y - 0.6) / cell).astype(int), 0, int(0.3 / cell))
    zmin = np.full((int(0.3 / cell) + 1, int(0.6 / cell) + 1), 9.0); zmax = np.full_like(zmin, -9.0)
    np.minimum.at(zmin, (gy[hsel], gx[hsel]), z[hsel]); np.maximum.at(zmax, (gy[hsel], gx[hsel]), z[hsel])
    ok = (zmin < 8).astype(float); wok = ndimage.gaussian_filter(ok, 1.3)   # smoothed over the filled cells only (normalised, so it also
    def nsmooth(a): return ndimage.gaussian_filter(a * ok, 1.3) / np.maximum(wok, 1e-3)   # fills the odd empty cell): the lobe's edge has no grid steps
    thick = np.where(wok > 0.02, nsmooth(np.where(ok > 0, zmax - zmin, 0.0)), 1.0)
    zmid = np.where(wok > 0.02, nsmooth(np.where(ok > 0, 0.5 * (zmin + zmax), 0.0)), 0.0)
    th = ndimage.map_coordinates(thick, [(y - 0.6) / cell - 0.5, (x + 0.3) / cell - 0.5], order=1, mode='nearest')
    zm = ndimage.map_coordinates(zmid, [(y - 0.6) / cell - 0.5, (x + 0.3) / cell - 0.5], order=1, mode='nearest')
    rng_e = np.random.default_rng(cfg['seed'] + 11); nea = Noise(rng_e, 70.0); nea2 = Noise(rng_e, 420.0, 12)
    er = ec['rough'] if isinstance(ec['rough'], list) else [ec['rough'], 0.0]
    lobe = ss(ec['thick'][0], ec['thick'][1], th + er[0] * nea(p) + er[1] * nea2(p)) * ss(0.715, 0.745, y) * ss(0.05, 0.08, np.abs(x)) * np.clip(head * 1.5, 0, 1)
    ears = lobe > 0.5
    ear_back = lobe * np.maximum(ss(ec['back'][0], ec['back'][1], n[:, 2]), ss(zm + 0.006, zm - 0.004, z) * ss(0.15, 0.0, n[:, 2]))
    # Tripo left a few dark blotches on the plain back (flank, crown) and a pale beige on the ears' backs: deep inside the repainted
    # region they are repainted too (the ear lobes' backs are then painted dark brown)
    if cfg.get('clean', True): beige = np.maximum(beige, ss(0.85, 1.0, geo))
    beige = beige * (1 - white)
    wgt = geo * beige * (1 - lobe)                         # the ear lobes keep Tripo's colour under their dark backs (no orange band at the fade)
    # ── colours: sampled from the painted front
    front_or = (s > 0.55) & (v > 0.55) & (geo < 0.05)
    def med(mask): return np.median(c[mask], 0) if mask.sum() > 50 else None
    oc = cfg['orange']
    o_head = np.array(oc['head']) / 255 if oc['head'] else med(front_or & (head > 0.8))
    o_torso = np.array(oc['torso']) / 255 if oc['torso'] else med(front_or & (torso > 0.8))
    o_limb = np.array(oc['limb']) / 255 if oc['limb'] else med(front_or & (leg > 0.5))
    if o_limb is None: o_limb = o_torso
    o_armtop = med(front_or & (arm > 0.5) & (psi > 100) & (psi < 150))
    dk = np.array(cfg['dark']) / 255 if cfg['dark'] else med((v < 0.33) & (geo < 0.05) & (head + torso > 0.5))
    def graded(sel, coord, bins, half, base):             # colour of the front's sides by height (or latitude), interpolated
        cols = []
        for b0 in bins:
            mm = sel & (np.abs(coord - b0) < half); cols.append(np.median(c[mm], 0) if mm.sum() > 30 else [np.nan] * 3)
        cols = np.array(cols, float); ok = ~np.isnan(cols[:, 0])
        if ok.sum() < 2: return np.tile(base, (len(p), 1))
        return np.stack([np.interp(coord, bins[ok], cols[ok, k]) for k in range(3)], -1)
    # the torso's orange follows the front's sides at the same height (yellow up top, deeper orange at the hips), so the two meet unseen;
    # the head's follows its sides at the same latitude (orange cheeks, yellow crown)
    o_t = np.tile(o_torso, (len(p), 1)); o_h = np.tile(o_head, (len(p), 1))
    if cfg.get('grade', True):
        side = front_or & (torso > 0.8) & (np.abs(phi) > 100) & (np.abs(phi) < 140)
        if side.sum() > 200: o_t = graded(side, y, np.arange(0.08, 0.54, 0.03), 0.03, o_torso)
        hl = cfg.get('hip_lift')
        if hl and hl[0] > 0:
            o_up = np.median(o_t[(torso > 0.8) & (np.abs(y - 0.40) < 0.01)], 0); f = (hl[0] * ss(hl[1], hl[2], y))[:, None]
            o_t = o_t * (1 - f) + o_up[None] * f
        hside = front_or & (head > 0.8) & (np.abs(hphi) > 95) & (np.abs(hphi) < 150)
        if hside.sum() > 200: o_h = graded(hside, lat, np.arange(-30.0, 91.0, 10.0), 6.0, o_head)
        o_h = o_h + cfg.get('head_warm', 0.0) * ss(0.0, -0.8, d[:, 2])[:, None] * (o_torso[None] - o_h)   # the crown warms toward the body
    o_a = np.tile(o_limb, (len(p), 1))
    if o_armtop is not None:                              # the arm's back: the torso's colour underneath, the front's yellow on top
        fa = ss(cfg['arm_grade'][0], cfg['arm_grade'][1], psi)[:, None]; o_a = o_t * (1 - fa) + o_armtop[None] * fa
    orange = (o_h * head[:, None] + o_t * (torso + tail)[:, None] + o_a * arm[:, None] + o_limb[None] * leg[:, None])
    orange /= np.maximum((head + torso + tail + arm + leg)[:, None], 1e-6)
    vb = np.median(v[wgt > 0.8]) if (wgt > 0.8).sum() > 50 else 0.75
    gain = np.clip(v / vb, cfg['gain'][0], cfg['gain'][1])[:, None]
    newc = np.clip(orange * gain, 0, 1)
    out = c * (1 - wgt[:, None]) + newc * wgt[:, None]
    # ── stripes: brush strokes in 3D, dark brown
    E = cfg['edge']; nlo = Noise(rng, 90.0); nhi = Noise(rng, 1300.0, 12); nw1 = Noise(rng, 22.0); nw2 = Noise(rng, 22.0); nink = Noise(rng, 160.0)
    nmid = Noise(rng, 480.0, 12); lo = cfg['rough']['lo'] * nlo(p); hi = cfg['rough']['hi'] * nhi(p) + cfg['rough']['mid'] * nmid(p); warp = cfg['warp'] * np.stack([nw1(p), nw2(p)], -1)
    J = cfg['jitter']
    def jit(pts, amount):
        P0 = np.asarray(pts, float); return (P0 + rng.normal(scale=amount, size=P0.shape)).tolist() if amount > 0 else P0.tolist()
    def region_strokes(strokes, uv, mask, lookup=None, flip=None):
        """Coverage of a list of strokes over the texels in mask, uv = their chart coordinates (warped)."""
        idx = np.where(mask)[0]; st = np.zeros(len(p))
        if not len(idx) or not strokes: return st
        U = uv[idx] + warp[idx]; lo_, hi_ = lo[idx], hi[idx]; acc = np.zeros(len(idx))
        for sk in strokes:
            copies = [(sk['p'], 1.0)]
            if sk.get('mirror'): copies.append(([[-a, b] for a, b in sk['p']], 1.0))
            for pts, _ in copies:
                pts = jit(pts, J if sk.get('mirror') else J * 0.3); wj = sk['w'] * (1 + (rng.normal(scale=0.06) if sk.get('mirror') else 0))
                Q = curve(pts, sk.get('smooth', True), 0.0003)
                if lookup is not None: Q = lookup(Q)
                if len(Q) < 2: continue
                Q = curve(Q, False, 0.0006)
                acc = np.maximum(acc, draw(U, Q, wj, sk['shape'], E, lo_, hi_))
        st[idx] = acc; return st
    # torso: chart (arc around the body, height); strokes authored in the back view
    Rt = cfg['torso']['R']; tchart = np.stack([Rt * np.radians(phi), y], -1)
    tmask = (torso > 0.02) & (tb > 0.01)
    st_t = region_strokes(cfg['torso']['strokes'], tchart, tmask, back_lookup(p, n, (torso > 0.5), tchart))
    st_t = np.maximum(st_t, region_strokes(cfg['torso'].get('chart_strokes', []), tchart, tmask))
    hi2 = cfg['rough']['hi'] * Noise(rng, 1300.0, 12)(p) + cfg['rough']['mid'] * Noise(rng, 480.0, 12)(p)
    idx = np.where(tmask)[0]; ud = phi[idx] + np.degrees(warp[idx, 0] / Rt); vv = y[idx] + warp[idx, 1]
    for bd in cfg['torso'].get('bands', []):
        jt = rng.normal(scale=cfg.get('band_jitter', J * 0.5), size=2)   # a little asymmetry: each band's two halves shifted apart
        top = [[a, b + (jt[0] if a < 0 else jt[1] if a > 0 else 0)] for a, b in bd['top']]; bot = [[a, b + (jt[0] if a < 0 else jt[1] if a > 0 else 0)] for a, b in bd['bot']]
        cv = draw_band(ud, vv, top, bot, Rt, E, lo[idx], hi[idx], hi2[idx]); st_t[idx] = np.maximum(st_t[idx], cv)
    st_t = st_t * torso
    # head: sinusoidal chart around the head centre; strokes authored in the back view; not the ears or the white ruff
    Rh = cfg['head']['R']; hchart = np.stack([Rh * np.radians(hphi) * np.cos(np.radians(lat)), Rh * np.radians(lat)], -1)
    hmask = (head > 0.02) & (hb > 0.01) & ~ears
    st_h = region_strokes(cfg['head']['strokes'], hchart, hmask, back_lookup(p, n, (head > 0.5) & ~ears & (d[:, 2] < 0.2), hchart)) * head * (1 - white)
    # arms / legs: charts with a mirrored coordinate (|x|, around-angle), strokes drawn on both sides
    Ra = cfg['arm']['R']; achart = np.stack([np.abs(x), Ra * np.radians(psi)], -1)
    st_a = region_strokes([dict(sk, mirror=False) for sk in cfg['arm']['strokes']], achart, arm > 0.02) * arm
    Rl = cfg['leg']['R']; lchart = np.stack([Rl * np.radians(lphi), y], -1)
    low = leg + torso * (y < 0.2)
    st_l = region_strokes([dict(sk, mirror=False) for sk in cfg['leg']['strokes']], lchart, low > 0.02) * np.clip(low, 0, 1)
    st = np.maximum.reduce([st_t, st_h, st_a, st_l])
    # carry on the front's cut-off stripes toward the back (these may start in the front, over the stripe they continue)
    dark = (v < 0.40) & (s < 0.62) & (s > 0.1)
    cont = cfg.get('continue') or {}; st_c = np.zeros(len(p)); cuts_found = {}
    def carry(name, a, b, sides, weight, chart, R_a, swap):
        """Find the cut ends of one region's front stripes and draw their continuations. a: angle-like coordinate in degrees (the back
        toward smaller a), b: the other chart coordinate; sides: (chart sign of a, texels of that side); swap: chart = (b, a)."""
        nonlocal st_c
        cc = cont[name]; found = []
        for sgn, sel in sides:
            for cu in find_cuts(a, b, dark & sel & (weight > 0.5), cc['range']):
                if cu['hw'] * 2 < cc['min_w']: continue
                aa = np.array([cu['a'] + 4, cu['a'], cu['a'] - cc['len']]); bw = cu['b'] + cu['slope'] * (aa - cu['a'])
                ch = np.stack([sgn * R_a * np.radians(aa), bw], -1)
                if swap: ch = ch[:, ::-1]
                m = (weight > 0.02) & sel; U = chart[m] + warp[m] * 0.5
                cov_ = np.zeros(len(p)); cov_[m] = draw(U, curve(ch, True), 2 * cu['hw'] * 1.05, [0.0, 1.4, 0.9], E, lo[m], hi[m])
                st_c = np.maximum(st_c, cov_ * np.clip(weight, 0, 1)); found.append(cu)
        cuts_found[name] = found
    if 'torso' in cont: carry('torso', np.abs(phi), y, [(1, x > 0), (-1, x < 0)], torso, tchart, Rt, False)
    if 'leg' in cont: carry('leg', np.abs(lphi), y, [(1, (x > 0) & (lphi > 0)), (1, (x < 0) & (lphi > 0))], low, lchart, Rl, False)
    if 'arm' in cont: carry('arm', np.abs(psi), np.abs(x), [(1, (x > 0) & (psi > 0)), (1, (x < 0) & (psi > 0))], arm, achart, Ra, True)
    st = st * geo
    st = np.maximum(st, st_c * (1 - hand) * (1 - white))
    ink = np.clip(1 + cfg['ink'] * nink(p), 0.7, 1.3)[:, None]
    # tail: orange, a few dark rings and a dark tip. It is a short thick sausage that leaves the hips backward and curls up; its length
    # parameter is the position along a centre line (in the x = 0 plane), so rings sit square to it however the tail bends
    tl = np.zeros(len(p))
    if tail.any():
        C = np.array(cfg['tail']['axis'], float); C3 = np.stack([np.zeros(len(C)), C[:, 0], C[:, 1]], -1)
        Qa = curve(C3[:, 1:], True, 0.0005); Q3 = np.stack([np.zeros(len(Qa)), Qa[:, 0], Qa[:, 1]], -1)
        ti = np.where(tail)[0]; dd, tt = nearest(Q3[:, 1:], p[ti][:, 1:])
        Lc = np.linalg.norm(np.diff(Qa, axis=0), axis=1).sum()
        end = tt >= 1 - 1e-6; beyond = np.linalg.norm(p[ti][:, 1:] - Qa[-1], axis=1)
        tl[ti] = np.where(end, 1 + beyond / Lc * 0.5, tt)
        wob = 0.025 * nw1(p)
        for rr in cfg['tail']['rings']:
            st = np.maximum(st, ss(0.012, -0.012, np.abs(tl - rr - wob) - cfg['tail']['w'] * 0.5 * (1 + lo)) * tail)
        tipm = ss(cfg['tail']['tip'] - 0.025, cfg['tail']['tip'] + 0.025, tl + wob)
        if cfg['tail'].get('tip_up'): tipm = tipm * ss(cfg['tail']['tip_up'][0], cfg['tail']['tip_up'][1], n[:, 1] + cfg['tail'].get('tip_noise', 0.15) * nw2(p))   # only the top of the curl
        st = np.maximum(st, tipm * tail)
    st = np.maximum(st, ear_back * (1 - white))           # the ears' backs dark brown, like the reference
    shade = (1 + cfg.get('ink_shade', 0.0) * (gain - 1))                # the ink darkens and lightens with the texture's baked shading
    out = out * (1 - st[:, None]) + np.clip(dk[None] * ink * shade, 0, 1) * st[:, None]
    # the front is Tripo's and stays exactly as it was: whatever faces the viewer of the idle pose (n.z above 'protect') is put back
    # (a carried-on side stripe near the armpit, the base of an ear lobe); not the tail, which curls up behind the body
    pr = cfg.get('protect')
    prot = ss(pr[0], pr[1], n[:, 2]) * (1 - np.clip(tail * 2, 0, 1)) if pr else np.zeros(len(p))
    prot = np.maximum(prot, ruff); out = out * (1 - prot[:, None]) + c * prot[:, None]
    # ── write back, then spill each patch's colours a few texels past its edge (so filtering never pulls in the old beige)
    O = T.copy(); O[cov] = out
    dist, (iy, ix) = ndimage.distance_transform_edt(~cov, return_indices=True)
    changed = cov & (np.abs(O - T).max(-1) > 0.5 / 255)           # near repainted patches the whole gutter is refilled from the nearest texel
    near = ndimage.distance_transform_edt(~changed) <= size // 128   # (their mipmaps must not pull in the old beige left between two patches)
    pad = (~cov) & ((dist <= max(3, size // 512)) | ((dist <= size // 128) & near)); O[pad] = O[iy[pad], ix[pad]]
    Image.fromarray((np.clip(O, 0, 1) * 255 + 0.5).astype(np.uint8)).save(outp)
    info = {'covered': float(cov.mean()), 'repainted': float((wgt > 0.5).mean() * cov.mean()), 'striped': float((st > 0.5).mean() * cov.mean()),
            'orange_head': (o_head * 255).round().tolist(), 'orange_torso': (o_torso * 255).round().tolist(), 'orange_limb': (o_limb * 255).round().tolist(),
            'dark': (dk * 255).round().tolist(), 'beige_value': float(vb), 'tail_texels': int(tail.sum()),
            'continued': {k: [{kk: (round(vv, 4) if isinstance(vv, float) else vv) for kk, vv in cu.items() if kk != 'pts'} for cu in v_] for k, v_ in cuts_found.items()}}
    if debugp:                                             # regions (r head, g torso, b arm, y leg, m tail) × where it repaints, stripes in black
        D = np.zeros((len(p), 3)); D += head[:, None] * [1, .3, .3]; D += torso[:, None] * [.3, 1, .3]; D += arm[:, None] * [.3, .3, 1]
        D += leg[:, None] * [1, 1, .2]; D += tail[:, None] * [1, .2, 1]; D = np.clip(D, 0, 1) * (0.35 + 0.65 * wgt[:, None]); D *= (1 - st[:, None])
        D = D * (1 - st_c[:, None]) + np.array([0, 0.9, 0.9]) * st_c[:, None] * 0.8
        DI = np.full_like(T, 0.5); DI[cov] = D; DI[pad] = DI[iy[pad], ix[pad]]
        Image.fromarray((np.clip(DI, 0, 1) * 255).astype(np.uint8)).save(debugp)
    return info

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('mesh'); ap.add_argument('texture'); ap.add_argument('out')
    ap.add_argument('--size', type=int, default=2048); ap.add_argument('--config'); ap.add_argument('--debug')
    a = ap.parse_args(); cfg = deep(DEFAULT, json.load(open(a.config))) if a.config else DEFAULT
    print(json.dumps(paint(a.mesh, a.texture, a.out, a.size, cfg, a.debug)))
