#!/usr/bin/env python3
"""Cut-out → line drawing, for the workshop floor's "drawing → part" reveal (Kay, 2026-10-01).

    python3 merge/tools/lines.py assets/projects/levelup.webp [more.webp ...]   →  assets/projects/levelup-line.webp

Same pixel size as the cut-out, so it sits exactly on it in the card: a firm outline from the alpha, the photo's own edges
inside it (Canny) as thinner lines, and two dimension lines with end ticks (no numbers — nothing is measured).
"""
import sys, pathlib
import numpy as np
from PIL import Image
import cv2

INK = (17, 17, 17)

def line_art(src: pathlib.Path) -> pathlib.Path:
    im = Image.open(src).convert('RGBA')
    if max(im.size) < 900: im = im.resize((round(im.width * 900 / max(im.size)), round(im.height * 900 / max(im.size))), Image.LANCZOS)   # small sources: draw at 900 px (same aspect, so it still sits on the cut-out)
    a = np.array(im); h, w = a.shape[:2]
    alpha = a[:, :, 3]; mask = (alpha > 110).astype(np.uint8)
    s = max(w, h) / 960                                              # stroke widths are tuned at 960 px
    k = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(1, int(round(r * s))) * 2 + 1,) * 2)
    outline = cv2.subtract(cv2.dilate(mask, k(1.6)), cv2.erode(mask, k(1.6)))
    grey = cv2.cvtColor(a[:, :, :3], cv2.COLOR_RGB2GRAY); grey = cv2.bilateralFilter(grey, 9, 40, 9); grey = cv2.GaussianBlur(grey, (0, 0), 1.8 * s)
    v = float(np.median(grey[mask > 0])) if mask.any() else 128.0
    edges = cv2.Canny(grey, int(max(10, 0.7 * v)), int(min(255, 1.6 * v)))
    edges[cv2.erode(mask, k(6)) == 0] = 0                            # the outline already carries the silhouette's edge
    n, lab, st, _ = cv2.connectedComponentsWithStats((edges > 0).astype(np.uint8), connectivity=8)
    keep = np.zeros(n, bool); keep[1:] = np.maximum(st[1:, cv2.CC_STAT_WIDTH], st[1:, cv2.CC_STAT_HEIGHT]) >= 26 * s   # drop specks: texture, not form
    edges = (keep[lab] * 255).astype(np.uint8)
    edges = cv2.dilate(edges, k(0.7))
    out = np.zeros((h, w, 4), np.uint8); out[:, :, :3] = INK
    out[:, :, 3] = np.maximum(outline * 255, (edges > 0).astype(np.uint8) * 150)
    # dimension lines under and right of the bounding box, with end ticks
    ys, xs = np.nonzero(mask)
    if len(xs):
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max(); g = int(16 * s); t = max(1, int(round(1.2 * s))); tick = int(9 * s)
        dim = np.zeros((h, w), np.uint8); yb = min(h - 1 - tick, y1 + g); xr = min(w - 1 - tick, x1 + g)
        cv2.line(dim, (int(x0), yb), (int(x1), yb), 255, t); cv2.line(dim, (int(x0), yb - tick), (int(x0), yb + tick), 255, t); cv2.line(dim, (int(x1), yb - tick), (int(x1), yb + tick), 255, t)
        if xr > x1:
            cv2.line(dim, (xr, int(y0)), (xr, int(y1)), 255, t); cv2.line(dim, (xr - tick, int(y0)), (xr + tick, int(y0)), 255, t); cv2.line(dim, (xr - tick, int(y1)), (xr + tick, int(y1)), 255, t)
        out[:, :, 3] = np.maximum(out[:, :, 3], (dim > 0).astype(np.uint8) * 110)
    dst = src.with_name(src.stem + '-line.webp')
    Image.fromarray(out, 'RGBA').save(dst, 'WEBP', quality=88, method=6)
    return dst

if __name__ == '__main__':
    for p in sys.argv[1:]: print(line_art(pathlib.Path(p)))
