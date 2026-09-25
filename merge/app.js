// KookyTiger — MERGED LAYOUT (Léo × Laurens), motion pass.
//   Camera  = Léo: position is a LINEAR function of page scroll (Lenis is the only smoothing), rotation never changes,
//             header dollies down 2.4 / forward 4 over 200vh, then a straight vertical descent — even under paper.
//   Tiger   = Laurens: the character keeps one place on the right of the frame; its CLIPS are scrubbed by scroll
//             (clip time = f(scroll)), root motion stripped (the world moves, not the tiger); idle → turnToWall →
//             overEdge → climbing (loop) → landing → turnAround → sit, with a head-glance layer and time-driven idle bits.
//   The rig below is a procedural placeholder with the same clip grammar, so a skinned GLB can replace it later:
//   each state is a function of (scroll phase) → pose, exactly like `action.time = f(scroll)`.
import * as THREE from './vendor/three.module.min.js';
import { CATS, SIL, PIECES, WINDOWS, SCREEN_PER_CARD, SHORE_SCREENS, SHORE_TEXT_AT, RATE, CAMERA, TIGER, LEDGE_X, COPY, ARCHIVE, MOUSE, MOTION, SKY, LIGHT } from './content.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (v, [a, b]) => clamp((v - a) / (b - a), 0, 1);
const frac = (v) => v - Math.floor(v);
const NP = PIECES.length;
const PARAMS = new URLSearchParams(location.search); const SNAP = PARAMS.has('snap');
const HALF = Math.PI / 2;

gsap.registerPlugin(SplitText, CustomEase);
CustomEase.create('reveal', MOTION.reveal.ease);
CustomEase.create('hide', MOTION.hide.ease);

// ───────────────────────── DOM: build the page from content ─────────────────────────
$('nav-brand').innerHTML = `${COPY.nav.name}<span>${COPY.nav.sub}</span>`;
$('nav-links').textContent = 'Product, film, games, analytics';
$('nav-right').innerHTML = COPY.nav.links.map((l, i) => `<a href="#" data-to="${['win0', 'intro', 'archives'][i]}">${l}</a>`).join('');
$('h-statement').innerHTML = COPY.header.statement.join('<br>');
$('h-scroll').textContent = COPY.header.scroll;
$('hero-words').innerHTML = COPY.hero.words.map((w, i) => `<span class="word"><span class="main">${w}</span><span class="alt">${COPY.hero.reveal[i]}</span></span>`).join('') + `<div class="ind">${COPY.hero.indication}</div>`;
$('hero-l').innerHTML = `Raised in Wuhan<br>Designing anywhere`;
$('hero-r').innerHTML = `Northwestern ’27<br>MaDE + RTVF`;
$('intro-big').innerHTML = COPY.intro.big.map((t) => `<p class="split">${t}</p>`).join('');
$('intro-small').innerHTML = COPY.intro.small.map((t) => `<p class="split">${t}</p>`).join('');
$('intro-reel').textContent = COPY.intro.reel;
const body = $('body'); let html = '';
WINDOWS.forEach((idx, w) => {
  const last = w === WINDOWS.length - 1; const n = idx.length * SCREEN_PER_CARD + (last ? SHORE_SCREENS : 0);
  html += `<section class="window" id="win${w}" style="--n:${n}" aria-label="Projects ${idx[0] + 1}–${idx[idx.length - 1] + 1}">`;
  idx.forEach((pi, j) => { const p = PIECES[pi]; html += `<article class="card" style="--i:${j * SCREEN_PER_CARD}" data-p="${pi}"><div class="in" role="button" tabindex="0" aria-label="Open ${p.name}"><div class="text">
    <p class="eyebrow mono"><span class="n">${String(pi + 1).padStart(2, '0')} / ${NP}</span><span>${CATS[p.cat].name}</span></p>
    <h2 class="split">${p.name}</h2><p class="desc split">${p.desc}</p><p class="meta mono"><span>${p.meta.join(' · ')}</span><span>${p.year}</span></p><p class="take split">${p.take}</p></div>
    <figure><svg viewBox="0 0 200 140" role="img" aria-label="${p.name}">${SIL[p.sil]}</svg><figcaption>placeholder · silhouette of the object</figcaption></figure></div></article>`; });
  if (last) html += `<div class="shore-text" style="--i:${SHORE_TEXT_AT}"><div class="big" id="shore-big">${COPY.shore.words.map((x) => `<span class="split" style="display:block">${x}</span>`).join('')}</div><div class="sub split">${COPY.shore.sub}</div><br><a class="sayhi" href="mailto:${COPY.footer.email}">${COPY.shore.sayhi}</a></div>`;
  html += `</section>`;
  if (!last) html += `<section class="paper st" id="st${w}"><div class="big" id="st-big${w}">${COPY.statements[w].map((l) => `<span class="line">${l}</span>`).join('')}</div></section>`;
});
body.innerHTML = html;
$('arch-head').innerHTML = `<span class="split">${COPY.archives.title}</span><span class="mono">${COPY.archives.note}</span>`;
$('arch-table').innerHTML = ARCHIVE.map((r, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td><b>${r[0]}</b><span>${r[1]}</span></td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('');
$('foot-words').innerHTML = COPY.footer.words.map((w) => `<span class="word split">${w}</span>`).join('') + `<a class="sayhi" href="mailto:${COPY.footer.email}">${COPY.footer.sayhi}</a>`;
$('foot-bottom').innerHTML = `<span>${COPY.footer.bottom[0]} · ${COPY.footer.bottom[1]}</span><a href="mailto:${COPY.footer.email}">${COPY.footer.email}</a><span>${COPY.footer.bottom[2]}</span>`;

// ───────────────────────── Project detail panel (slides in from the left; the tiger keeps hanging on the right) ─────────────────────────
const panel = $('panel'), panelInner = $('panel-inner'), panelScrim = $('panel-scrim'); let panelOpen = false, panelFrom = null;
function openPanel(pi, from) { const p = PIECES[pi], d = p.detail || {}, L = COPY.panel; panelFrom = from || null;
  const sec = (k, v, cls = '') => v ? `<div class="sec blk ${cls}"><span class="k mono">${k}</span><p>${v}</p></div>` : '';
  panelInner.innerHTML = `<p class="eyebrow mono blk"><span class="n">${String(pi + 1).padStart(2, '0')} / ${NP}</span><span>${CATS[p.cat].name}</span><span>${p.year}</span><span>${p.meta.join(' · ')}</span></p>
    <h2 id="panel-title" class="blk">${p.name}</h2><p class="line blk">${d.line || p.desc}</p>
    ${sec(L.role, d.role)}${sec(L.tools, d.tools)}${sec(L.numbers, d.numbers)}${sec(L.one, d.one || p.take, 'one')}
    <figure class="blk">${p.img ? `<img src="${p.img}" alt="${p.name}">` : `<svg viewBox="0 0 200 140" role="img" aria-label="${p.name}">${SIL[p.sil]}</svg>`}</figure>
    <a class="ask blk" href="mailto:${COPY.footer.email}?subject=${encodeURIComponent(p.name)}">${L.ask}</a>`;
  panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); panelScrim.classList.add('on'); panelOpen = true; panel.scrollTop = 0;
  gsap.fromTo(panelInner.querySelectorAll('.blk'), { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'reveal', stagger: 0.05, delay: 0.12, overwrite: true });
  lenis.stop(); setTimeout(() => $('panel-close').focus({ preventScroll: true }), 50); }
function closePanel() { if (!panelOpen) return; panelOpen = false; panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); panelScrim.classList.remove('on'); lenis.start(); if (panelFrom) panelFrom.focus({ preventScroll: true }); }
document.querySelectorAll('.card .in').forEach((el) => { const pi = +el.closest('.card').dataset.p; el.addEventListener('click', () => openPanel(pi, el)); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(pi, el); } }); });
$('panel-close').addEventListener('click', closePanel); panelScrim.addEventListener('click', closePanel);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

// ───────────────────────── Text grammar (Léo): masked lines; statements char by char ─────────────────────────
const texts = [];
function makeText(el, opts = {}) {
  const t = { el, lines: null, shown: false, stagger: opts.stagger ?? MOTION.reveal.stagger, delay: opts.delay ?? 0, once: !!opts.once };
  SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line', autoSplit: true, onSplit(self) { t.lines = self.lines; gsap.set(self.lines, { yPercent: t.shown ? 0 : 110 }); } });
  t.reveal = () => { if (t.shown || !t.lines) return; t.shown = true; gsap.killTweensOf(t.lines); gsap.to(t.lines, { yPercent: 0, duration: MOTION.reveal.duration, ease: 'reveal', stagger: t.stagger, delay: t.delay, overwrite: true }); };
  t.hide = () => { if (!t.shown || !t.lines || t.once) return; t.shown = false; gsap.killTweensOf(t.lines); gsap.to(t.lines, { yPercent: 110, duration: MOTION.hide.duration, ease: 'hide', overwrite: true }); };
  texts.push(t); return t;
}
document.querySelectorAll('.split').forEach((el) => makeText(el));
const chars = [];
document.querySelectorAll('.st .big').forEach((el) => { const c = { el, shown: false }; SplitText.create(el, { type: 'chars', charsClass: 'char', onSplit(self) { c.chars = self.chars; gsap.set(self.chars, { opacity: c.shown ? 1 : 0 }); } });
  c.reveal = () => { if (c.shown || !c.chars) return; c.shown = true; gsap.to(c.chars, { opacity: 1, duration: 0.5, stagger: 0.014, ease: 'power2.out', overwrite: true }); };
  c.hide = () => { if (!c.shown || !c.chars) return; c.shown = false; gsap.to(c.chars, { opacity: 0, duration: 0.3, overwrite: true }); }; chars.push(c); });
const heroWords = [...document.querySelectorAll('.hero .word')];
gsap.set(heroWords.map((w) => w.querySelector('.main')), { yPercent: 110 });
let heroShown = false;
heroWords.forEach((w) => { const main = w.querySelector('.main'), alt = w.querySelector('.alt'); gsap.set(alt, { yPercent: 100 });
  w.addEventListener('mouseenter', () => { gsap.to(main, { yPercent: -100, duration: 0.8, ease: 'reveal', overwrite: true }); gsap.to(alt, { yPercent: 0, duration: 0.8, ease: 'reveal', overwrite: true }); });
  w.addEventListener('mouseleave', () => { gsap.to(main, { yPercent: 0, duration: 0.8, ease: 'reveal', overwrite: true }); gsap.to(alt, { yPercent: 100, duration: 0.8, ease: 'reveal', overwrite: true }); }); });

// ───────────────────────── Lenis (the clock) ─────────────────────────
const lenis = new Lenis({ lerp: 0.1, smoothWheel: true }); window.__lenis = lenis;
lenis.stop();
let scroll = 0, vh = innerHeight, vw = innerWidth;
document.querySelectorAll('.nav a[data-to]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); lenis.scrollTo('#' + a.dataset.to, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) }); }));

// ───────────────────────── Three: a light world ─────────────────────────
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = LIGHT.exposure;
const scene = new THREE.Scene();
const skyColor = new THREE.Color(SKY.bottom); scene.background = skyColor; scene.fog = new THREE.Fog(skyColor.clone(), 14, 46);
const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 200);
camera.rotation.set(CAMERA.pitch, 0, 0);                                     // Léo: rotation ranges are 0 — it never turns
const mouse = { x: 0, y: 0, hx: 0, hy: 0 };
const tmpC = new THREE.Color();
const key = new THREE.DirectionalLight(LIGHT.key.color, LIGHT.key.intensity); key.position.set(5, 10, 9); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -12; key.shadow.camera.right = 12; key.shadow.camera.top = 12; key.shadow.camera.bottom = -12; key.shadow.camera.near = 1; key.shadow.camera.far = 50; key.shadow.bias = -0.0006; key.shadow.radius = 6; scene.add(key, key.target);
const hemi = new THREE.HemisphereLight(LIGHT.hemi.sky, LIGHT.hemi.ground, LIGHT.hemi.intensity); scene.add(hemi);

function stoneTexture(base = 150, rows = 8, spread = 30) { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d'); g.fillStyle = `rgb(${base - 24},${base - 26},${base - 32})`; g.fillRect(0, 0, 512, 512);
  const h = 512 / rows; for (let r = 0; r < rows; r++) { const off = (r % 2) * 64; let x = -off; while (x < 512) { const w = 96 + Math.floor(Math.random() * 64); const v = base + Math.floor(Math.random() * spread); g.fillStyle = `rgb(${v + 6},${v + 2},${v - 6})`; g.fillRect(x + 2, r * h + 2, w - 4, h - 4); x += w; } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const postMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
const slabMat = new THREE.MeshStandardMaterial({ color: 0xa8a294, roughness: 0.9 });
const slabTop = new THREE.MeshStandardMaterial({ color: 0xbdb7a8, roughness: 0.95 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.8 });
const rungMat = new THREE.MeshStandardMaterial({ color: 0xa8865c, roughness: 0.75 });

// ───────────────────────── The tiger rig (procedural placeholder with a clip grammar) ─────────────────────────
const C = { o: 0xF2A93B, k: 0x2A2320, w: 0xF6F1E6, p: 0xF08A8A, e: 0x141414 };
const M = {}; for (const k in C) M[k] = new THREE.MeshStandardMaterial({ color: C[k], roughness: 0.88 });
const mesh = (geo, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
const DOWN = new THREE.Vector3(0, -1, 0);
const HIPH = TIGER.hipH, PAWY = -HIPH + 0.1;              // standing hip height; paw-centre height when planted on the ground
const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _f = V(), _g = V(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
// hips-frame matrix for a given placement: T(pos) · Ry(yaw) · Rz(pitch) · T(off) · Rx(roll)
function hipsMatrix(pos, yaw, pitch, off, roll, out) { out.makeTranslation(pos.x, pos.y, pos.z); out.multiply(_m3.makeRotationY(yaw)); out.multiply(_m3.makeRotationZ(pitch)); out.multiply(_m3.makeTranslation(off.x, off.y, off.z)); out.multiply(_m3.makeRotationX(roll)); return out; }
// piecewise-smooth interpolation of vectors of numbers over keys
function keys(w, ks, vs, out) { let i = 0; while (i < ks.length - 2 && w > ks[i + 1]) i++; const t = smooth((w - ks[i]) / (ks[i + 1] - ks[i])); for (let j = 0; j < vs[i].length; j++) out[j] = lerp(vs[i][j], vs[i + 1][j], t); return out; }

class Rig {
  constructor() {
    this.root = new THREE.Group();                                      // world: position = hips anchor, rotation.y = yaw
    this.pitch = new THREE.Group(); this.root.add(this.pitch);          // rotation.z: 0 standing → π/2 vertical on the ladder
    this.hips = new THREE.Group(); this.pitch.add(this.hips);           // body frame: forward +x, up +y, right +z
    const H = this.hips;
    this.torso = new THREE.Group(); H.add(this.torso);
    const bodyM = mesh(new THREE.CapsuleGeometry(0.29, 0.36, 6, 16), M.o, 0, 0, 0, this.torso); bodyM.rotation.z = HALF;
    const belly = mesh(new THREE.CapsuleGeometry(0.2, 0.34, 4, 12), M.w, 0.03, -0.14, 0, this.torso); belly.rotation.z = HALF; belly.scale.set(1, 0.7, 1.05);
    for (const x of [-0.27, -0.05, 0.19]) { const g = new THREE.TorusGeometry(0.296, 0.032, 6, 22, Math.PI * 1.25); g.rotateZ(-Math.PI / 8); g.rotateY(HALF); mesh(g, M.k, x, 0, 0, this.torso); }
    // head (yaw about y, pitch about z, roll about x)
    this.head = new THREE.Group(); this.head.position.set(0.54, 0.3, 0); this.head.rotation.order = 'YZX'; H.add(this.head);
    const hd = this.head;
    const skull = mesh(new THREE.SphereGeometry(0.36, 24, 18), M.o, 0.02, 0, 0, hd); skull.scale.set(1, 0.92, 1);
    this.ears = [-0.26, 0.26].map((z) => { const e = new THREE.Group(); e.position.set(-0.02, 0.26, z); hd.add(e); mesh(new THREE.SphereGeometry(0.12, 12, 10), M.o, 0, 0.05, 0, e); mesh(new THREE.SphereGeometry(0.06, 10, 8), M.p, 0.05, 0.06, 0, e); return e; });
    const muzzle = mesh(new THREE.SphereGeometry(0.17, 14, 12), M.w, 0.27, -0.1, 0, hd); muzzle.scale.set(0.85, 0.6, 1);
    mesh(new THREE.SphereGeometry(0.045, 8, 8), M.p, 0.41, -0.03, 0, hd);
    this.eyes = new THREE.Group(); hd.add(this.eyes);
    for (const z of [-0.15, 0.15]) { mesh(new THREE.SphereGeometry(0.075, 12, 10), M.w, 0.29, 0.08, z, this.eyes); mesh(new THREE.SphereGeometry(0.042, 10, 8), M.e, 0.35, 0.085, z * 0.95, this.eyes); mesh(new THREE.SphereGeometry(0.014, 6, 6), M.w, 0.386, 0.11, z * 0.95 - 0.02, this.eyes); }
    for (const [y, w] of [[0.25, 0.14], [0.18, 0.2], [0.11, 0.14]]) mesh(new THREE.BoxGeometry(0.03, 0.032, w), M.k, 0.315, y, 0, hd);
    for (const z of [-0.3, 0.3]) mesh(new THREE.BoxGeometry(0.03, 0.1, 0.05), M.k, 0.21, -0.02, z, hd);
    for (const z of [-1, 1]) for (const a of [-0.25, 0, 0.25]) { const wk = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 4), M.k, 0.34, -0.09 + a * 0.06, z * 0.2, hd); wk.rotation.x = z * HALF; wk.rotation.z = a; }
    // tail: three segments hanging off the rump
    this.tail = []; let parent = H, pos = new THREE.Vector3(-0.42, 0.12, 0);
    for (let i = 0; i < 3; i++) { const g = new THREE.Group(); g.position.copy(pos); parent.add(g); const s = mesh(new THREE.CapsuleGeometry(0.056 - i * 0.008, 0.2, 4, 8), i === 2 ? M.k : M.o, -0.14, 0, 0, g); s.rotation.z = HALF; this.tail.push(g); parent = g; pos = new THREE.Vector3(-0.27, 0, 0); }
    // limbs: 0 front-left (−z), 1 front-right, 2 hind-left, 3 hind-right; two bones + paw, solved by IK
    this.limbs = [this.limb(0.44, -0.1, -0.22, 0.34, 0.34), this.limb(0.44, -0.1, 0.22, 0.34, 0.34), this.limb(-0.4, -0.1, -0.2, 0.33, 0.33), this.limb(-0.4, -0.1, 0.2, 0.33, 0.33)];
    this.pose = { pos: V(), yaw: 0, pitch: 0, off: V(), roll: 0, headYaw: 0, headPitch: 0, headRoll: 0, tailCurl: -0.45, poleMix: 0, targets: [V(), V(), V(), V()], world: [false, false, false, false] };
  }
  limb(x, y, z, L1, L2) {
    const joint = new THREE.Group(); joint.position.set(x, y, z); this.hips.add(joint);
    mesh(new THREE.CapsuleGeometry(0.105, L1 - 0.16, 4, 10), M.o, 0, -L1 / 2, 0, joint);
    const lower = new THREE.Group(); lower.position.y = -L1; joint.add(lower);
    mesh(new THREE.CapsuleGeometry(0.09, L2 - 0.14, 4, 10), M.o, 0, -L2 / 2, 0, lower);
    const paw = mesh(new THREE.SphereGeometry(0.13, 12, 10), M.w, 0, -L2 + 0.02, 0, lower); paw.scale.set(1.15, 0.8, 1.1);
    return { joint, lower, L1, L2, side: Math.sign(z), front: x > 0 };
  }
  // Place the body from the pose (so world↔hips conversions are current), then solve each limb toward its target
  // (targets in the hips frame, or in world when `world[i]`).
  place() { const P = this.pose; this.root.position.copy(P.pos); this.root.rotation.y = P.yaw; this.pitch.rotation.z = P.pitch; this.hips.position.copy(P.off); this.hips.rotation.x = P.roll; this.root.updateMatrixWorld(true); }
  apply() {
    const P = this.pose; this.place();
    this.head.rotation.set(P.headRoll, P.headYaw, P.headPitch);
    _m.copy(this.hips.matrixWorld).invert();
    for (let i = 0; i < 4; i++) { const L = this.limbs[i]; const T = _a.copy(P.targets[i]); if (P.world[i]) T.applyMatrix4(_m);
      // IK pole: standing → elbows back / knees forward; on the ladder → joints point away from the wall (+y) and outward
      const pole = _b.set(L.front ? -1 : 1, 0, L.side * 0.2).multiplyScalar(1 - P.poleMix).addScaledVector(_c.set(L.front ? -0.35 : 0.35, 1, L.side * 0.45), P.poleMix);
      solve(L, T, pole); }
  }
}
function solve(L, T, pole) {
  const J = L.joint.position; const d = _c.copy(T).sub(J); let dist = d.length(); if (dist < 1e-4) { d.set(0, -1, 0); dist = 1e-4; }
  const maxR = L.L1 + L.L2 - 0.004; const u = _d.copy(d).divideScalar(dist); dist = clamp(dist, 0.02, maxR);
  const pu = pole.dot(u); const p = _e.copy(pole).addScaledVector(u, -pu); if (p.lengthSq() < 1e-6) p.set(1, 0, 0).addScaledVector(u, -u.x); p.normalize();
  const cosA = clamp((L.L1 * L.L1 + dist * dist - L.L2 * L.L2) / (2 * L.L1 * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const dir1 = _f.copy(u).multiplyScalar(cosA).addScaledVector(p, sinA).normalize();
  const mid = _g.copy(dir1).multiplyScalar(L.L1).add(J);
  const dir2 = _c.copy(J).addScaledVector(u, dist).sub(mid).normalize();
  _q.setFromUnitVectors(DOWN, dir1); L.joint.quaternion.copy(_q);
  _q2.setFromUnitVectors(DOWN, dir2); L.lower.quaternion.copy(_q.invert().multiply(_q2));
}
const rig = new Rig(); scene.add(rig.root);
const tigerHit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 1.5), new THREE.MeshBasicMaterial({ visible: false })); scene.add(tigerHit);

// ── standing paw targets (hips frame) and the climb bands (Laurens: clips scrubbed by scroll; feet on alternate rungs)
const STAND = [[0.46, PAWY, -0.22], [0.46, PAWY, 0.22], [-0.42, PAWY, -0.2], [-0.42, PAWY, 0.2]].map((a) => new THREE.Vector3(...a));
const WALL = -0.36;                                                                     // paw centre on the rung, in the hips frame (belly = −y)
const CLIMB = [ { ph: 0.25, lo: 0.67, planted: 0.6, z: -0.22 }, { ph: 0.75, lo: 0.67, planted: 0.6, z: 0.22 },        // hands (front paws)
                { ph: 0.5, lo: -0.98, planted: 0.78, z: -0.2 }, { ph: 0.0, lo: -0.98, planted: 0.78, z: 0.2 } ];       // feet
CLIMB.forEach((b) => { b.hi = b.lo + TIGER.step * b.planted; });
// layout tiers: phones get a narrower frame, so the camera shifts right, opens up, and the tiger hangs lower
const LAY = { mobile: false, camX: CAMERA.x, fov: CAMERA.fov, glue: TIGER.glue, H0: 0, RUNG0: 0, drift: 1 };
function tune() { LAY.mobile = vw < 820 || (vh > vw && vw < 1024);
  LAY.camX = LAY.mobile ? 1.15 : CAMERA.x; LAY.fov = LAY.mobile ? 40 : CAMERA.fov; LAY.glue = LAY.mobile ? 1.55 : TIGER.glue; LAY.drift = LAY.mobile ? 0.5 : 1;
  LAY.H0 = -RATE * TIGER.edgeEnd - LAY.glue;                                                // hips y when the climb cycle is at c = 0
  LAY.RUNG0 = LAY.H0 + CLIMB[3].lo;                                                         // the rung the right foot lands on at c = 0; rungs every TIGER.rung
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LAY.mobile ? 1.25 : 1.5)); key.shadow.mapSize.set(LAY.mobile ? 1024 : 2048, LAY.mobile ? 1024 : 2048); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
const cycleAt = (hipsY) => (LAY.H0 - hipsY) / TIGER.step;                                 // clip time is a function of world height = scroll
// one limb's climb target in the hips frame at cycle time c (planted: rides up with the ladder; swing: drops to the next rung with an arc)
function climbTarget(i, c, out) { const b = CLIMB[i]; const u = frac(c - b.ph);
  if (u < b.planted) out.set(b.lo + (b.hi - b.lo) * (u / b.planted), WALL, b.z);
  else { const w = (u - b.planted) / (1 - b.planted); const e = smooth(w); out.set(b.hi + (b.lo - b.hi) * e, WALL + 0.16 * Math.sin(Math.PI * w), b.z + b.z * 0.35 * Math.sin(Math.PI * w)); }
  return out; }

// ───────────────────────── World built from the layout (after measure) ─────────────────────────
const stoneTex = stoneTexture(168, 12, 18); const sideTex = stoneTexture(150, 12, 18); const pierTex = stoneTexture(182, 14, 16);
const wallMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 });
const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.95 });
const pierMat = new THREE.MeshStandardMaterial({ map: pierTex, roughness: 0.95 });
const world = { objs: [], ledges: [], groundY: 0, landS: 0, camYMin: 0 };
const camYAt = (s) => -RATE * s;                                                         // the rail: screens → camera y (clamped at the landing)
const hipsGlued = (s) => camYAt(s) - LAY.glue;
function buildWorld() {
  world.objs.forEach((o) => scene.remove(o)); world.objs = []; world.ledges = []; window.__world = world; window.__scene = scene;
  const X = TIGER.x, L = TIGER.ledgeY;
  // the landing: the last window's bottom minus 1.5 screens = the feet touch the ground; the camera stops there
  const wl = R.windows[R.windows.length - 1]; world.landS = (wl.top + wl.h) / vh - 1.5; world.camYMin = camYAt(world.landS);
  world.groundY = hipsGlued(world.landS) - 1.05;
  const G = world.groundY;
  // pier: the tiger's tower on the right, platform on top, ladder down its face
  const pier = new THREE.Group(); scene.add(pier); world.objs.push(pier);
  const pH = L - (G - 2); pierTex.repeat.set(2.4, pH / 2.6);
  const block = new THREE.Mesh(new THREE.BoxGeometry(6, pH, 2.5), pierMat); block.position.set(X + 1.5, (L + G - 2) / 2, -1.35); block.castShadow = true; block.receiveShadow = true; pier.add(block);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.18, 2.7), slabTop); lip.position.set(X + 1.5, L - 0.09, -1.35); lip.receiveShadow = true; lip.castShadow = true; pier.add(lip);
  const railTop = L + 1.25, railH = railTop - (G + 0.05);      // the ladder pokes up past the platform edge, like a real one
  for (const sx of [-0.5, 0.5]) { const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, railH, 8), woodMat); rail.position.set(X + sx, (railTop + G + 0.05) / 2, TIGER.ladderZ); rail.castShadow = true; pier.add(rail);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), woodMat); bar.position.set(X + sx, L + 1.0, TIGER.ladderZ - 0.16); pier.add(bar); }
  const rungGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8); rungGeo.rotateZ(HALF);
  const topRung = LAY.RUNG0 + TIGER.rung * Math.floor((railTop - 0.15 - LAY.RUNG0) / TIGER.rung);
  const nR = Math.floor((topRung - (G + 0.25)) / TIGER.rung) + 1; const rungs = new THREE.InstancedMesh(rungGeo, rungMat, nR); rungs.castShadow = true;
  { const mm = new THREE.Matrix4(); for (let j = 0; j < nR; j++) { mm.makeTranslation(X, topRung - j * TIGER.rung, TIGER.ladderZ); rungs.setMatrixAt(j, mm); } }
  pier.add(rungs);
  // shaft walls
  const yTop = L + 14, yBottom = G - 2, Hh = yTop - yBottom; stoneTex.repeat.set(10, Hh / 4); sideTex.repeat.set(3, Hh / 4);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, Hh), wallMat); back.position.set(0, (yTop + yBottom) / 2, -2.8); back.receiveShadow = true; scene.add(back); world.objs.push(back);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(12, Hh), sideMat); side.position.set(-11, (yTop + yBottom) / 2, 3.2); side.rotation.y = HALF; side.receiveShadow = true; scene.add(side); world.objs.push(side);
  // ledges with torches on the left wall, one per card, at the tiger's feet when that card is centred
  document.querySelectorAll('.card').forEach((el) => { const r = el.getBoundingClientRect(); const top = r.top + scroll; const sC = (top - vh / 2) / vh; const y = hipsGlued(sC) - 0.9; el.dataset.s = sC;
    const g = new THREE.Group(); scene.add(g); world.objs.push(g);
    const w = LEDGE_X[1] - LEDGE_X[0], cx = (LEDGE_X[0] + LEDGE_X[1]) / 2;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 2.2), slabMat); slab.position.set(cx, y - 0.25, -1.7); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.05, 2.1), slabTop); t2.position.set(cx, y + 0.02, -1.7); t2.receiveShadow = true; g.add(t2);
    const tx = LEDGE_X[1] - 0.7;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.3, 6), postMat); post.position.set(tx, y + 0.65, -2.2); post.castShadow = true; g.add(post);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffe2b8, emissive: 0xffc46a, emissiveIntensity: 1.2, roughness: 1 })); flame.position.set(tx, y + 1.36, -2.2); g.add(flame);
    const light = new THREE.PointLight(LIGHT.torch.color, LIGHT.torch.intensity, LIGHT.torch.distance, 2); light.position.set(tx, y + 1.5, -1.6); g.add(light);
    world.ledges.push({ s: sC, el, seed: Math.random() * 10, flame, light, glanced: false }); });
  // the shore (meadow at the bottom)
  const shore = new THREE.Group(); scene.add(shore); world.objs.push(shore);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 60, 60, 40), new THREE.MeshStandardMaterial({ color: 0x86b56a, roughness: 1 }));
  { const pos = ground.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getY(i); pos.setZ(i, 0.14 * Math.sin(x * 0.4) * Math.cos(z * 0.35) + 0.06 * Math.sin(x * 1.3 + z)); } ground.geometry.computeVertexNormals(); }
  ground.rotation.x = -HALF; ground.position.set(0, G, 4); ground.receiveShadow = true; shore.add(ground);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), new THREE.MeshStandardMaterial({ color: 0xa9d3e2, roughness: 0.25, metalness: 0.1 })); water.rotation.x = -HALF; water.position.set(0, G - 0.12, 26); shore.add(water);
  const bank = new THREE.Mesh(new THREE.BoxGeometry(90, 0.5, 2.4), new THREE.MeshStandardMaterial({ color: 0xa08f6a, roughness: 1 })); bank.position.set(0, G - 0.3, 12); shore.add(bank);
  const gN = LAY.mobile ? 400 : 900; const grass = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.42, 0.07), new THREE.MeshStandardMaterial({ color: 0x93c979, roughness: 1 }), gN);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < gN; i++) { let x = (Math.random() - 0.5) * 30, z = 11 - Math.random() * 24; if (x > X - 1.6 && z < -0.1) x -= 6; e.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4); q.setFromEuler(e); p.set(x, G + 0.16, z); sc.set(1, 0.6 + Math.random() * 0.9, 1); mm.compose(p, q, sc); grass.setMatrixAt(i, mm); }
  grass.castShadow = true; shore.add(grass);
  const petalCols = [0xf6c1cf, 0xffe28a, 0xffffff, 0xf2a93b, 0xc7b8ff];
  for (let i = 0; i < 60; i++) { let x = (Math.random() - 0.5) * 26, z = 10 - Math.random() * 20; if (x > X - 1.6 && z < -0.1) x -= 6; const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4), new THREE.MeshStandardMaterial({ color: 0x5fa04a })); stem.position.set(x, G + 0.22, z); shore.add(stem); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: petalCols[i % petalCols.length], roughness: 0.8 })); hd.position.set(x, G + 0.46, z); shore.add(hd); }
  for (const [x, z, s] of [[-7, -1.2, 1.2], [-11, 4, 1.5], [10, 6, 1.1], [-4, 8, 0.9]]) { const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.28 * s, 1.5 * s, 7), new THREE.MeshStandardMaterial({ color: 0x6a4d38 })); trunk.position.set(x, G + 0.75 * s, z); trunk.castShadow = true; shore.add(trunk); const crown = new THREE.Mesh(new THREE.SphereGeometry(1.3 * s, 12, 10), new THREE.MeshStandardMaterial({ color: 0x74b25a, roughness: 1 })); crown.position.set(x, G + 2.2 * s, z); crown.castShadow = true; shore.add(crown); }
}

// ───────────────────────── Layout ─────────────────────────
const R = {};
function measure() {
  vh = innerHeight; vw = innerWidth;
  for (const id of ['header', 'hero', 'intro', 'win0', 'archives', 'footer']) { const el = $(id); const r = el.getBoundingClientRect(); R[id] = { top: r.top + scroll, h: r.height }; }
  R.windows = WINDOWS.map((_, w) => { const r = $('win' + w).getBoundingClientRect(); return { top: r.top + scroll, h: r.height }; });
  texts.forEach((t) => { const r = t.el.getBoundingClientRect(); t.top = r.top + scroll; t.h = r.height; });
  chars.forEach((c) => { const r = c.el.getBoundingClientRect(); c.top = r.top + scroll; c.h = r.height; });
  tune(); renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.fov = LAY.fov; camera.updateProjectionMatrix();
  buildWorld();
}

// ───────────────────────── cursor / quip / loader ─────────────────────────
const cursor = $('cursor'), pill = $('cursor-pill'); let pillShown = false, pillText = '';
const mx = { x: -100, y: -100, cx: -100, cy: -100 };
window.addEventListener('pointermove', (e) => { mx.x = e.clientX; mx.y = e.clientY; mouse.x = (e.clientX / vw) * 2 - 1; mouse.y = (e.clientY / vh) * 2 - 1; });
function setPill(text) { if (text === pillText) return; pillText = text; if (text) { pill.textContent = text; if (!pillShown) { pillShown = true; gsap.to(pill, { '--reveal': 1, duration: MOTION.cursor.inDuration, ease: MOTION.cursor.inEase, overwrite: true }); } } else if (pillShown) { pillShown = false; gsap.to(pill, { '--reveal': 0, duration: MOTION.cursor.outDuration, ease: MOTION.cursor.outEase, overwrite: true }); } }
const quipEl = $('quip'); const v3 = new THREE.Vector3();
const T = { blinkAt: 2.5, blink: false, earAt: 3, ear: 0, quipT: 0, quip: '', sit: 0, waveAt: 2.5, wave: 0, glance: { y: 0, p: 0 }, hover: { y: 0, p: 0 }, headY: 0, headP: 0, tailV: 0 };
function say(text, dur = 2.6, who = 'KOOKYTIGER') { T.quip = text; T.quipT = dur; quipEl.textContent = text; quipEl.dataset.who = who + '  '; }
function glance(yaw, pitch) { const g = TIGER.glance; gsap.killTweensOf(T.glance); gsap.timeline().to(T.glance, { y: yaw, p: pitch, duration: g.turn, ease: 'power2.out' }).to(T.glance, { y: 0, p: 0, duration: g.back, ease: 'power2.inOut' }, `+=${g.hold}`); }
const ray = new THREE.Raycaster(); let hoverTiger = false;
canvas.addEventListener('click', () => { if (!hoverTiger) return; glance(1.9, 0.6); T.waveAt = 0; say(['kooky.', 'again?', 'which floor is this.', 'that tickles.'][Math.floor(Math.random() * 4)]); });
let booted = false;
(async () => {
  const t0 = performance.now(); let p = 0;
  const tick = () => { const el = performance.now() - t0; p = Math.min(0.92, el / 1400); $('ld-pct').textContent = String(Math.round(p * 100)).padStart(3, '0'); $('ld-bar').style.width = (p * 100).toFixed(1) + '%'; if (!booted) requestAnimationFrame(tick); };
  tick();
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  await new Promise((r) => setTimeout(r, Math.max(0, 1400 - (performance.now() - t0))));
  booted = true; $('ld-pct').textContent = '100'; $('ld-bar').style.width = '100%';
  measure();
  setTimeout(() => { $('loader').classList.add('off'); lenis.start(); }, 250);
  setTimeout(() => { const st = texts.find((t) => t.el.id === 'h-statement'); const sc = texts.find((t) => t.el.id === 'h-scroll'); st && (st.stagger = MOTION.reveal.heroStagger, st.reveal()); sc && setTimeout(() => sc.reveal(), 500); }, 250 + 900);
})();

// ───────────────────────── Character states (each a function of the scroll phase → pose) ─────────────────────────
const P = rig.pose; const wp = [V(), V(), V(), V()];   // scratch world points
const platformCentre = () => _a.set(TIGER.x, TIGER.ledgeY + HIPH, -1.0);
const stepLift = (u, o, len = 0.3) => Math.sin(Math.PI * clamp((u - o) / len, 0, 1));
function setStand(pos, yaw, pitch = 0) { P.pos.copy(pos); P.yaw = yaw; P.pitch = pitch; P.off.set(0, 0, 0); P.roll = 0; P.poleMix = 0; P.tailCurl = -0.45; for (let i = 0; i < 4; i++) { P.targets[i].copy(STAND[i]); P.world[i] = false; } }
// idle on the platform, facing you
function stIdle(t) { setStand(platformCentre(), 3 * HALF); P.headYaw = 0.12 * Math.sin(t * 0.7); P.headPitch = 0.04 + 0.05 * Math.sin(t * 1.1); P.headRoll = 0; }
// turnToWall: 180° in place with four little steps (scrubbed)
function stTurn(u, t) { setStand(platformCentre(), 3 * HALF - Math.PI * smooth(u)); const o = [0.05, 0.4, 0.22, 0.58]; for (let i = 0; i < 4; i++) P.targets[i].y += 0.12 * stepLift(u, o[i]); P.headYaw = -0.35 * Math.sin(Math.PI * u); P.headPitch = 0.05; P.headRoll = 0; P.off.y = -0.02 * Math.sin(Math.PI * 2 * u); }
// overEdge (scrubbed): back up to the edge, rear over it (hind feet find the top rungs while the hands hold the platform),
// then lower until the hands take the top rung — from there the climb loop owns the limbs.
const EDGE_KEYS = [0, 0.25, 0.5, 1];
function stEdge(u, s) { const X = TIGER.x, L = TIGER.ledgeY; const back = seg(u, [0, 0.3]), w = seg(u, [0.3, 1]);
  const k = keys(w, EDGE_KEYS, [[L + HIPH - 0.06, -0.45, 0.25], [L + 0.45, 0.1, 1.15], [L + 0.02, 0.3, 1.5], [hipsGlued(s), 0.33, HALF]], [0, 0, 0]);
  const hy = u < 0.3 ? L + HIPH - 0.06 * back : k[0], hz = u < 0.3 ? lerp(-1.0, -0.45, smooth(back)) : k[1], pitch = u < 0.3 ? 0.25 * smooth(back) : k[2];
  P.pos.set(X, hy, hz); P.yaw = HALF; P.pitch = pitch; P.off.set(0, 0, 0); P.roll = 0; P.poleMix = pitch / HALF; P.tailCurl = -0.45 * (1 - P.poleMix);
  P.headYaw = 0; P.headPitch = lerp(0.1, -0.45, smooth(w)); P.headRoll = 0;
  rig.place(); const c = cycleAt(hy);
  for (let i = 0; i < 4; i++) { const b = CLIMB[i]; const side = b.z > 0 ? 1 : -1; const hand = i < 2;
    if (u < 0.3) { P.targets[i].copy(STAND[i]).setY(PAWY + 0.1 * stepLift(back, [0.1, 0.55, 0.35, 0.75][i], 0.25)); P.world[i] = false; continue; }
    const ct = climbTarget(i, c, _d); const cw = _c.copy(ct).applyMatrix4(rig.hips.matrixWorld);   // where the loop wants this paw, in world
    let blend;
    if (hand) { const ws = seg(w, [0.08, 0.36]); wp[i].set(X + side * 0.22, L + 0.1 + 0.14 * Math.sin(Math.PI * ws), lerp(-0.9, -0.16, smooth(ws))); blend = smooth(seg(w, [0.42 + (side > 0 ? 0 : 0.1), 0.62 + (side > 0 ? 0 : 0.1)])); }
    else { wp[i].set(X + side * 0.2, L + 0.1, -0.05); blend = smooth(seg(w, [0.06 + (side > 0 ? 0 : 0.08), 0.26 + (side > 0 ? 0 : 0.08)])); }
    if (blend <= 0) { P.targets[i].copy(wp[i]); P.world[i] = true; }
    else if (blend >= 1) { P.targets[i].copy(ct); P.world[i] = false; }
    else { P.targets[i].copy(wp[i]).lerp(cw, smooth(blend)); P.targets[i].y += 0.12 * Math.sin(Math.PI * blend); P.world[i] = true; } } }
// climbing: the loop, scrubbed by scroll — the tiger holds its place, the ladder rises past it
function stClimb(s, t) { const hy = hipsGlued(s); const c = cycleAt(hy);
  P.pos.set(TIGER.x, hy, 0.33); P.yaw = HALF; P.pitch = HALF; P.poleMix = 1; P.tailCurl = 0;
  swayOff(c, P.off); P.roll = 0.06 * Math.sin(2 * Math.PI * c);
  P.headYaw = 0; P.headPitch = -0.42 + 0.06 * Math.sin(2 * Math.PI * c); P.headRoll = 0;
  for (let i = 0; i < 4; i++) { climbTarget(i, c, P.targets[i]); P.world[i] = false; } }
// landing (scrubbed): feet reach the grass, hands let go, the body comes down onto all fours
const swayOff = (c, out) => out.set(0.012 * Math.sin(4 * Math.PI * c), 0.02 * Math.sin(4 * Math.PI * c + 1), 0.045 * Math.sin(2 * Math.PI * c));
function stLand(u) { const X = TIGER.x, G = world.groundY, hL = hipsGlued(world.landS), cL = cycleAt(hL); const e = smooth(u);
  const hz = lerp(0.33, 0.95, e), hy = lerp(hL, G + HIPH, e), pitch = lerp(HALF, 0, e);
  P.pos.set(X, hy, hz); P.yaw = HALF; P.pitch = pitch; P.off.set(0, 0, 0); P.roll = 0; P.poleMix = pitch / HALF; P.tailCurl = -0.45 * (1 - P.poleMix);
  P.headYaw = 0; P.headPitch = lerp(-0.42, 0.05, e); P.headRoll = 0;
  hipsMatrix(_a.set(X, hL, 0.33), HALF, HALF, swayOff(cL, _b), 0.06 * Math.sin(2 * Math.PI * cL), _m2);     // the pose at the moment the feet touched
  const o = [0.45, 0.58, 0.0, 0.12];
  for (let i = 0; i < 4; i++) { const side = CLIMB[i].z > 0 ? 1 : -1; const front = i < 2; const w = smooth(seg(u, [o[i], o[i] + 0.4]));
    wp[i].set(X + side * (front ? 0.22 : 0.2), G + 0.1, 0.95 + (front ? -0.46 : 0.42));
    const frozen = climbTarget(i, cL, _d).applyMatrix4(_m2);                                                    // world-fixed: still on its rung
    P.targets[i].copy(frozen).lerp(wp[i], w); P.targets[i].y += 0.14 * Math.sin(Math.PI * w); P.world[i] = true; } }
// turnAround: back to you, on the grass (scrubbed)
function stTurnBack(u) { setStand(_a.set(TIGER.x, world.groundY + HIPH, 0.95), HALF + Math.PI * smooth(u)); const o = [0.05, 0.4, 0.22, 0.58]; for (let i = 0; i < 4; i++) P.targets[i].y += 0.12 * stepLift(u, o[i]); P.headYaw = 0.35 * Math.sin(Math.PI * u); P.headPitch = 0.05; P.headRoll = 0; }
// sit (time-driven once landed and turned, like Laurens's putDown), then idle + the occasional wave
function stSit(t, dt) { const X = TIGER.x, G = world.groundY, k = smooth(T.sit);
  P.pos.set(X, lerp(G + HIPH, G + 0.56, k), 0.95); P.yaw = 3 * HALF; P.pitch = 0.32 * k; P.off.set(0, 0, 0); P.roll = 0; P.poleMix = 0; P.tailCurl = -0.45;
  const wv = T.waveK; P.headYaw = 0.1 * Math.sin(t * 0.6) + 0.18 * wv; P.headPitch = 0.02 + 0.04 * Math.sin(t * 1.3); P.headRoll = 0.14 * wv;
  wp[0].set(X - 0.22, G + 0.1, 0.95 - 0.45); wp[1].set(X + 0.22, G + 0.1, 0.95 - 0.45); wp[2].set(X - 0.25, G + 0.1, 0.95 + lerp(0.42, 0.02, k)); wp[3].set(X + 0.25, G + 0.1, 0.95 + lerp(0.42, 0.02, k));
  if (wv > 0) wp[1].lerp(_a.set(X + 0.36 + 0.05 * Math.sin(t * 14), G + 0.92 + 0.04 * Math.sin(t * 14 + 1), 0.95 - 0.25), wv);
  for (let i = 0; i < 4; i++) { P.targets[i].copy(wp[i]); P.world[i] = true; } }

// ───────────────────────── Frame ─────────────────────────
let last = performance.now(), shoreMix = 0, vel = 0, lastScroll = 0, saidShore = false, state = '';
const tiltEls = [document.querySelector('.hero .words'), document.querySelector('.shore-text')];
const skyTarget = new THREE.Color(SKY.bottom);
function frame(now) {
  const dt = SNAP ? 0.2 : Math.min(0.05, (now - last) / 1000); last = now;
  lenis.raf(now); scroll = lenis.animatedScroll ?? scrollY;
  if (!R.win0) measure();
  const t = now / 1000, s = scroll / vh;
  vel += (((scroll - lastScroll) / Math.max(dt, 1e-3)) - vel) * Math.min(1, dt * 6); lastScroll = scroll;

  // ── header: Léo's parallax + fade
  const headerP = clamp(scroll / R.header.h, 0, 1);
  const hc = document.querySelector('.header .content');
  hc.style.transform = `translate3d(0, ${(-headerP * MOTION.header.parallax * 0.35).toFixed(1)}px, 0)`;
  hc.style.opacity = 1 - smooth((headerP - MOTION.header.fadeStart) / (MOTION.header.fadeEnd - MOTION.header.fadeStart));

  // ── text reveals by local progress (replay on re-scroll)
  for (const tx of texts) { if (tx.el.id === 'h-statement' || tx.el.id === 'h-scroll') continue; const pr = (scroll + vh - tx.top) / (tx.h + vh * 0.35); if (pr > 0.12) tx.reveal(); else if (pr <= 0) tx.hide(); }
  for (const c of chars) { const pr = (scroll + vh - c.top) / (c.h + vh); if (pr > 0.3) c.reveal(); else if (pr <= 0) c.hide(); }
  if (!heroShown && scroll + vh > R.hero.top + vh * 0.35) { heroShown = true; gsap.to(heroWords.map((w) => w.querySelector('.main')), { yPercent: 0, duration: MOTION.reveal.duration, ease: 'reveal', stagger: MOTION.reveal.heroStagger }); }

  // ── the rail (Léo): camera = linear in scroll, everywhere; clamped when the tiger has landed
  const landed = s >= world.landS;
  const camY = Math.max(camYAt(s), world.camYMin);
  camera.position.set(LAY.camX, camY, CAMERA.z + CAMERA.header.rangeZ * (1 - clamp(s / CAMERA.header.screens, 0, 1)));
  key.position.set(5, camY + 9, 9); key.target.position.set(1, camY - 3, -1); key.target.updateMatrixWorld();

  // ── which window are we in? (for the sky tint + the cards)
  let inWindow = -1; R.windows.forEach((w, i) => { if (scroll + vh * 0.5 >= w.top && scroll + vh * 0.5 < w.top + w.h) inWindow = i; });
  const inWorld = scroll < R.hero.top - vh * 0.1 || inWindow >= 0;

  // ── the character state (Laurens): scrubbed by scroll; only the idle bits run on time
  const sl = world.landS; let next;
  if (s < TIGER.idleEnd) next = 'idle'; else if (s < TIGER.turnEnd) next = 'turn'; else if (s < TIGER.edgeEnd) next = 'edge'; else if (s < sl) next = 'climb';
  else if (s < sl + TIGER.landLen) next = 'land'; else if (s < sl + TIGER.landLen + TIGER.turnBackLen) next = 'turnBack'; else next = 'sit';
  if (next !== state) { state = next; if (state === 'land' && !saidShore) { saidShore = true; say(COPY.shore.tiger, 5); } if (state === 'climb') saidShore = false; }
  T.sit += ((state === 'sit' ? 1 : 0) - T.sit) * Math.min(1, dt * 3.5);
  if (state === 'sit') { T.waveAt -= dt; if (T.waveAt < 0) { T.waveAt = 6 + Math.random() * 5; T.wave = 1.6; } } else T.wave = 0;
  T.wave = Math.max(0, T.wave - dt); T.waveK = T.wave > 0 ? smooth(Math.min(1, T.wave / 0.3)) * smooth(Math.min(1, (1.6 - T.wave) / 0.25)) : 0;
  if (state === 'idle') stIdle(t); else if (state === 'turn') stTurn(seg(s, [TIGER.idleEnd, TIGER.turnEnd]), t); else if (state === 'edge') stEdge(seg(s, [TIGER.turnEnd, TIGER.edgeEnd]), s);
  else if (state === 'climb') stClimb(s, t); else if (state === 'land') stLand(seg(s, [sl, sl + TIGER.landLen])); else if (state === 'turnBack') stTurnBack(seg(s, [sl + TIGER.landLen, sl + TIGER.landLen + TIGER.turnBackLen])); else stSit(t, dt);

  // ── cards: alignment a = (card centre − viewport centre) in screens → drift (Laurens), the torches, the tiger's glance at each card
  let nearestA = 9, activeCat = null;
  for (const L of world.ledges) { const a = L.s - s;
    if (Math.abs(a) < Math.abs(nearestA)) { nearestA = a; activeCat = PIECES[+L.el.dataset.p].cat; }
    if (Math.abs(a) < 0.75) { const u = clamp(0.5 - a, 0, 1); L.el.style.transform = `translate3d(0, ${(lerp(MOTION.drift.from, MOTION.drift.to, u) * LAY.drift).toFixed(2)}vh, 0)`; }
    if (a < 0.14 && a > -0.5 && !L.glanced && state === 'climb') { L.glanced = true; glance(TIGER.glance.yaw, TIGER.glance.pitch); }
    if (a > 0.3 || a < -0.6) L.glanced = false;
    const flick = 1 + 0.08 * Math.sin(t * 9.3 + L.seed) + 0.05 * Math.sin(t * 17.1 + L.seed * 2); L.light.intensity = LIGHT.torch.intensity * flick * (1 - shoreMix * 0.7); L.flame.scale.setScalar(0.9 + 0.15 * flick); }
  if (Math.abs(nearestA) > 0.5) activeCat = null;

  // ── head layers: glance (Laurens timing) + hover look-back + idle bits
  const hoverLook = (hoverTiger || panelOpen) && state === 'climb' ? 1 : 0; T.hover.y += ((hoverLook ? 1.8 : 0) - T.hover.y) * Math.min(1, dt * 6); T.hover.p += ((hoverLook ? 0.55 : 0) - T.hover.p) * Math.min(1, dt * 6);
  P.headYaw += T.glance.y + T.hover.y; P.headPitch += T.glance.p + T.hover.p;
  T.blinkAt -= dt; if (T.blinkAt < 0) { T.blink = !T.blink; T.blinkAt = T.blink ? 0.12 : 2.2 + Math.random() * 3; }
  rig.eyes.scale.y += ((T.blink ? 0.08 : 1) - rig.eyes.scale.y) * Math.min(1, dt * 30);
  T.earAt -= dt; if (T.earAt < 0) { T.ear = 1; T.earAt = 2 + Math.random() * 4; } T.ear = Math.max(0, T.ear - dt * 4);
  rig.ears[0].rotation.x = -0.5 * Math.sin(Math.PI * Math.min(1, T.ear)); rig.ears[1].rotation.x = 0.2 * Math.sin(Math.PI * Math.min(1, T.ear));
  const breathe = 1 + Math.sin(t * 1.6) * 0.014; rig.torso.scale.set(1, breathe, breathe);
  T.tailV += (clamp(Math.abs(vel) / 900, 0, 1) - T.tailV) * Math.min(1, dt * 3);
  rig.tail.forEach((g, i) => { g.rotation.z = P.tailCurl * (1 - i * 0.15); g.rotation.y = Math.sin(t * 2.6 + i * 0.8) * (0.22 + 0.25 * T.tailV) * (P.poleMix > 0.5 ? 1 : 0.6) + (P.poleMix > 0.5 ? 0 : 0.1 * Math.sin(t * 1.3)); });
  rig.apply();
  tigerHit.position.copy(rig.root.position).y += (state === 'climb' || state === 'edge') ? 0.1 : 0.4;

  // ── sky: light everywhere; in a window, lean 25% toward the active category's tint; the shore flips lighter (800ms)
  skyTarget.set(landed ? SKY.shore : SKY.bottom); if (!landed && inWindow >= 0 && activeCat) skyTarget.lerp(tmpC.set(CATS[activeCat].tint), SKY.windowMix);
  const lk = 1 - Math.pow(0.001, dt / (SKY.flipMs / 1000));
  shoreMix = lerp(shoreMix, landed ? 1 : 0, lk);
  skyColor.lerp(skyTarget, lk); scene.fog.color.copy(skyColor);
  key.intensity = lerp(key.intensity, landed ? LIGHT.key.intensityShore : LIGHT.key.intensity, lk);
  hemi.intensity = lerp(hemi.intensity, landed ? LIGHT.hemi.intensityShore : LIGHT.hemi.intensity, lk); hemi.color.lerp(tmpC.set(landed ? LIGHT.hemi.skyShore : LIGHT.hemi.sky), lk); hemi.groundColor.lerp(tmpC.set(landed ? LIGHT.hemi.groundShore : LIGHT.hemi.ground), lk);
  scene.fog.near = lerp(scene.fog.near, landed ? 24 : 14, lk); scene.fog.far = lerp(scene.fog.far, landed ? 110 : 46, lk);

  // ── quip bubble above the head
  T.quipT -= dt; if (T.quipT <= 0 && T.quip) T.quip = '';
  quipEl.classList.toggle('on', !!T.quip && inWorld);
  if (T.quip) { v3.copy(rig.root.position).y += (state === 'climb' || state === 'edge') ? 1.2 : 1.35; v3.project(camera); quipEl.style.transform = `translate(${((v3.x + 1) / 2 * vw).toFixed(0)}px, ${((1 - v3.y) / 2 * vh - 8).toFixed(0)}px) translate(-50%, -100%)`; }

  // ── headline tilt (Laurens) on the DOM statements only; the camera itself never turns (Léo)
  mouse.hx += (mouse.x - mouse.hx) * MOUSE.headline.damping; mouse.hy += (mouse.y - mouse.hy) * MOUSE.headline.damping;
  const tilt = `translate3d(${(mouse.hx * MOUSE.headline.x).toFixed(2)}px, ${(mouse.hy * MOUSE.headline.y).toFixed(2)}px, 0) rotateY(${(mouse.hx * MOUSE.headline.rotY).toFixed(3)}deg) rotateX(${(-mouse.hy * MOUSE.headline.rotX).toFixed(3)}deg)`;
  tiltEls.forEach((el) => { if (el) el.style.transform = (el.classList.contains('shore-text') ? 'translateY(-50%) ' : '') + tilt; });

  // ── cursor
  mx.cx += (mx.x - mx.cx) * 0.25; mx.cy += (mx.y - mx.cy) * 0.25;
  cursor.style.transform = `translate3d(${mx.cx.toFixed(1)}px, ${mx.cy.toFixed(1)}px, 0)`;
  ray.setFromCamera(new THREE.Vector2(mouse.x, -mouse.y), camera); hoverTiger = inWorld && ray.intersectObject(tigerHit).length > 0;
  const under = document.elementFromPoint(mx.x, mx.y); const overCard = !panelOpen && under?.closest?.('.card .in'); const overLink = under?.closest?.('a'); const overClose = under?.closest?.('#panel-close');
  setPill(overClose ? COPY.panel.close : hoverTiger && !panelOpen ? COPY.cursor.tiger : overLink ? 'open' : overCard ? COPY.cursor.card : (scroll < vh * 0.4 && booted && !panelOpen ? 'scroll' : ''));

  window.__dbg = { s: +s.toFixed(3), state, landed, aN: +nearestA.toFixed(3), inWindow, cam: camera.position.toArray().map((v) => +v.toFixed(2)), hips: rig.root.position.toArray().map((v) => +v.toFixed(2)), c: +cycleAt(rig.root.position.y).toFixed(3) };
  renderer.render(scene, camera);
  if (!document.hidden) requestAnimationFrame(frame);
}
window.addEventListener('resize', measure);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
measure();
requestAnimationFrame(frame);
