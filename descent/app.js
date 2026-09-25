// KookyTiger — THE DESCENT, v2: the lift.
// The tiger never walks. It stands on a lift on the right of the screen; the shaft, the ledges and the
// monsters slide up past it. Everything is a linear function of scroll (Léo's rail), the only smoothing is
// Lenis (.1). Projects are DOM blocks on the left. Camera rides the lift; mouse yaw/pitch, headline tilt and
// the cursor light are Laurens's numbers. Sky flips at fixed thresholds.
import * as THREE from './vendor/three.module.min.js';
import { CATS, PIECES, FLOOR_H, BLOCK_VH, FIGHT, LIFT, COPY, ARCHIVE, CAMERA, MOUSE, MOTION, SKY, LIGHT } from './content.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (v, [a, b]) => clamp((v - a) / (b - a), 0, 1);      // progress from a to b (either direction)
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NP = PIECES.length;
const PARAMS = new URLSearchParams(location.search); const SNAP = PARAMS.has('snap'); const BRIGHT = PARAMS.has('bright');

gsap.registerPlugin(SplitText, CustomEase);
CustomEase.create('reveal', MOTION.reveal.ease);
CustomEase.create('hide', MOTION.hide.ease);

// ───────────────────────── DOM: fill copy ─────────────────────────
document.documentElement.style.setProperty('--block', BLOCK_VH);
$('nav-brand').innerHTML = `${COPY.nav.name}<span>${COPY.nav.sub}</span>`;
$('nav-links').innerHTML = COPY.nav.links.map((l, i) => `<a href="#" data-to="${['descent', 'intro', 'archives'][i]}">${l}</a>`).join('');
$('nav-right').innerHTML = `<b>Evanston, IL</b><br>open for work, 2027`;
$('h-statement').innerHTML = COPY.header.statement.join('<br>');
$('h-scroll').textContent = COPY.header.scroll;
$('hero-words').innerHTML = COPY.hero.words.map((w, i) => `<span class="word"><span class="main">${w}</span><span class="alt">${COPY.hero.reveal[i]}</span></span>`).join('') + `<div class="ind">${COPY.hero.indication}</div>`;
$('hero-l').innerHTML = `Raised in Wuhan<br>Designing anywhere`;
$('hero-r').innerHTML = `Northwestern ’27<br>MaDE + RTVF`;
$('intro-big').innerHTML = COPY.intro.big.map((t) => `<p class="split">${t}</p>`).join('');
$('intro-small').innerHTML = COPY.intro.small.map((t) => `<p class="split">${t}</p>`).join('');
$('intro-reel').textContent = COPY.intro.reel;
$('intro-title').innerHTML = `<span class="split">${COPY.descent.title}</span><span class="mono">${NP} floors · ${NP} monsters · 1 tiger</span>`;
$('descent-title').textContent = COPY.descent.title;
$('floors').innerHTML = PIECES.map((p, i) => `<article class="proj" id="proj-${i}" style="--cat:${CATS[p.cat].color}"><div class="in">
  <p class="eyebrow mono"><span class="n">${String(i + 1).padStart(2, '0')} / ${NP}</span><span>${CATS[p.cat].name}</span><span class="mon">· ${p.monster.name}</span></p>
  <h2 class="split">${p.name}</h2><p class="desc split">${p.desc}</p><p class="meta mono">${p.meta.map((m) => `<span>${m}</span>`).join('')}</p><p class="take split">${p.take}</p>
  <div class="media">${COPY.descent.media}</div></div></article>`).join('');
$('shore-big').innerHTML = COPY.shore.words.map((w) => `<span class="split" style="display:block">${w}</span>`).join('');
$('shore-sub').textContent = COPY.shore.sub;
$('arch-head').innerHTML = `<span class="split">${COPY.archives.title}</span><span class="mono">${COPY.archives.note}</span>`;
$('arch-table').innerHTML = ARCHIVE.map((r, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td><b>${r[0]}</b><span>${r[1]}</span></td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('');
$('foot-words').innerHTML = COPY.footer.words.map((w) => `<span class="word split">${w}</span>`).join('') + `<a class="sayhi" href="mailto:${COPY.footer.email}">${COPY.footer.sayhi}</a>`;
$('foot-bottom').innerHTML = `<span>${COPY.footer.bottom[0]} · ${COPY.footer.bottom[1]}</span><a href="mailto:${COPY.footer.email}">${COPY.footer.email}</a><span>${COPY.footer.bottom[2]}</span>`;
$('h-hint').innerHTML = `${COPY.descent.hint}<br>${COPY.descent.hover}`;
const stackEl = $('h-stack'); for (let i = 0; i < NP; i++) { const b = document.createElement('i'); b.style.setProperty('--on', CATS[PIECES[i].cat].color); stackEl.appendChild(b); }

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
const shoreTexts = texts.filter((t) => t.el.closest('#shore')); shoreTexts.forEach((t) => (t.fixed = true));
const descentTitle = makeText($('descent-title'), { once: false }); descentTitle.fixed = true;
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
const skyColor = new THREE.Color(SKY.pure); scene.background = skyColor; scene.fog = new THREE.Fog(skyColor.clone(), 14, 42);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
const mouse = { x: 0, y: 0, sx: 0, sy: 0, hx: 0, hy: 0, bx: 0, by: 0 };
const tmpC = new THREE.Color();
const shake = { v: 0 };

const key = new THREE.DirectionalLight(LIGHT.key.color, LIGHT.key.intensity[0]); key.position.set(6, 14, 12); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -14; key.shadow.camera.right = 14; key.shadow.camera.top = 14; key.shadow.camera.bottom = -14; key.shadow.camera.near = 1; key.shadow.camera.far = 60; key.shadow.bias = -0.0005; key.shadow.radius = 3; scene.add(key, key.target);
const hemi = new THREE.HemisphereLight(LIGHT.hemi.sky, LIGHT.hemi.ground, LIGHT.hemi.intensity[0]); scene.add(hemi);
const fill = new THREE.DirectionalLight(0xbfc8ff, 0.35); fill.position.set(-4, 3, 10); scene.add(fill);
if (BRIGHT) scene.add(new THREE.AmbientLight(0xffffff, 1.4));

function stoneTexture() { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#2a2c3a'; g.fillRect(0, 0, 512, 512);
  const rows = 8, h = 512 / rows; for (let r = 0; r < rows; r++) { const off = (r % 2) * 64; let x = -off; while (x < 512) { const w = 96 + Math.floor(Math.random() * 64); const v = 58 + Math.floor(Math.random() * 26); g.fillStyle = `rgb(${v},${v + 2},${v + 12})`; g.fillRect(x + 3, r * h + 3, w - 6, h - 6); x += w; } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function softDot(size = 64, inner = 0.15) { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, size * inner, size / 2, size / 2, size / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const glowTex = softDot(128, 0.05);
const postMat = new THREE.MeshStandardMaterial({ color: 0x2b2320, roughness: 0.9 });
const slabMat = new THREE.MeshStandardMaterial({ color: 0x565a6c, roughness: 0.9 });
const slabTop = new THREE.MeshStandardMaterial({ color: 0x6b7085, roughness: 0.95 });

// ── the lift (the tiger's ride): a stone disc on three chains, a lantern on a hook
const lift = new THREE.Group(); scene.add(lift);
{ const deck = new THREE.Mesh(new THREE.CylinderGeometry(LIFT.r, LIFT.r * 0.92, 0.42, 28), new THREE.MeshStandardMaterial({ color: 0x4a4658, roughness: 0.9 })); deck.position.y = -0.21; deck.castShadow = true; deck.receiveShadow = true; lift.add(deck);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(LIFT.r - 0.08, LIFT.r - 0.08, 0.05, 28), new THREE.MeshStandardMaterial({ color: 0x5c586e, roughness: 0.95 })); top.position.y = 0.02; top.receiveShadow = true; lift.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(LIFT.r, 0.07, 8, 40), new THREE.MeshStandardMaterial({ color: 0x8a7a56, roughness: 0.6, metalness: 0.5 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.0; lift.add(rim);
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x9a9aa8, roughness: 0.5, metalness: 0.7 });
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 90, 5), chainMat); ch.position.set(Math.cos(a) * (LIFT.r - 0.25), 45, Math.sin(a) * (LIFT.r - 0.25)); lift.add(ch); }
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), postMat); hook.position.set(LIFT.r - 0.45, 1.2, -0.6); lift.add(hook);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), postMat); arm.position.set(LIFT.r - 0.75, 2.38, -0.6); lift.add(arm);
  const lantern = new THREE.Group(); lantern.position.set(LIFT.r - 1.05, 2.36, -0.6); lift.add(lantern);
  const lb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.3), new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc46a, emissiveIntensity: 1.3, roughness: 1 })); lb.position.y = -0.36; lantern.add(lb);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.36), postMat); cap.position.y = -0.12; lantern.add(cap);
  const light = new THREE.PointLight(LIGHT.lamp.color, LIGHT.lamp.intensity, LIGHT.lamp.distance, LIGHT.lamp.decay); light.position.y = -0.36; lantern.add(light);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc46a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.y = -0.36; glow.scale.setScalar(2.4); lantern.add(glow);
  lift.userData.lantern = lantern; lift.userData.light = light; lift.userData.glow = glow; }

// ── stars, dust
const stars = (() => { const n = 400, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - 0.5) * 160; a[i * 3 + 1] = 10 + Math.random() * 60; a[i * 3 + 2] = -40 - Math.random() * 50; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false, fog: false })); scene.add(pts); return pts; })();
const MOTES = 500, motePos = new Float32Array(MOTES * 3), moteSeed = new Float32Array(MOTES);
for (let i = 0; i < MOTES; i++) { motePos[i * 3] = (Math.random() - 0.5) * 18; motePos[i * 3 + 1] = Math.random() * 18 - 9; motePos[i * 3 + 2] = (Math.random() - 0.5) * 10; moteSeed[i] = Math.random() * 10; }
const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: softDot(), color: 0xffffff, size: 0.09, transparent: true, opacity: 0.5, depthWrite: false })); scene.add(motes);

// ── sparks
const sparks = []; const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), sparkMat); m.visible = false; scene.add(m); sparks.push({ m, v: new THREE.Vector3(), t: 1 }); }
function burst(p, n = 24, col = 0xffd27a, force = 3.2) { sparkMat.color.set(col); let k = 0; for (const d of sparks) { if (d.t < 1) continue; d.m.visible = true; d.m.position.copy(p); d.v.set((Math.random() - 0.5) * force * 2, Math.random() * force, (Math.random() - 0.5) * force); d.t = 0; if (++k >= n) break; } }

// ───────────────────────── Tiger (chunky 3D) ─────────────────────────
const C = { o: 0xF2A93B, k: 0x1A1512, w: 0xF6F1E6, p: 0xF08A8A, e: 0x141414 };
const M = {}; for (const key in C) M[key] = new THREE.MeshStandardMaterial({ color: C[key], roughness: 0.9, emissive: C[key], emissiveIntensity: key === 'k' || key === 'e' ? 0 : 0.14 });
const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
const tiger = new THREE.Group(); lift.add(tiger); tiger.position.set(LIFT.tigerX, 0, 0); tiger.rotation.y = Math.PI;   // stands on the lift, facing the ledges
const body = new THREE.Group(); tiger.add(body);
box(1.3, 0.62, 0.72, M.o, 0, 0.63, 0, body);
box(0.14, 0.34, 0.5, M.w, 0.66, 0.5, 0, body);
box(1.0, 0.1, 0.5, M.w, 0.02, 0.31, 0, body);
for (const x of [-0.36, -0.02, 0.32]) box(0.13, 0.66, 0.76, M.k, x, 0.63, 0, body);
const head = new THREE.Group(); head.position.set(0.72, 1.02, 0); body.add(head);
box(0.95, 0.85, 0.92, M.o, 0, 0, 0, head);
for (const z of [-0.33, 0.33]) { box(0.24, 0.24, 0.16, M.o, 0.06, 0.5, z, head); box(0.12, 0.12, 0.17, M.p, 0.1, 0.48, z, head); }
for (const z of [-0.2, 0.2]) box(0.6, 0.05, 0.1, M.k, -0.1, 0.44, z, head);
for (const [y, w] of [[0.3, 0.3], [0.22, 0.22], [0.14, 0.3]]) box(0.03, 0.04, w, M.k, 0.48, y, 0, head);
box(0.03, 0.2, 0.045, M.k, 0.48, 0.22, 0, head);
const eyes = new THREE.Group(); head.add(eyes);
for (const z of [-0.24, 0.24]) { box(0.03, 0.2, 0.22, M.w, 0.475, 0.06, z, eyes); box(0.03, 0.13, 0.13, M.e, 0.49, 0.05, z - 0.02, eyes); box(0.035, 0.05, 0.05, M.w, 0.5, 0.1, z - 0.06, eyes); }
box(0.1, 0.3, 0.48, M.w, 0.5, -0.2, 0, head); box(0.05, 0.1, 0.16, M.p, 0.56, -0.1, 0, head); box(0.03, 0.03, 0.14, M.k, 0.56, -0.25, 0, head);
for (const z of [-0.14, 0.14]) box(0.03, 0.03, 0.03, M.k, 0.56, -0.17, z, head);
for (const z of [-0.42, 0.42]) box(0.03, 0.09, 0.09, M.p, 0.475, -0.06, z, head);
const legs = [[0.42, 0.26], [0.42, -0.26], [-0.42, 0.26], [-0.42, -0.26]].map(([x, z]) => { const g = new THREE.Group(); g.position.set(x, 0.36, z); body.add(g); box(0.26, 0.36, 0.26, M.o, 0, -0.18, 0, g); box(0.27, 0.09, 0.27, M.w, 0, -0.33, 0, g); return g; });
const tail = new THREE.Group(); tail.position.set(-0.65, 0.78, 0); body.add(tail);
{ const s1 = box(0.32, 0.13, 0.13, M.o, -0.15, 0.02, 0, tail); s1.rotation.z = 0.4; const s2 = box(0.3, 0.13, 0.13, M.o, -0.4, 0.2, 0, tail); s2.rotation.z = 1.0; const s3 = box(0.26, 0.13, 0.13, M.k, -0.52, 0.45, 0, tail); s3.rotation.z = 1.5; }
const tigerHit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 1.4), new THREE.MeshBasicMaterial({ visible: false })); scene.add(tigerHit);
const T = { blinkAt: 2.5, blink: false, hop: 0, hopV: 0, swipe: 0, lean: 0, headYaw: 0, headPitch: 0, sitT: 0, quipT: 0, quip: '' };

// ───────────────────────── Monsters ─────────────────────────
function mkEye(parent, x, y, z, r = 0.2, look = 1) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const w = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })); g.add(w);
  const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 10, 8), new THREE.MeshStandardMaterial({ color: 0x141414 })); p.position.set(r * 0.65 * look, 0, 0); g.add(p);
  const gl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffffff })); gl.position.set(r * 0.9 * look, r * 0.25, r * 0.25); g.add(gl);
  return g; }
function std(col, extra = {}) { return new THREE.MeshStandardMaterial({ color: col, roughness: 0.75, emissive: col, emissiveIntensity: 0.08, ...extra }); }
const BUILD = {
  slime(g, col, m) { const b = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 14), std(col)); b.scale.set(1.15, 0.8, 1); b.position.y = 0.8; g.add(b); m.eyes.push(mkEye(g, 0.55, 1.0, 0.45, 0.24), mkEye(g, 0.55, 1.0, -0.45, 0.24)); const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.5), std(0x141414)); mouth.position.set(1.0, 0.6, 0); g.add(mouth); m.bob = 0.08; },
  slug(g, col, m) { const b = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 14), std(col, { roughness: 0.35 })); b.scale.set(1.9, 0.62, 0.9); b.position.set(-0.4, 0.62, 0); g.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), std(col, { roughness: 0.35 })); hd.position.set(1.1, 0.9, 0); g.add(hd);
    for (const z of [-0.3, 0.3]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), std(col)); st.position.set(1.3, 1.6, z); g.add(st); m.eyes.push(mkEye(g, 1.3, 2.0, z, 0.2)); } m.bob = 0.04; },
  golem(g, col, m) { const cm = std(col); for (let i = -1; i <= 1; i++) for (let j = 0; j < 3; j++) for (let l = -1; l <= 1; l++) { if (Math.random() < 0.18) continue; const c = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.52), cm); c.position.set(i * 0.56, 0.28 + j * 0.56, l * 0.56); g.add(c); }
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), cm); hd.position.set(0, 2.1, 0); g.add(hd); m.eyes.push(mkEye(g, 0.46, 2.2, 0.25, 0.17), mkEye(g, 0.46, 2.2, -0.25, 0.17));
    for (const z of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.2, 0.42), cm); arm.position.set(0, 1.0, z * 1.05); g.add(arm); } m.bob = 0.02; },
  capsule(g, col, m) { const top = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.1, 6, 14), std(col)); top.position.y = 1.2; g.add(top); const bot = new THREE.Mesh(new THREE.CapsuleGeometry(0.63, 0.5, 6, 14), std(0xf3f0ea)); bot.position.y = 0.72; bot.scale.set(1, 0.6, 1); g.add(bot);
    m.eyes.push(mkEye(g, 0.55, 1.55, 0.25, 0.18), mkEye(g, 0.55, 1.55, -0.25, 0.18)); for (const z of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), std(col)); arm.position.set(0.2, 1.0, z * 0.78); arm.rotation.x = z * 0.5; g.add(arm); } m.bob = 0.05; },
  eye(g, col, m) { const big = mkEye(g, 0, 1.7, 0, 0.72); m.eyes.push(big); const iris = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), std(col)); iris.position.set(0.5, 0, 0); big.add(iris); const pup = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), std(0x141414)); pup.position.set(0.72, 0, 0); big.add(pup);
    for (const [x, z] of [[0.3, 0.55], [-0.5, 0], [0.3, -0.55]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), std(0x2a2a30)); leg.position.set(x, 0.65, z); leg.rotation.z = -x * 0.35; leg.rotation.x = z * 0.35; g.add(leg); }
    m.eyes.push(mkEye(g, 0.4, 2.55, 0.55, 0.22), mkEye(g, 0.4, 2.55, -0.55, 0.22)); m.bob = 0.06; },
  bee(g, col, m) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 12), std(0xf2c744)); b.scale.set(1.35, 0.9, 0.9); b.position.y = 1.4; g.add(b);
    for (const x of [-0.5, 0, 0.5]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.91, 18, 12), std(col)); s.scale.set(0.18, 0.9, 0.9); s.position.set(x, 1.4, 0); g.add(s); }
    m.eyes.push(mkEye(g, 1.1, 1.65, 0.3, 0.2), mkEye(g, 1.1, 1.65, -0.3, 0.2)); const sting = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), std(0x141414)); sting.rotation.z = Math.PI / 2; sting.position.set(-1.35, 1.35, 0); g.add(sting);
    for (const z of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); w.position.set(0, 2.05, z * 0.35); w.rotation.x = z * 0.4; g.add(w); m.wings.push(w); } m.bob = 0.14; m.fly = 0.9; },
  ghost(g, col, m) { const cm = std(col, { transparent: true, opacity: 0.9 }); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 14), cm); hd.position.y = 1.7; g.add(hd); const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 1.1, 18), cm); bd.position.y = 1.15; g.add(bd);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), cm); s.position.set(Math.cos(a) * 0.55, 0.62, Math.sin(a) * 0.55); g.add(s); }
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), std(0xdcdcdc)); bun.position.set(-0.3, 2.55, 0); g.add(bun);
    m.eyes.push(mkEye(g, 0.72, 1.85, 0.3, 0.19), mkEye(g, 0.72, 1.85, -0.3, 0.19)); for (const z of [-0.3, 0.3]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 6, 16), std(0x2a2a30)); r.position.set(0.9, 1.85, z); r.rotation.y = Math.PI / 2; g.add(r); }
    for (const z of [-1, 1]) { const arm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), cm); arm.position.set(0.3, 1.2, z * 1.0); g.add(arm); } m.bob = 0.12; m.fly = 0.4; },
  reel(g, col, m) { const rm = std(col); const r = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.5, 24), rm); r.rotation.x = Math.PI / 2; r.position.y = 1.3; g.add(r); m.spin = r;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const h = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.54, 12), std(0x141414)); h.rotation.x = Math.PI / 2; h.position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6); r.add(h); }
    m.eyes.push(mkEye(g, 0.3, 1.5, 0.35, 0.2), mkEye(g, 0.3, 1.5, -0.35, 0.2)); for (const z of [-0.3, 0.3]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), std(0x2a2a30)); leg.position.set(0, 0.25, z); g.add(leg); m.legs.push(leg); } m.bob = 0.05; m.run = 1; },
  tower(g, col, m) { const cm = std(col); let y = 0; [1.5, 1.25, 1.0, 0.8].forEach((w, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, w), cm); b.position.set(i * 0.12, y + 0.3, 0); g.add(b); y += 0.6; });
    m.eyes.push(mkEye(g, 0.75, 2.2, 0.22, 0.17), mkEye(g, 0.75, 2.2, -0.22, 0.17)); for (const z of [-0.6, 0.6]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14), std(0x2a2a30)); wh.rotation.x = Math.PI / 2; wh.position.set(0, 0.28, z); g.add(wh); } m.lean = 1; m.bob = 0.03; },
  piggy(g, col, m) { const pm = std(0xf4b6c2); const b = new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 12), pm); b.scale.set(1.3, 0.95, 1); b.position.y = 1.15; g.add(b);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.3, 12), std(0xe996a8)); snout.rotation.z = Math.PI / 2; snout.position.set(1.35, 1.05, 0); g.add(snout); for (const z of [-0.1, 0.1]) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), std(0x5a2a36)); n.position.set(1.52, 1.05, z); g.add(n); }
    m.eyes.push(mkEye(g, 1.05, 1.5, 0.4, 0.18), mkEye(g, 1.05, 1.5, -0.4, 0.18)); for (const z of [-0.45, 0.45]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), pm); ear.position.set(0.5, 2.05, z); g.add(ear); }
    for (const [x, z] of [[0.7, 0.45], [0.7, -0.45], [-0.7, 0.45], [-0.7, -0.45]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.28), pm); leg.position.set(x, 0.25, z); g.add(leg); }
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.1), std(0x141414)); slot.position.set(0, 2.08, 0); g.add(slot); const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12), std(col, { emissiveIntensity: 0.3 })); coin.rotation.x = Math.PI / 2; coin.position.set(0, 2.3, 0); g.add(coin); m.bob = 0.04; },
  knot(g, col, m) { const kn = new THREE.Mesh(new THREE.TorusKnotGeometry(0.72, 0.2, 90, 10, 2, 3), std(0xd23a3a, { roughness: 0.6 })); kn.position.y = 1.35; g.add(kn); m.spin = kn;
    m.eyes.push(mkEye(g, 0.85, 1.7, 0.2, 0.19), mkEye(g, 0.75, 1.1, -0.45, 0.16), mkEye(g, 0.5, 1.95, -0.3, 0.14)); m.bob = 0.06; },
};

// ───────────────────────── Ledges + monsters + shore (positions depend on layout → built after measure) ─────────────────────────
const stoneTex = stoneTexture(); const sideTex = stoneTexture();
const wallMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xdfe3f2, roughness: 0.95 });
const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, color: 0xb9bdd0, roughness: 0.95 });
const world = { built: false, walls: [], ledges: [], monsters: [], shore: null, yTop: 0, yBottom: 0, landY: 0, shoreY: 0 };
const liftYAt = (s) => -(s - R.descent.top) / (vh * BLOCK_VH) * FLOOR_H;                        // the rail: linear in scroll
const alignScroll = (k) => R.descent.top + (k - 1) * vh * BLOCK_VH + vh * BLOCK_VH / 2 - vh / 2;   // block k centred in the viewport
function buildWorld() {
  world.ledges.forEach((l) => scene.remove(l.g)); world.monsters.forEach((m) => { scene.remove(m.g); scene.remove(m.shadow); scene.remove(m.loot); }); world.walls.forEach((w) => scene.remove(w)); if (world.shore) scene.remove(world.shore);
  world.ledges = []; world.monsters = []; world.walls = [];
  const ledgeY = (k) => liftYAt(alignScroll(k));
  world.landY = ledgeY(NP) - FLOOR_H; world.shoreY = world.landY - 0.05;
  world.yTop = liftYAt(0) + 0.6; world.yBottom = world.landY + 9.5;    // the shaft opens well above the landing so the meadow fills the frame
  const H = world.yTop - world.yBottom; stoneTex.repeat.set(6, H / 5); sideTex.repeat.set(2, H / 5);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(30, H), wallMat); back.position.set(0, (world.yTop + world.yBottom) / 2, -2.8); back.receiveShadow = true; scene.add(back); world.walls.push(back);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(10, H), sideMat); m.position.set(s * 10.5, (world.yTop + world.yBottom) / 2, 2.2); m.rotation.y = -s * Math.PI / 2; m.receiveShadow = true; scene.add(m); world.walls.push(m); }
  // the mouth of the shaft: a rim and the gantry the chains hang from
  for (const x of [-4.5, 7.5]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), postMat); post.position.set(x, world.yTop + 4.7, 0); scene.add(post); world.walls.push(post); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.5, 0.6), postMat); beam.position.set(1.5, world.yTop + 8.2, 0); scene.add(beam); world.walls.push(beam);
  // ledges
  for (let k = 1; k <= NP; k++) { const y = ledgeY(k); const proj = PIECES[k - 1]; const col = new THREE.Color(CATS[proj.cat].color); const g = new THREE.Group(); scene.add(g);
    const w = LIFT.ledgeX[1] - LIFT.ledgeX[0], cx = (LIFT.ledgeX[0] + LIFT.ledgeX[1]) / 2;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 4.4), slabMat); slab.position.set(cx, y - 0.35, 0); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.06, 4.2), slabTop); top.position.set(cx, y + 0.02, 0); top.receiveShadow = true; g.add(top);
    const tx = LIFT.ledgeX[0] + 1.2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.7, 6), postMat); post.position.set(tx, y + 0.85, -1.7); post.castShadow = true; g.add(post);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, roughness: 1 })); flame.position.set(tx, y + 1.78, -1.7); g.add(flame);
    const light = new THREE.PointLight(col.clone().lerp(new THREE.Color(0xffd9a0), 0.3), LIGHT.torch.intensity, LIGHT.torch.distance, LIGHT.torch.decay); light.position.set(tx, y + 1.9, -1.2); g.add(light);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.set(tx, y + 1.8, -1.6); glow.scale.setScalar(2.2); g.add(glow);
    world.ledges.push({ k, y, g, torch: { flame, light, glow, seed: Math.random() * 10, base: LIGHT.torch.intensity } });
    // the monster
    const mg = new THREE.Group(); const m = { k, proj, col, g: mg, eyes: [], wings: [], legs: [], bob: 0.05, fly: 0, spin: null, run: 0, lean: 0, y, dead: false, x: LIFT.monsterX };
    BUILD[proj.monster.kind](mg, col, m); mg.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); mg.position.set(m.x, y, 0); scene.add(mg);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.set(m.x, y + 0.04, 0); scene.add(shadow); m.shadow = shadow;
    const loot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, transparent: true })); loot.visible = false; scene.add(loot); m.loot = loot;
    world.monsters.push(m);
  }
  // the shore
  const sy = world.shoreY; const shore = new THREE.Group(); scene.add(shore); world.shore = shore;
  { const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 60, 60, 40), new THREE.MeshStandardMaterial({ color: 0x6fa85a, roughness: 1 }));
    const pos = ground.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getY(i); pos.setZ(i, 0.18 * Math.sin(x * 0.4) * Math.cos(z * 0.35) + 0.08 * Math.sin(x * 1.3 + z)); } ground.geometry.computeVertexNormals();
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, sy, -8); ground.receiveShadow = true; shore.add(ground);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), new THREE.MeshStandardMaterial({ color: 0x8fc4d8, roughness: 0.25, metalness: 0.1 })); water.rotation.x = -Math.PI / 2; water.position.set(0, sy - 0.12, 20); shore.add(water);
    const bank = new THREE.Mesh(new THREE.BoxGeometry(90, 0.5, 2.4), new THREE.MeshStandardMaterial({ color: 0x8a7a56, roughness: 1 })); bank.position.set(0, sy - 0.3, 5.6); shore.add(bank);
    const gN = 900; const grass = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0x7fbf64, roughness: 1 }), gN);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < gN; i++) { const x = (Math.random() - 0.5) * 40, z = 4 - Math.random() * 26; e.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4); q.setFromEuler(e); p.set(x, sy + 0.2, z); sc.set(1, 0.6 + Math.random() * 0.9, 1); mm.compose(p, q, sc); grass.setMatrixAt(i, mm); }
    grass.castShadow = true; shore.add(grass);
    const petalCols = [0xf6c1cf, 0xffe28a, 0xffffff, 0xf2a93b, 0xc7b8ff];
    for (let i = 0; i < 70; i++) { const x = (Math.random() - 0.5) * 36, z = 3 - Math.random() * 22; const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x4f8f3a })); stem.position.set(x, sy + 0.25, z); shore.add(stem);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ color: petalCols[i % petalCols.length], roughness: 0.8 })); hd.position.set(x, sy + 0.52, z); shore.add(hd); }
    for (const [x, z, s] of [[-9, -9, 1.3], [8, -12, 1.6], [12, -6, 1.1], [-13, -4, 1.0]]) { const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.3 * s, 1.6 * s, 7), new THREE.MeshStandardMaterial({ color: 0x5a4030 })); trunk.position.set(x, sy + 0.8 * s, z); trunk.castShadow = true; shore.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.4 * s, 12, 10), new THREE.MeshStandardMaterial({ color: 0x5f9e4a, roughness: 1 })); crown.position.set(x, sy + 2.4 * s, z); crown.castShadow = true; shore.add(crown); }
    for (let i = 0; i < 7; i++) { const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(128, 0.3), color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })); c.position.set((Math.random() - 0.5) * 60, sy + 9 + Math.random() * 5, -28 - Math.random() * 10); c.scale.set(9 + Math.random() * 8, 3 + Math.random() * 2, 1); shore.add(c); } }
  world.built = true;
}

// ───────────────────────── Layout measurements ─────────────────────────
const R = {};
function measure() {
  vh = innerHeight; vw = innerWidth;
  for (const id of ['header', 'hero', 'intro', 'descent', 'shore', 'archives', 'footer']) { const el = $(id); const r = el.getBoundingClientRect(); R[id] = { top: r.top + scroll, h: r.height }; }
  texts.forEach((t) => { const r = t.el.getBoundingClientRect(); t.top = r.top + scroll; t.h = r.height; });
  renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.updateProjectionMatrix();
  buildWorld();
}

// ───────────────────────── HUD / sky / cursor / quip ─────────────────────────
const nextCtx = $('next').getContext('2d');
function drawNext(k) { const c = nextCtx; c.clearRect(0, 0, 88, 44); if (k >= NP) return; c.fillStyle = CATS[PIECES[k].cat].color; c.beginPath(); c.roundRect(28, 8, 32, 30, 8); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(38, 20, 4, 0, 7); c.arc(50, 20, 4, 0, 7); c.fill(); c.fillStyle = '#141414'; c.beginPath(); c.arc(39, 20, 2, 0, 7); c.arc(51, 20, 2, 0, 7); c.fill(); }
let skyStage = 0; const skyTarget = new THREE.Color(SKY.pure);
function setSky(stage, cat) {
  const base = new THREE.Color(stage === 2 ? SKY.shore : stage === 1 ? SKY.projects : SKY.pure);
  if (stage === 1 && cat) base.lerp(tmpC.set(CATS[cat].tint), 0.3);
  skyTarget.copy(base);
  if ((stage === 2) !== document.body.classList.contains('light')) { document.body.classList.toggle('light', stage === 2); document.body.style.backgroundColor = stage === 2 ? SKY.shore : SKY.pure; }
  skyStage = stage;
}
const cursor = $('cursor'), pill = $('cursor-pill'), blob = $('blob'); let pillShown = false, pillText = '';
const mx = { x: -100, y: -100, cx: -100, cy: -100 };
window.addEventListener('pointermove', (e) => { mx.x = e.clientX; mx.y = e.clientY; mouse.x = (e.clientX / vw) * 2 - 1; mouse.y = (e.clientY / vh) * 2 - 1; });
function setPill(text) { if (text === pillText) return; pillText = text; if (text) { pill.textContent = text; if (!pillShown) { pillShown = true; gsap.to(pill, { '--reveal': 1, duration: MOTION.cursor.inDuration, ease: MOTION.cursor.inEase, overwrite: true }); } } else if (pillShown) { pillShown = false; gsap.to(pill, { '--reveal': 0, duration: MOTION.cursor.outDuration, ease: MOTION.cursor.outEase, overwrite: true }); } }
const quipEl = $('quip'); const v3 = new THREE.Vector3(); const quipAt = new THREE.Vector3(NaN, NaN, NaN);
function say(text, dur = 2.6, who = 'KOOKYTIGER', at = null) { T.quip = text; T.quipT = dur; quipEl.textContent = text; quipEl.dataset.who = who + '  '; if (at) quipAt.copy(at); else quipAt.set(NaN, NaN, NaN); }
const ray = new THREE.Raycaster(); let hoverTiger = false;
canvas.addEventListener('click', () => { if (!hoverTiger) return; T.hopV = 4.2; shake.v = 0.08; say(['kooky.', 'again?', 'which floor is this.', 'that tickles.', 'i’ve seen worse monsters.'][Math.floor(Math.random() * 5)]); });

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
let last = performance.now(), cleared = 0, lastPop = -1, shoreMix = 0, lvFlashT = 0, saidShore = false, vel = 0, lastScroll = 0;
const tiltEls = [document.querySelector('.hero .words'), document.querySelector('.shore .content > div')];
function frame(now) {
  const dt = SNAP ? 0.2 : Math.min(0.05, (now - last) / 1000); last = now;
  lenis.raf(now); scroll = lenis.animatedScroll ?? scrollY;
  if (!R.descent) measure();
  const t = now / 1000;
  vel += (((scroll - lastScroll) / Math.max(dt, 1e-3)) - vel) * Math.min(1, dt * 6); lastScroll = scroll;   // px/s, smoothed

  // ── phase progress
  const headerP = clamp(scroll / R.header.h, 0, 1);
  const inWhite = scroll > R.hero.top - vh * 0.15 && scroll < R.descent.top - vh * 0.6;
  const shoreQ = clamp((scroll - R.shore.top) / (R.shore.h - vh), 0, 1);
  const inDescent = scroll >= R.descent.top - vh * 0.6 && scroll < R.shore.top + (R.shore.h - vh) * 0.95;
  const afterShore = scroll >= R.archives.top - vh * 0.4;
  canvas.classList.toggle('dim', inWhite || afterShore);
  const overlayOn = scroll >= R.descent.top - vh * 0.2 && scroll < R.shore.top - vh * 0.1;
  $('overlay').classList.toggle('on', overlayOn); if (overlayOn) descentTitle.reveal(); else descentTitle.hide();

  // ── header content: Léo's parallax + fade
  const hc = document.querySelector('.header .content');
  hc.style.transform = `translate3d(0, ${(-headerP * MOTION.header.parallax * 0.35).toFixed(1)}px, 0)`;
  hc.style.opacity = 1 - smooth((headerP - MOTION.header.fadeStart) / (MOTION.header.fadeEnd - MOTION.header.fadeStart));

  // ── text reveals by local progress (replay on re-scroll)
  for (const tx of texts) { if (tx.fixed || tx.el.id === 'h-statement' || tx.el.id === 'h-scroll') continue; const pr = (scroll + vh - tx.top) / (tx.h + vh * 0.35); if (pr > 0.12) tx.reveal(); else if (pr <= 0) tx.hide(); }
  if (!heroShown && scroll + vh > R.hero.top + vh * 0.35) { heroShown = true; gsap.to(heroWords.map((w) => w.querySelector('.main')), { yPercent: 0, duration: MOTION.reveal.duration, ease: 'reveal', stagger: MOTION.reveal.heroStagger }); }
  if (shoreQ > 0.4) shoreTexts.forEach((tx) => tx.reveal()); else if (shoreQ < 0.3) shoreTexts.forEach((tx) => tx.hide());

  // ── the lift: the rail, clamped at the landing
  const rawY = liftYAt(scroll); const landed = rawY <= world.landY; const liftY = Math.max(rawY, world.landY);
  lift.position.set(LIFT.x, liftY, 0);
  const sway = clamp(-vel * 0.00012, -0.035, 0.035); lift.rotation.z += (sway - lift.rotation.z) * Math.min(1, dt * 4);      // the whole lift leans into acceleration
  const lan = lift.userData.lantern; lan.rotation.z += (clamp(-vel * 0.0009, -0.3, 0.3) - lan.rotation.z) * Math.min(1, dt * 3); lan.rotation.z += Math.sin(t * 1.7) * 0.002;
  lift.userData.light.intensity = LIGHT.lamp.intensity * (1 + 0.05 * Math.sin(t * 8.1) + 0.03 * Math.sin(t * 13.7)) * (1 - shoreMix * 0.7);

  // ── monsters: everything from a = (liftY - ledgeY) / FLOOR_H
  let clearedNow = 0, popEvent = -1, nearest = null, nearestA = 9;
  for (const m of world.monsters) {
    const a = (liftY - m.y) / FLOOR_H;
    if (Math.abs(a) < Math.abs(nearestA)) { nearest = m; nearestA = a; }
    const hopU = smooth(seg(a, FIGHT.hop));                        // 0 far → 1 at the ledge edge
    const popU = a <= FIGHT.hit ? seg(a, FIGHT.pop) : 0;            // 0 alive → 1 gone
    const gone = popU >= 1; if (gone && !m.dead) { m.dead = true; popEvent = m.k; } if (!gone) m.dead = false; if (gone) clearedNow++;
    const x = lerp(LIFT.monsterX, LIFT.monsterHopX, hopU); const hop = Math.sin(Math.PI * hopU) * 0.6;
    const hover = m.fly ? Math.sin(t * 2.1 + m.k) * m.fly * 0.25 + m.fly * 0.6 : 0; const bob = Math.sin(t * 3 + m.k) * m.bob;
    const alive = 1 - smooth(popU); const sq = Math.sin(Math.PI * clamp(popU * 2, 0, 1));
    m.g.position.set(x, m.y + hop + hover + bob, 0); m.g.scale.set(alive * (1 + sq * 0.35), alive * (1 - sq * 0.45), alive * (1 + sq * 0.35)); m.g.visible = alive > 0.01;
    m.shadow.position.set(x, m.y + 0.04, 0); m.shadow.visible = m.g.visible; m.shadow.material.opacity = 0.25 * alive / (1 + hop * 2);
    if (m.lean) m.g.rotation.z = -0.12 + Math.sin(t * 1.4 + m.k) * 0.08;
    if (m.spin) m.spin.rotation.z += dt * (m.run ? 3 : 0.8);
    m.wings.forEach((w, i) => { w.rotation.x = (i ? 1 : -1) * (0.4 + Math.sin(t * 40) * 0.5); });
    m.legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 12 + i * Math.PI) * 0.5; });
    // it notices the lift coming: eyes look up at the tiger, then level as they align
    const look = Math.abs(a) < FIGHT.notice ? clamp(a * 2.2, -0.5, 0.5) : 0;
    m.eyes.forEach((e, i) => { e.rotation.z += (look - e.rotation.z) * Math.min(1, dt * 6); e.rotation.y = Math.sin(t * 0.9 + m.k + i) * 0.1; });
    // loot: pops out, floats to the tiger's chest, shrinks away
    const lu = a <= FIGHT.hit ? seg(a, FIGHT.loot) : 0;
    if (lu > 0 && lu < 1) { m.loot.visible = true; const u = smooth(lu); m.loot.position.set(lerp(LIFT.monsterHopX, LIFT.x + LIFT.tigerX, u), lerp(m.y + 1.4 + Math.sin(Math.PI * u) * 1.2, liftY + 0.9, u), 0.3); m.loot.rotation.y = t * 2; m.loot.rotation.x = t * 1.3; m.loot.scale.setScalar(1 - u * 0.7); m.loot.material.opacity = 1 - u * u; } else m.loot.visible = false;
  }
  if (popEvent >= 0 && popEvent !== lastPop) { const m = world.monsters[popEvent - 1]; burst(new THREE.Vector3(LIFT.monsterHopX, m.y + 1.2, 0.4), 30, m.col.getHex(), 3.8); shake.v = 0.14; say(m.proj.monster.line, 2.4, m.proj.monster.name.toUpperCase(), new THREE.Vector3(LIFT.monsterHopX, m.y + 2.6, 0)); lvFlashT = 1.2; }
  if (popEvent >= 0) lastPop = popEvent; if (clearedNow === 0) lastPop = -1;
  cleared = clearedNow;
  // the tiger's swipe follows the nearest monster's alignment
  const aN = nearest ? nearestA : 9;
  const swipe = Math.abs(aN) < 0.3 ? Math.sin(Math.PI * seg(aN, FIGHT.swipe)) : 0;
  T.swipe += (swipe - T.swipe) * Math.min(1, dt * 16);
  const attend = nearest && Math.abs(aN) < FIGHT.notice && !nearest.dead ? 1 : 0;      // look at the monster
  const targetYaw = attend ? 0 : (landed ? 0 : -0.9);                                   // otherwise glance at you (head only)
  const targetPitch = attend ? clamp(-aN * 1.6, -0.5, 0.5) : 0;
  T.headYaw += (targetYaw - T.headYaw) * Math.min(1, dt * 4); T.headPitch += (targetPitch - T.headPitch) * Math.min(1, dt * 5);
  const sitting = landed && shoreQ > 0.25; T.sitT += ((sitting ? 1 : 0) - T.sitT) * Math.min(1, dt * 4);
  if (sitting && !saidShore) { saidShore = true; say(COPY.shore.tiger, 5); } if (!landed) saidShore = false;

  // ── sky stages
  const dp = (scroll - R.descent.top) / (vh * BLOCK_VH);
  const stage = landed || dp > NP - 0.05 ? 2 : (dp > 0.02 ? 1 : 0);
  const kNow = clamp(Math.floor(dp) + 1, 1, NP);
  if (stage !== skyStage || stage === 1) setSky(stage, stage === 1 ? PIECES[kNow - 1].cat : null);
  const lk = 1 - Math.pow(0.001, dt / (SKY.flipMs / 1000));
  shoreMix = lerp(shoreMix, stage === 2 ? 1 : 0, lk);
  skyColor.lerp(skyTarget, lk); scene.fog.color.copy(skyColor);
  key.intensity = lerp(key.intensity, LIGHT.key.intensity[stage], lk); key.color.lerp(tmpC.set(stage === 2 ? LIGHT.key.colorShore : LIGHT.key.color), lk);
  hemi.intensity = lerp(hemi.intensity, LIGHT.hemi.intensity[stage], lk); hemi.color.lerp(tmpC.set(stage === 2 ? LIGHT.hemi.skyShore : LIGHT.hemi.sky), lk); hemi.groundColor.lerp(tmpC.set(stage === 2 ? LIGHT.hemi.groundShore : LIGHT.hemi.ground), lk);
  scene.fog.near = lerp(scene.fog.near, stage === 2 ? 30 : 14, lk); scene.fog.far = lerp(scene.fog.far, stage === 2 ? 110 : 42, lk);
  stars.material.opacity = lerp(stars.material.opacity, stage === 0 ? 0.8 : 0, lk);
  for (const l of world.ledges) { const tr = l.torch; const flick = 1 + 0.08 * Math.sin(t * 9.3 + tr.seed) + 0.05 * Math.sin(t * 17.1 + tr.seed * 2); tr.light.intensity = tr.base * flick * (1 - shoreMix * 0.6); tr.flame.scale.setScalar(0.9 + 0.15 * flick); tr.glow.material.opacity = 0.35 * flick; }

  // ── tiger: stands still; breathes, blinks, looks, swipes once per floor, sits on the grass
  const breathe = 1 + Math.sin(t * 1.6) * 0.012;
  legs.forEach((g) => { g.rotation.z = 0; });
  legs[2].rotation.z = lerp(0, 1.25, T.sitT); legs[3].rotation.z = lerp(0, 1.25, T.sitT);
  legs[1].rotation.z = -1.55 * T.swipe; legs[0].rotation.z = -0.35 * T.swipe;
  body.rotation.z = lerp(0, 0.32, T.sitT) - 0.22 * T.swipe;
  body.position.x = -0.22 * T.swipe;
  head.rotation.z = -0.18 * T.sitT - 0.1 * T.swipe + T.headPitch * 0.6;
  head.rotation.y = T.headYaw;
  tail.rotation.y = Math.sin(t * 3.2) * 0.3 + Math.sin(t * 9) * 0.1 * T.swipe;
  T.blinkAt -= dt; if (T.blinkAt < 0) { T.blink = !T.blink; T.blinkAt = T.blink ? 0.12 : 2.2 + Math.random() * 3; }
  eyes.scale.y += ((T.blink ? 0.08 : 1) - eyes.scale.y) * Math.min(1, dt * 30);
  T.hopV -= 16 * dt; T.hop = Math.max(0, T.hop + T.hopV * dt); if (T.hop === 0 && T.hopV < 0) T.hopV = 0;
  tiger.position.set(LIFT.tigerX, T.hop - 0.06 * T.sitT, 0);
  tiger.scale.set(1, breathe * (1 - Math.min(0.1, Math.abs(T.hopV) * 0.02)), 1);
  tigerHit.position.set(LIFT.x + LIFT.tigerX, liftY + 0.9, 0);
  T.quipT -= dt; if (T.quipT <= 0 && T.quip) T.quip = '';
  quipEl.classList.toggle('on', !!T.quip && !(inWhite || afterShore));
  if (T.quip) { if (isNaN(quipAt.x)) v3.set(LIFT.x + LIFT.tigerX, liftY + T.hop + 1.9, 0); else v3.copy(quipAt); v3.project(camera); quipEl.style.transform = `translate(${((v3.x + 1) / 2 * vw).toFixed(0)}px, ${((1 - v3.y) / 2 * vh - 8).toFixed(0)}px) translate(-50%, -100%)`; }

  // ── camera: rides the lift (Léo's rail) + Laurens's mouse orbit; header/landing drifts are linear in scroll
  const hz = CAMERA.header.rangeZ * headerP, hp = CAMERA.header.rangePitch * headerP;
  const sq = landed ? shoreQ : 0;
  mouse.sx += (mouse.x - mouse.sx) * MOUSE.damping; mouse.sy += (mouse.y - mouse.sy) * MOUSE.damping;
  shake.v *= 0.9;
  const camX = vw > 800 ? CAMERA.x : CAMERA.x + 1.6;
  camera.position.set(camX + (Math.random() - 0.5) * shake.v, liftY + CAMERA.above - CAMERA.shore.rangeY * sq + (Math.random() - 0.5) * shake.v, CAMERA.z + hz + CAMERA.shore.rangeZ * sq);
  camera.rotation.set(lerp(CAMERA.pitch + hp, CAMERA.shore.pitchTo, sq) - mouse.sy * MOUSE.pitch * 1.6, -mouse.sx * MOUSE.yaw * 1.6, 0, 'YXZ');
  key.position.set(6, liftY + 12, 12); key.target.position.set(0, liftY - 2, 0); key.target.updateMatrixWorld();
  mouse.hx += (mouse.x - mouse.hx) * MOUSE.headline.damping; mouse.hy += (mouse.y - mouse.hy) * MOUSE.headline.damping;
  const tilt = `translate3d(${(mouse.hx * MOUSE.headline.x).toFixed(2)}px, ${(mouse.hy * MOUSE.headline.y).toFixed(2)}px, 0) rotateY(${(mouse.hx * MOUSE.headline.rotY).toFixed(3)}deg) rotateX(${(-mouse.hy * MOUSE.headline.rotX).toFixed(3)}deg)`;
  tiltEls.forEach((el) => { if (el) el.style.transform = tilt; });
  mouse.bx += (mx.x - mouse.bx) * MOUSE.blob.follow * Math.min(1, dt * 12); mouse.by += (mx.y - mouse.by) * MOUSE.blob.follow * Math.min(1, dt * 12);
  blob.style.transform = `translate3d(${mouse.bx.toFixed(1)}px, ${mouse.by.toFixed(1)}px, 0)`;

  // ── motes ride with the lift
  for (let i = 0; i < MOTES; i++) { let y = motePos[i * 3 + 1] + Math.sin(t * 0.5 + moteSeed[i]) * 0.15 * dt; motePos[i * 3] += Math.sin(t * 0.3 + moteSeed[i] * 2) * 0.1 * dt; const rel = y - liftY; if (rel > 9) y -= 18; else if (rel < -9) y += 18; motePos[i * 3 + 1] = y; }
  moteGeo.attributes.position.needsUpdate = true; motes.material.opacity = 0.5 * (1 - shoreMix);
  for (const d of sparks) { if (d.t >= 1) continue; d.t += dt * 1.5; d.v.y -= 8 * dt; d.m.position.addScaledVector(d.v, dt); d.m.scale.setScalar(Math.max(0.001, 1 - d.t)); if (d.t >= 1) d.m.visible = false; }

  // ── HUD
  if (inDescent) {
    $('h-piece').textContent = String(kNow).padStart(2, '0') + ' / ' + NP; drawNext(kNow);
    lvFlashT -= dt; const lv = $('h-xy'); lv.textContent = lvFlashT > 0 ? COPY.descent.levelUp : 'LV ' + String(cleared + 1).padStart(2, '0'); lv.classList.toggle('up', lvFlashT > 0);
    $('h-lines').textContent = String(cleared).padStart(2, '0');
    [...stackEl.children].forEach((el, i) => el.classList.toggle('on', world.monsters[i].dead));
  }

  // ── cursor
  mx.cx += (mx.x - mx.cx) * 0.25; mx.cy += (mx.y - mx.cy) * 0.25;
  cursor.style.transform = `translate3d(${mx.cx.toFixed(1)}px, ${mx.cy.toFixed(1)}px, 0)`;
  ray.setFromCamera(new THREE.Vector2(mouse.x, -mouse.y), camera); hoverTiger = !inWhite && !afterShore && ray.intersectObject(tigerHit).length > 0;
  const overLink = document.elementFromPoint(mx.x, mx.y)?.closest?.('a, button');
  setPill(hoverTiger ? COPY.descent.hover : overLink ? 'open' : (scroll < vh * 0.4 && booted ? 'scroll' : ''));

  window.__dbg = { cam: camera.position.toArray().map((v) => +v.toFixed(2)), liftY: +liftY.toFixed(2), landed, aN: +aN.toFixed(3), dp: +dp.toFixed(2) };
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
window.addEventListener('resize', measure);
measure();
requestAnimationFrame(frame);
