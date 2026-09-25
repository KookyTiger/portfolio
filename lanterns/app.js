// KookyTiger — LANTERNS × SNOW (P0).
// Same architecture as the Tetris build: Lenis is the only clock, a three.js world behind the
// DOM, camera on rails per block, masked line reveals, one ink colour that flips with the sky.
// What changed: the well became a snowfield, the pieces became lanterns, the tiger became 3D.
import * as THREE from './vendor/three.module.min.js';
import { CATS, PIECES, START, LANTERNS, TURN_SCREEN, JUNCTION, REACH, COPY, ARCHIVE, CAMERA, MOTION, SKY, LIGHT } from './content.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NL = LANTERNS.length;            // 12 lanterns
const N = NL + 1;                      // 13 screens (one is the turn)
const screenOfLantern = (k) => (k < TURN_SCREEN ? k : k + 1);
const lanternOfScreen = (s) => (s < TURN_SCREEN ? s : s === TURN_SCREEN ? -1 : s - 1);

gsap.registerPlugin(SplitText, CustomEase);
CustomEase.create('reveal', MOTION.reveal.ease);
CustomEase.create('hide', MOTION.hide.ease);

// ───────────────────────── DOM: fill copy ─────────────────────────
document.documentElement.style.setProperty('--n', N);
$('nav-brand').innerHTML = `${COPY.nav.name}<span>${COPY.nav.sub}</span>`;
$('nav-links').innerHTML = COPY.nav.links.map((l, i) => `<a href="#" data-to="${['walk', 'intro', 'archives'][i]}">${l}</a>`).join('');
$('nav-right').innerHTML = `<b>Evanston, IL</b><br>open for work, 2027`;
$('h-statement').innerHTML = COPY.header.statement.join('<br>');
$('h-scroll').textContent = COPY.header.scroll;
$('hero-words').innerHTML = COPY.hero.words.map((w, i) => `<span class="word"><span class="main">${w}</span><span class="alt">${COPY.hero.reveal[i]}</span></span>`).join('') + `<div class="ind">${COPY.hero.indication}</div>`;
$('hero-l').innerHTML = `Raised in Wuhan<br>Designing anywhere`;
$('hero-r').innerHTML = `Northwestern ’27<br>MaDE + RTVF`;
$('intro-big').innerHTML = COPY.intro.big.map((t) => `<p class="split">${t}</p>`).join('');
$('intro-small').innerHTML = COPY.intro.small.map((t) => `<p class="split">${t}</p>`).join('');
$('intro-reel').textContent = COPY.intro.reel;
$('intro-title').innerHTML = `<span class="split">${COPY.walk.title}</span><span class="mono">${NL} lanterns · one unlit</span>`;
$('walk-title').textContent = COPY.walk.title;
$('dawn-big').innerHTML = COPY.dawn.words.map((w) => `<span class="split" style="display:block">${w}</span>`).join('');
$('dawn-sub').textContent = COPY.dawn.sub;
$('arch-head').innerHTML = `<span class="split">${COPY.archives.title}</span><span class="mono">${COPY.archives.note}</span>`;
$('arch-table').innerHTML = ARCHIVE.map((r, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td><b>${r[0]}</b><span>${r[1]}</span></td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('');
$('foot-words').innerHTML = COPY.footer.words.map((w) => `<span class="word split">${w}</span>`).join('') + `<a class="sayhi" href="mailto:${COPY.footer.email}">${COPY.footer.sayhi}</a>`;
$('foot-bottom').innerHTML = `<span>${COPY.footer.bottom[0]} · ${COPY.footer.bottom[1]}</span><a href="mailto:${COPY.footer.email}">${COPY.footer.email}</a><span>${COPY.footer.bottom[2]}</span>`;
$('h-hint').innerHTML = `${COPY.walk.hint}<br>${COPY.walk.hover}`;
const stackEl = $('h-stack'); for (let i = 0; i < NL; i++) { const b = document.createElement('i'); b.style.setProperty('--on', CATS[PIECES[i].cat].color); stackEl.appendChild(b); }

// ───────────────────────── Text reveal grammar (Léo) ─────────────────────────
const texts = [];
function makeText(el, opts = {}) {
  const t = { el, lines: null, shown: false, stagger: opts.stagger ?? MOTION.reveal.stagger, delay: opts.delay ?? 0, once: !!opts.once };
  SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line', autoSplit: true, onSplit(self) { t.lines = self.lines; gsap.set(self.lines, { yPercent: t.shown ? 0 : 110 }); } });
  t.reveal = () => { if (t.shown || !t.lines) return; t.shown = true; gsap.killTweensOf(t.lines); gsap.to(t.lines, { yPercent: 0, duration: MOTION.reveal.duration, ease: 'reveal', stagger: t.stagger, delay: t.delay, overwrite: true }); };
  t.hide = () => { if (!t.shown || !t.lines || t.once) return; t.shown = false; gsap.killTweensOf(t.lines); gsap.to(t.lines, { yPercent: 110, duration: MOTION.hide.duration, ease: 'hide', overwrite: true }); };
  texts.push(t); return t;
}
document.querySelectorAll('.split').forEach((el) => { if (!el.closest('#overlay')) makeText(el); });
const dawnTexts = texts.filter((t) => t.el.closest('#dawn')); dawnTexts.forEach((t) => (t.fixed = true));
const walkTitle = makeText($('walk-title'), { once: false }); walkTitle.fixed = true;
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

// ───────────────────────── Three: world ─────────────────────────
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = LIGHT.exposure;
const scene = new THREE.Scene();
const skyColor = new THREE.Color(SKY.night); scene.background = skyColor; scene.fog = new THREE.Fog(skyColor.clone(), 16, 46);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 160);
const camState = { pos: new THREE.Vector3(), look: new THREE.Vector3(), tPos: new THREE.Vector3(), tLook: new THREE.Vector3(), shake: 0, init: false };
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();

// snow drifts: gentle, deterministic, sampled by everything that touches the ground
function driftY(x, z) { return 0.11 * Math.sin(x * 0.35 + 1.3) * Math.cos(z * 0.29 - 0.4) + 0.06 * Math.sin(x * 0.9 - z * 0.6 + 2) + 0.03 * Math.sin(x * 2.1 + z * 1.7); }
const snowMat = new THREE.MeshStandardMaterial({ color: LIGHT.snow.night, roughness: 0.96, metalness: 0 });
const snowGeo = new THREE.PlaneGeometry(110, 110, 150, 150); snowGeo.rotateX(-Math.PI / 2);
{ const pos = snowGeo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, driftY(pos.getX(i), pos.getZ(i))); snowGeo.computeVertexNormals(); }
const snow = new THREE.Mesh(snowGeo, snowMat); snow.position.z = 2; snow.receiveShadow = true; scene.add(snow);

// key light: the moon at night, a low winter sun at dawn (one shadow map)
const key = new THREE.DirectionalLight(LIGHT.moon.color, LIGHT.moon.intensity[0]); key.position.set(...LIGHT.moon.pos); key.target.position.set(0, 0, 2); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -30; key.shadow.camera.right = 30; key.shadow.camera.top = 30; key.shadow.camera.bottom = -30; key.shadow.camera.near = 1; key.shadow.camera.far = 90; key.shadow.bias = -0.0006; key.shadow.radius = 3; scene.add(key, key.target);
const hemi = new THREE.HemisphereLight(LIGHT.hemi.sky, LIGHT.hemi.ground, LIGHT.hemi.intensity[0]); scene.add(hemi);
const PARAMS = new URLSearchParams(location.search); const SNAP = PARAMS.has('snap'); const DEBUG_BRIGHT = PARAMS.has('bright'); if (DEBUG_BRIGHT) { const d = new THREE.DirectionalLight(0xffffff, 3); d.position.set(5, 10, 8); scene.add(d); scene.add(new THREE.AmbientLight(0xffffff, 1.2)); }
const fill = new THREE.DirectionalLight(LIGHT.fill.color, LIGHT.fill.intensity[0]); fill.position.set(10, 8, 14); scene.add(fill);

// stars
const stars = (() => { const n = 520, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.85 + 0.15); const r = 120; a[i * 3] = r * Math.sin(ph) * Math.cos(th); a[i * 3 + 1] = r * Math.cos(ph) * 0.6 + 6; a[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const m = new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false, fog: false });
  const p = new THREE.Points(g, m); scene.add(p); return p; })();

// falling snow: a box of particles that rides along with the camera target
function softDot(size = 64, inner = 0.15) { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, size * inner, size / 2, size / 2, size / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const FLAKES = 1400, FBOX = { x: 40, y: 16, z: 40 };
const flakePos = new Float32Array(FLAKES * 3), flakeV = new Float32Array(FLAKES * 2);
for (let i = 0; i < FLAKES; i++) { flakePos[i * 3] = (Math.random() - 0.5) * FBOX.x; flakePos[i * 3 + 1] = Math.random() * FBOX.y; flakePos[i * 3 + 2] = (Math.random() - 0.5) * FBOX.z; flakeV[i * 2] = 0.6 + Math.random() * 0.9; flakeV[i * 2 + 1] = Math.random() * Math.PI * 2; }
const flakeGeo = new THREE.BufferGeometry(); flakeGeo.setAttribute('position', new THREE.BufferAttribute(flakePos, 3));
const flakes = new THREE.Points(flakeGeo, new THREE.PointsMaterial({ map: softDot(), color: 0xffffff, size: 0.13, transparent: true, opacity: 0.85, depthWrite: false })); scene.add(flakes);

// ───────────────────────── Lanterns ─────────────────────────
const glowTex = softDot(128, 0.05), poolTex = softDot(256, 0.0);
const postMat = new THREE.MeshStandardMaterial({ color: 0x2b2320, roughness: 0.9 });
const ribMat = new THREE.MeshStandardMaterial({ color: 0x1c1717, roughness: 0.8 });
const capMat = new THREE.MeshStandardMaterial({ color: 0x3a2320, roughness: 0.8 });
const bodyGeo = new THREE.SphereGeometry(0.36, 22, 14); bodyGeo.scale(1, 1.18, 1);
const ribGeo = new THREE.TorusGeometry(0.365, 0.012, 6, 32);
const lanterns = LANTERNS.map(([x, z], k) => {
  const proj = PIECES[k]; const col = new THREE.Color(CATS[proj.cat].color);
  const onStem = k >= TURN_SCREEN;                       // stem lanterns hang off posts on the +x side
  const back = onStem ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const g = new THREE.Group(); const y0 = driftY(x, z); g.position.set(x, y0, z); scene.add(g);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.35, 8), postMat); post.position.copy(back).multiplyScalar(0.85).setY(1.17); post.castShadow = true; g.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.62), postMat); arm.position.copy(back).multiplyScalar(0.55).setY(2.32); if (onStem) arm.rotation.y = Math.PI / 2; g.add(arm);
  const hang = new THREE.Vector3().copy(back).multiplyScalar(0.28);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), ribMat); string.position.copy(hang).setY(2.15); g.add(string);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 0.85, emissive: col, emissiveIntensity: 0 });
  const body = new THREE.Mesh(bodyGeo, mat); body.position.copy(hang).setY(1.6); body.castShadow = true; g.add(body);
  for (const dy of [-0.16, 0, 0.16]) { const r = new THREE.Mesh(ribGeo, ribMat); r.rotation.x = Math.PI / 2; r.position.copy(hang).setY(1.6 + dy); r.scale.setScalar(1 - Math.abs(dy) * 1.2); g.add(r); }
  for (const dy of [0.42, -0.42]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.07, 12), capMat); c.position.copy(hang).setY(1.6 + dy); g.add(c); }
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.3, 6), new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.55), roughness: 0.9 })); tassel.position.copy(hang).setY(1.02); g.add(tassel);
  const light = new THREE.PointLight(col.clone().lerp(new THREE.Color(0xffd9a0), 0.35), 0, LIGHT.lantern.distance, LIGHT.lantern.decay); light.position.copy(hang).setY(1.55); g.add(light);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.copy(hang).setY(1.6); glow.scale.setScalar(3.2); g.add(glow);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), new THREE.MeshBasicMaterial({ map: poolTex, color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(hang.x, 0.035, hang.z); g.add(pool);
  return { k, x, z, y0, hang, proj, col, g, mat, light, glow, pool, lit: 0, isLit: false, seed: Math.random() * 10 };
});

// sparks (burst pool)
const sparks = []; const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
for (let i = 0; i < 36; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), sparkMat); m.visible = false; scene.add(m); sparks.push({ m, v: new THREE.Vector3(), t: 1 }); }
function burst(p, n = 16) { let k = 0; for (const d of sparks) { if (d.t < 1) continue; d.m.visible = true; d.m.position.copy(p); d.v.set((Math.random() - 0.5) * 3, 0.5 + Math.random() * 2.4, (Math.random() - 0.5) * 3); d.t = 0; if (++k >= n) break; } }

// ───────────────────────── The path + footprints ─────────────────────────
// bar: START → L6 along z=-6 · back: L6 → junction, 0.4 nearer the camera · stem: junction → L11 along x=0
const BAR_Z = START[1], BACK_Z = BAR_Z - 0.4, BAR_END = LANTERNS[TURN_SCREEN - 1][0], STEM_END = LANTERNS[NL - 1][1];
const LEN_BAR = START[0] - BAR_END, LEN_BACK = JUNCTION[0] - BAR_END, LEN_STEM = STEM_END - BACK_Z;
const PATH_LEN = LEN_BAR + LEN_BACK + LEN_STEM;
function pathAt(s) {                                   // → { x, z, heading (radians, group rotation.y) }
  if (s <= LEN_BAR) return { x: START[0] - s, z: BAR_Z, h: Math.PI };
  if (s <= LEN_BAR + LEN_BACK) return { x: BAR_END + (s - LEN_BAR), z: BACK_Z, h: 0 };
  return { x: JUNCTION[0], z: BACK_Z + (s - LEN_BAR - LEN_BACK), h: -Math.PI / 2 };
}
const pawShape = (() => { const mk = (cx, cy, r) => { const sh = new THREE.Shape(); sh.absarc(cx, cy, r, 0, Math.PI * 2, false); return sh; }; return [mk(0, 0, 0.06), mk(-0.062, 0.078, 0.028), mk(0, 0.096, 0.03), mk(0.062, 0.078, 0.028)]; })();
const pawGeo = new THREE.ShapeGeometry(pawShape, 8); pawGeo.rotateX(-Math.PI / 2); pawGeo.scale(1.25, 1, 1.25);
const prints = []; { let side = 1; for (let s = 0.9; s < PATH_LEN - 0.3; s += 0.46) { const p = pathAt(s); const lat = side * 0.17; side = -side;
  // right-hand side of a heading h (group rotation.y) is (sin h, 0, cos h)
  prints.push({ s, x: p.x + Math.sin(p.h) * lat, z: p.z + Math.cos(p.h) * lat, h: p.h }); } }
const printMat = new THREE.MeshStandardMaterial({ color: 0x8a94ab, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const printMesh = new THREE.InstancedMesh(pawGeo, printMat, prints.length); printMesh.count = 0; scene.add(printMesh);
{ const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  prints.forEach((p, i) => { e.set(0, p.h - Math.PI / 2, 0); q.setFromEuler(e); pos.set(p.x, driftY(p.x, p.z) + 0.012, p.z); m.compose(pos, q, sc); printMesh.setMatrixAt(i, m); }); printMesh.instanceMatrix.needsUpdate = true; }

// ───────────────────────── Tiger (chunky 3D) ─────────────────────────
const C = { o: 0xF2A93B, k: 0x1A1512, w: 0xF6F1E6, p: 0xF08A8A, e: 0x141414 };
const M = {}; for (const key in C) M[key] = new THREE.MeshStandardMaterial({ color: C[key], roughness: 0.9, emissive: C[key], emissiveIntensity: key === 'k' || key === 'e' ? 0 : 0.16 });
const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || tiger).add(m); return m; };
const tiger = new THREE.Group(); scene.add(tiger);
const body = new THREE.Group(); tiger.add(body);                       // pivots at the shoulders
box(1.3, 0.62, 0.72, M.o, 0, 0.63, 0, body);
box(0.14, 0.34, 0.5, M.w, 0.66, 0.5, 0, body);                        // chest
box(1.0, 0.1, 0.5, M.w, 0.02, 0.31, 0, body);                         // belly
for (const x of [-0.36, -0.02, 0.32]) box(0.13, 0.66, 0.76, M.k, x, 0.63, 0, body);   // stripes
const head = new THREE.Group(); head.position.set(0.72, 1.02, 0); body.add(head);
box(0.95, 0.85, 0.92, M.o, 0, 0, 0, head);
for (const z of [-0.33, 0.33]) { box(0.24, 0.24, 0.16, M.o, 0.06, 0.5, z, head); box(0.12, 0.12, 0.17, M.p, 0.1, 0.48, z, head); }   // ears
for (const z of [-0.2, 0.2]) box(0.6, 0.05, 0.1, M.k, -0.1, 0.44, z, head);           // head stripes
for (const [y, w] of [[0.3, 0.3], [0.22, 0.22], [0.14, 0.3]]) box(0.03, 0.04, w, M.k, 0.48, y, 0, head);  // 王
box(0.03, 0.2, 0.045, M.k, 0.48, 0.22, 0, head);
const eyes = new THREE.Group(); head.add(eyes);
for (const z of [-0.24, 0.24]) { box(0.03, 0.2, 0.22, M.w, 0.475, 0.06, z, eyes); box(0.03, 0.13, 0.13, M.e, 0.49, 0.05, z - 0.02, eyes); box(0.035, 0.05, 0.05, M.w, 0.5, 0.1, z - 0.06, eyes); }
box(0.1, 0.3, 0.48, M.w, 0.5, -0.2, 0, head);                          // muzzle
box(0.05, 0.1, 0.16, M.p, 0.56, -0.1, 0, head);                        // nose
box(0.03, 0.03, 0.14, M.k, 0.56, -0.25, 0, head);                      // mouth
for (const z of [-0.14, 0.14]) box(0.03, 0.03, 0.03, M.k, 0.56, -0.17, z, head);   // whisker dots
for (const z of [-0.42, 0.42]) box(0.03, 0.09, 0.09, M.p, 0.475, -0.06, z, head);  // blush
const legs = [[0.42, 0.26], [0.42, -0.26], [-0.42, 0.26], [-0.42, -0.26]].map(([x, z], i) => { const g = new THREE.Group(); g.position.set(x, 0.36, z); body.add(g); box(0.26, 0.36, 0.26, M.o, 0, -0.18, 0, g); box(0.27, 0.09, 0.27, M.w, 0, -0.33, 0, g); g.userData.phase = i === 0 || i === 3 ? 0 : Math.PI; return g; });
const tail = new THREE.Group(); tail.position.set(-0.65, 0.78, 0); body.add(tail);
{ const s1 = box(0.32, 0.13, 0.13, M.o, -0.15, 0.02, 0, tail); s1.rotation.z = 0.4; const s2 = box(0.3, 0.13, 0.13, M.o, -0.4, 0.2, 0, tail); s2.rotation.z = 1.0; const s3 = box(0.26, 0.13, 0.13, M.k, -0.52, 0.45, 0, tail); s3.rotation.z = 1.5; }
const tigerShadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ color: 0x0a0c16, transparent: true, opacity: 0.22, depthWrite: false })); tigerShadow.rotation.x = -Math.PI / 2; scene.add(tigerShadow);
const tigerHit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 1.4), new THREE.MeshBasicMaterial({ visible: false })); scene.add(tigerHit);
const T = { s: 0, x: START[0], z: START[1], h: 0, hv: 0, speed: 0, walkT: 0, blinkAt: 2.5, blink: false, hop: 0, hopV: 0, reach: 0, sit: 1, sitT: 1, faceCam: 0, quipT: 0, quip: '', run: 0 };

// ───────────────────────── Layout measurements ─────────────────────────
const R = {};
function measure() {
  vh = innerHeight; vw = innerWidth;
  for (const id of ['header', 'hero', 'intro', 'walk', 'dawn', 'archives', 'footer']) { const el = $(id); const r = el.getBoundingClientRect(); R[id] = { top: r.top + scroll, h: r.height }; }
  texts.forEach((t) => { const r = t.el.getBoundingClientRect(); t.top = r.top + scroll; t.h = r.height; });
  renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.updateProjectionMatrix();
}

// ───────────────────────── Walk state (pure function of scroll) ─────────────────────────
// Per screen k: the tiger walks from the previous stop to its stop, arriving at f = REACH, then waits.
let walkProg = 0, dawnQ = 0, activeScreen = 0;
const STOP_BEFORE = 0.62;
function stopOf(screen) { if (screen < 0) return { x: START[0], z: START[1], s: 0 }; const L = lanternOfScreen(screen); if (L < 0) return { x: JUNCTION[0], z: BACK_Z, s: LEN_BAR + LEN_BACK }; const [x, z] = LANTERNS[L]; return L < TURN_SCREEN ? { x, z, s: START[0] - x - STOP_BEFORE } : { x, z, s: LEN_BAR + LEN_BACK + (z - BACK_Z) - STOP_BEFORE }; }
function walkState(p) {
  const k = clamp(Math.floor(p), 0, N - 1), f = clamp(p - k, 0, 1);
  const a = stopOf(k - 1), b = stopOf(k);
  const isTurn = k === TURN_SCREEN;
  const u = isTurn ? smooth(f / 0.9) : smooth(f / REACH);
  const s = lerp(a.s, b.s, u);
  const q = pathAt(s);
  const moving = isTurn ? f < 0.9 : f < REACH;
  const reach = !isTurn && f > REACH - 0.02 && f < REACH + 0.2 ? Math.sin(Math.PI * clamp((f - REACH + 0.02) / 0.22, 0, 1)) : 0;
  return { k, f, s, x: q.x, z: q.z, h: q.h, moving, reach, run: isTurn ? 1 : 0 };
}
const litAt = (L) => screenOfLantern(L) + REACH + 0.07;   // walkProg at which lantern L lights

// ───────────────────────── Card / HUD / sky / cursor / quip ─────────────────────────
let shownK = -1; const card = $('card'); const nextCtx = $('next').getContext('2d');
function drawNext(k) { const c = nextCtx; c.clearRect(0, 0, 88, 44); if (k >= NL) return; c.fillStyle = CATS[PIECES[k].cat].color; c.beginPath(); c.roundRect(30, 6, 28, 32, 10); c.fill(); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(30, 15, 28, 1.5); c.fillRect(30, 28, 28, 1.5); c.fillStyle = '#3a2320'; c.fillRect(38, 2, 12, 4); c.fillRect(38, 38, 12, 4); }
function showCard(k) {
  if (k === shownK) return; shownK = k; const p = PIECES[k];
  const apply = () => { $('c-n').textContent = String(k + 1).padStart(2, '0') + ' / ' + NL; $('c-cat').textContent = CATS[p.cat].name; $('c-name').textContent = p.name; $('c-desc').textContent = p.desc; $('c-meta').innerHTML = p.meta.map((m) => `<span>${m}</span>`).join(''); $('c-take').textContent = p.take; };
  if (reduced) { apply(); return; }
  gsap.to(card, { opacity: 0, y: 8, duration: 0.25, ease: 'expo.out', onComplete: () => { apply(); gsap.fromTo(card, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.65, ease: 'reveal' }); } });
  drawNext(k + 1);
}
let skyStage = 0; const skyTarget = new THREE.Color(SKY.night);
function setSky(stage, cat) {
  const base = new THREE.Color(stage === 2 ? SKY.dawn : stage === 1 ? SKY.walk : SKY.night);
  if (stage === 1 && cat) base.lerp(tmpC.set(CATS[cat].tint), 0.3);
  skyTarget.copy(base);
  if ((stage === 2) !== document.body.classList.contains('light')) { document.body.classList.toggle('light', stage === 2); document.body.style.backgroundColor = stage === 2 ? SKY.dawn : SKY.night; }
  skyStage = stage;
}
const cursor = $('cursor'), pill = $('cursor-pill'); let pillShown = false, pillText = '';
const mx = { x: -100, y: -100, cx: -100, cy: -100 };
window.addEventListener('pointermove', (e) => { mx.x = e.clientX; mx.y = e.clientY; mouse.x = (e.clientX / vw) * 2 - 1; mouse.y = (e.clientY / vh) * 2 - 1; });
function setPill(text) { if (text === pillText) return; pillText = text; if (text) { pill.textContent = text; if (!pillShown) { pillShown = true; gsap.to(pill, { '--reveal': 1, duration: MOTION.cursor.inDuration, ease: MOTION.cursor.inEase, overwrite: true }); } } else if (pillShown) { pillShown = false; gsap.to(pill, { '--reveal': 0, duration: MOTION.cursor.outDuration, ease: MOTION.cursor.outEase, overwrite: true }); } }
const quipEl = $('quip'); const v3 = new THREE.Vector3();
function say(text, dur = 2.6) { T.quip = text; T.quipT = dur; quipEl.textContent = text; }
const ray = new THREE.Raycaster(); let hoverTiger = false;
canvas.addEventListener('click', () => { if (!hoverTiger) return; T.hopV = 4.6; camState.shake = 0.1; say(['kooky.', 'again?', 'cold. worth it.', 'that tickles.', 'i know a good noodle place.'][Math.floor(Math.random() * 5)]); });

// ───────────────────────── Loader ─────────────────────────
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

// ───────────────────────── Frame ─────────────────────────
let last = performance.now(), litCount = 0, lastLitEvent = -1, saidTurn = 0, dawnMix = 0;
const rig = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
function barRig(tx, tz, out) { const side = vw > 800 ? CAMERA.bar.side : 0; out.pos.set(tx + CAMERA.bar.off[0] + side, CAMERA.bar.off[1], tz + CAMERA.bar.off[2]); out.look.set(tx + CAMERA.bar.look[0] + side, CAMERA.bar.look[1], tz + CAMERA.bar.look[2]); return out; }
function stemRig(tx, tz, out) { const side = vw > 800 ? CAMERA.stem.side : 0; out.pos.set(tx + CAMERA.stem.off[0], CAMERA.stem.off[1], tz + CAMERA.stem.off[2] - side); out.look.set(tx + CAMERA.stem.look[0], CAMERA.stem.look[1], tz + CAMERA.stem.look[2] - side); return out; }
const rigA = { pos: new THREE.Vector3(), look: new THREE.Vector3() }, rigB = { pos: new THREE.Vector3(), look: new THREE.Vector3() };

function frame(now) {
  const dt = SNAP ? 0.2 : Math.min(0.05, (now - last) / 1000); last = now;
  lenis.raf(now); scroll = lenis.animatedScroll ?? scrollY;
  if (!R.walk) measure();
  const t = now / 1000;

  // ── phase progress
  const headerP = clamp(scroll / R.header.h, 0, 1);
  const inWhite = scroll > R.hero.top - vh * 0.15 && scroll < R.walk.top - vh * 0.6;
  walkProg = clamp((scroll - R.walk.top) / vh, 0, N);
  dawnQ = clamp((scroll - R.dawn.top) / (R.dawn.h - vh), 0, 1);
  const inWalk = scroll >= R.walk.top - vh * 0.6 && scroll < R.dawn.top + (R.dawn.h - vh) * 0.95;
  const afterDawn = scroll >= R.archives.top - vh * 0.4;
  canvas.classList.toggle('dim', inWhite || afterDawn);
  const overlayOn = scroll >= R.walk.top - vh * 0.2 && scroll < R.dawn.top - vh * 0.1;
  $('overlay').classList.toggle('on', overlayOn); if (overlayOn) walkTitle.reveal(); else walkTitle.hide();

  // ── header content parallax + fade (Léo: 800px, fade .2→.45)
  const hc = document.querySelector('.header .content');
  hc.style.transform = `translate3d(0, ${(-headerP * 800 * 0.35).toFixed(1)}px, 0)`;
  hc.style.opacity = 1 - smooth((headerP - 0.2) / 0.25);

  // ── text reveals by local progress
  for (const tx of texts) { if (tx.fixed || tx.el.id === 'h-statement' || tx.el.id === 'h-scroll') continue; const pr = (scroll + vh - tx.top) / (tx.h + vh * 0.35); if (pr > 0.12) tx.reveal(); else if (pr <= 0) tx.hide(); }
  if (!heroShown && scroll + vh > R.hero.top + vh * 0.35) { heroShown = true; gsap.to(heroWords.map((w) => w.querySelector('.main')), { yPercent: 0, duration: MOTION.reveal.duration, ease: 'reveal', stagger: MOTION.reveal.heroStagger }); }

  // ── the walk
  const W = walkState(walkProg); activeScreen = W.k;
  const started = scroll > R.walk.top - vh * 0.5;
  const atEnd = walkProg >= N;                         // sitting by the last lantern
  T.s = W.s; T.x = W.x; T.z = W.z;
  // heading eases (turns at the corner look like turns, not snaps)
  let dh = W.h - T.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2; T.h += dh * Math.min(1, dt * 7);
  const movingNow = started && W.moving && !atEnd;
  T.speed += ((movingNow ? (W.run ? 1.8 : 1) : 0) - T.speed) * Math.min(1, dt * 8);
  T.reach += (W.reach - T.reach) * Math.min(1, dt * 12);
  const sitting = !started || atEnd || (W.k === N - 1 && W.f > REACH + 0.3);
  T.sitT += ((sitting ? 1 : 0) - T.sitT) * Math.min(1, dt * 4);
  // lantern lit state + events
  let lit = 0, litEvent = -1;
  lanterns.forEach((L) => { const on = L.k < NL - 1 && walkProg >= litAt(L.k); if (on && !L.isLit) { L.isLit = true; litEvent = L.k; } if (!on) L.isLit = false; if (on) lit++;
    L.lit += ((on ? 1 : 0) - L.lit) * Math.min(1, dt * (on ? 3.2 : 6));
    const flick = 1 + 0.06 * Math.sin(t * 9.3 + L.seed) + 0.04 * Math.sin(t * 17.1 + L.seed * 2);
    const e = L.lit * flick; L.mat.emissiveIntensity = e * 0.95; L.mat.color.copy(tmpC.set(0x3a3230).lerp(L.col, L.lit * 0.85));
    const dawnK = 1 - dawnMix; L.light.intensity = LIGHT.lantern.intensity * e * lerp(1, 0.25, dawnMix); L.glow.material.opacity = 0.4 * e * dawnK; L.pool.material.opacity = 0.2 * e * dawnK; });
  litCount = lit;
  if (litEvent >= 0 && litEvent > lastLitEvent) { const L = lanterns[litEvent]; burst(new THREE.Vector3(L.x + L.hang.x, L.y0 + 1.6, L.z + L.hang.z), 18); camState.shake = 0.06; T.hopV = 2.6; say(L.proj.quip); }
  lastLitEvent = Math.max(-1, ...lanterns.filter((L) => L.isLit).map((L) => L.k));
  if (W.k === TURN_SCREEN && saidTurn !== 1 && W.f > 0.05) { saidTurn = 1; say('wide first.', 2); }
  if (W.k === TURN_SCREEN + 1 && saidTurn !== 2 && W.f > 0.05) { saidTurn = 2; say('now deep.', 2); }
  if (W.k < TURN_SCREEN) saidTurn = 0;
  if (W.k === N - 1 && W.f > REACH + 0.25 && !T.faceCam) { T.faceCam = 1; say(COPY.dawn.tiger, 5); }
  if (W.k < N - 1) T.faceCam = 0;
  // footprints exist behind the tiger
  let cnt = 0; while (cnt < prints.length && prints[cnt].s <= T.s - 0.3) cnt++; printMesh.count = started ? cnt : 0;

  // ── dawn
  if (dawnQ > 0.55) dawnTexts.forEach((tx) => tx.reveal()); else if (dawnQ < 0.45) dawnTexts.forEach((tx) => tx.hide());
  const stage = dawnQ > 0.5 ? 2 : (started && walkProg > 0.05 ? 1 : 0);
  const L = lanternOfScreen(activeScreen);
  if (stage !== skyStage || stage === 1) setSky(stage, stage === 1 && L >= 0 ? PIECES[L].cat : null);
  const lk = 1 - Math.pow(0.001, dt / (SKY.flipMs / 1000));
  dawnMix = lerp(dawnMix, stage === 2 ? 1 : 0, lk);
  skyColor.lerp(skyTarget, lk); scene.fog.color.copy(skyColor);
  key.intensity = lerp(key.intensity, stage === 2 ? 1.0 : LIGHT.moon.intensity[stage], lk); key.color.lerp(tmpC.set(stage === 2 ? 0xffe9c8 : LIGHT.moon.color), lk);
  hemi.intensity = lerp(hemi.intensity, LIGHT.hemi.intensity[stage], lk); hemi.color.lerp(tmpC.set(stage === 2 ? 0xdfe3ea : LIGHT.hemi.sky), lk);
  fill.intensity = lerp(fill.intensity, LIGHT.fill.intensity[stage], lk);
  snowMat.color.lerp(tmpC.set(stage === 2 ? LIGHT.snow.dawn : LIGHT.snow.night), lk);
  printMat.color.lerp(tmpC.set(stage === 2 ? 0xb3b7c2 : 0x8a94ab), lk);
  scene.fog.near = lerp(scene.fog.near, stage === 2 ? 70 : 16, lk); scene.fog.far = lerp(scene.fog.far, stage === 2 ? 160 : 46, lk);
  stars.material.opacity = lerp(stars.material.opacity, stage === 2 ? 0 : 0.8, lk);
  flakes.material.opacity = lerp(flakes.material.opacity, stage === 2 ? 0.55 : 0.85, lk);

  // ── tiger animation
  T.walkT += dt * T.speed * (W.run ? 13 : 9);
  const sw = T.speed * (W.run ? 0.8 : 0.55);
  legs.forEach((g) => { g.rotation.z = Math.sin(T.walkT + g.userData.phase) * sw * (1 - T.sitT); });
  // sitting: rear down, back legs fold
  legs[2].rotation.z = lerp(legs[2].rotation.z, 1.25, T.sitT); legs[3].rotation.z = lerp(legs[3].rotation.z, 1.25, T.sitT);
  body.rotation.z = lerp(-0.55 * T.reach, 0.32, T.sitT) + (T.speed > 0.05 ? Math.sin(T.walkT * 2) * 0.02 * T.speed : 0);
  legs[0].rotation.z -= 1.1 * T.reach; legs[1].rotation.z -= 1.1 * T.reach;
  head.rotation.z = -0.25 * T.reach - 0.18 * T.sitT + (T.speed > 0.05 ? Math.sin(T.walkT * 2 + 1) * 0.03 : 0);
  head.rotation.y = lerp(Math.sin(t * 0.7) * 0.12 * (1 - T.speed), 0, T.reach);
  tail.rotation.y = Math.sin(t * 3.2) * 0.3 + Math.sin(t * 7.1) * 0.08 * T.speed;
  T.blinkAt -= dt; if (T.blinkAt < 0) { T.blink = !T.blink; T.blinkAt = T.blink ? 0.12 : 2.2 + Math.random() * 3; }
  eyes.scale.y += ((T.blink ? 0.08 : 1) - eyes.scale.y) * Math.min(1, dt * 30);
  T.hopV -= 16 * dt; T.hop = Math.max(0, T.hop + T.hopV * dt); if (T.hop === 0 && T.hopV < 0) T.hopV = 0;
  const bob = T.speed > 0.05 ? Math.abs(Math.sin(T.walkT)) * 0.045 * T.speed : Math.sin(t * 2.2) * 0.01;
  const gy = driftY(T.x, T.z);
  tiger.position.set(T.x, gy + T.hop + bob - 0.06 * T.sitT, T.z);
  // face the camera when sitting at the end (and at the very start)
  const faceH = Math.atan2(-(camera.position.z - T.z), camera.position.x - T.x);
  let fh = faceH - T.h; while (fh > Math.PI) fh -= Math.PI * 2; while (fh < -Math.PI) fh += Math.PI * 2;
  tiger.rotation.y = T.h + fh * T.sitT * (T.faceCam || !started ? 1 : 0.35);
  tiger.scale.set(1, 1 - Math.min(0.1, Math.abs(T.hopV) * 0.02), 1);
  tigerShadow.position.set(T.x, gy + 0.02, T.z); tigerShadow.material.opacity = 0.22 / (1 + T.hop * 1.5); tigerShadow.scale.setScalar(1 / (1 + T.hop * 0.4));
  tigerHit.position.set(T.x, gy + 0.9, T.z);
  T.quipT -= dt; if (T.quipT <= 0 && T.quip) T.quip = '';
  quipEl.classList.toggle('on', !!T.quip && !(inWhite || afterDawn));
  if (T.quip) { v3.set(T.x, gy + T.hop + 1.9, T.z).project(camera); quipEl.style.transform = `translate(${((v3.x + 1) / 2 * vw).toFixed(0)}px, ${((1 - v3.y) / 2 * vh - 8).toFixed(0)}px) translate(-50%, -100%)`; }

  // ── camera rails
  const tp = camState.tPos, tl = camState.tLook;
  if (scroll < R.hero.top) {
    const p = smooth(headerP); const f = CAMERA.header.from, to = CAMERA.header.to;
    tp.set(T.x + lerp(f.off[0], to.off[0], p), lerp(f.off[1], to.off[1], p), T.z + lerp(f.off[2], to.off[2], p));
    tl.set(T.x + lerp(f.look[0], to.look[0], p), lerp(f.look[1], to.look[1], p), T.z + lerp(f.look[2], to.look[2], p));
  } else if (scroll < R.dawn.top) {
    if (W.k < TURN_SCREEN) barRig(T.x, T.z, rig);
    else if (W.k === TURN_SCREEN) { barRig(T.x, T.z, rigA); stemRig(T.x, T.z, rigB); const q = smooth((W.f - 0.15) / 0.8); rig.pos.lerpVectors(rigA.pos, rigB.pos, q); rig.look.lerpVectors(rigA.look, rigB.look, q); }
    else stemRig(T.x, T.z, rig);
    tp.copy(rig.pos); tl.copy(rig.look);
  } else {
    stemRig(T.x, T.z, rigA); const q = smooth(dawnQ);
    tp.lerpVectors(rigA.pos, tmpV.set(...CAMERA.dawn.pos), q); tl.lerpVectors(rigA.look, tmpV2.set(...CAMERA.dawn.look), q);
  }
  if (!camState.init) { camState.pos.copy(tp); camState.look.copy(tl); camState.init = true; }
  const kk = reduced || SNAP ? 1 : Math.min(1, dt * 4.5);
  camState.pos.lerp(tp, kk); camState.look.lerp(tl, kk);
  mouse.sx += (mouse.x - mouse.sx) * CAMERA.mouse.damping; mouse.sy += (mouse.y - mouse.sy) * CAMERA.mouse.damping;
  const dist = camState.pos.distanceTo(camState.look);
  camState.shake *= 0.9;
  camera.position.set(camState.pos.x + mouse.sx * CAMERA.mouse.yaw * dist * 2.2 + (Math.random() - 0.5) * camState.shake, camState.pos.y - mouse.sy * CAMERA.mouse.pitch * dist * 1.6 + (Math.random() - 0.5) * camState.shake, camState.pos.z + mouse.sx * CAMERA.mouse.yaw * dist * 0.6);
  camera.lookAt(camState.look);

  // ── snowfall rides with the look target
  { const cx = camState.look.x, cz = camState.look.z; for (let i = 0; i < FLAKES; i++) { let y = flakePos[i * 3 + 1] - flakeV[i * 2] * dt; if (y < -0.5) { y += FBOX.y; flakePos[i * 3] = cx + (Math.random() - 0.5) * FBOX.x; flakePos[i * 3 + 2] = cz + (Math.random() - 0.5) * FBOX.z; } flakePos[i * 3 + 1] = y; flakePos[i * 3] += Math.sin(t * 0.8 + flakeV[i * 2 + 1]) * 0.25 * dt;
    // keep the box around the camera target
    if (flakePos[i * 3] < cx - FBOX.x / 2) flakePos[i * 3] += FBOX.x; else if (flakePos[i * 3] > cx + FBOX.x / 2) flakePos[i * 3] -= FBOX.x;
    if (flakePos[i * 3 + 2] < cz - FBOX.z / 2) flakePos[i * 3 + 2] += FBOX.z; else if (flakePos[i * 3 + 2] > cz + FBOX.z / 2) flakePos[i * 3 + 2] -= FBOX.z; }
    flakeGeo.attributes.position.needsUpdate = true; }

  // ── sparks
  for (const d of sparks) { if (d.t >= 1) continue; d.t += dt * 1.6; d.v.y -= 7 * dt; d.m.position.addScaledVector(d.v, dt); d.m.scale.setScalar(Math.max(0.001, 1 - d.t)); if (d.t >= 1) d.m.visible = false; }

  // ── HUD + card
  if (inWalk) {
    const Lk = clamp(L >= 0 ? L : lanternOfScreen(activeScreen - 1), 0, NL - 1); showCard(Lk);
    $('h-piece').textContent = String(Lk + 1).padStart(2, '0') + ' / ' + NL;
    $('h-xy').textContent = String(Math.round(T.s * 2)).padStart(3, '0') + ' m';
    $('h-lines').textContent = String(litCount).padStart(2, '0');
    [...stackEl.children].forEach((el, i) => el.classList.toggle('on', lanterns[i].isLit));
  }

  // ── cursor
  mx.cx += (mx.x - mx.cx) * 0.25; mx.cy += (mx.y - mx.cy) * 0.25;
  cursor.style.transform = `translate3d(${mx.cx.toFixed(1)}px, ${mx.cy.toFixed(1)}px, 0)`;
  ray.setFromCamera(new THREE.Vector2(mouse.x, -mouse.y), camera); hoverTiger = !inWhite && !afterDawn && ray.intersectObject(tigerHit).length > 0;
  const overLink = document.elementFromPoint(mx.x, mx.y)?.closest?.('a, button');
  setPill(hoverTiger ? COPY.walk.hover : overLink ? 'open' : (scroll < vh * 0.4 && booted ? 'scroll' : ''));

  window.__dbg = { cam: camera.position.toArray().map(v=>+v.toFixed(2)), look: camState.look.toArray().map(v=>+v.toFixed(2)), tiger: tiger.position.toArray().map(v=>+v.toFixed(2)), W, walkProg: +walkProg.toFixed(2), T: { s: +T.s.toFixed(2), h: +T.h.toFixed(2) } };
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
window.addEventListener('resize', measure);
measure();
requestAnimationFrame(frame);
