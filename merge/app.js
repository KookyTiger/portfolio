// KookyTiger — MERGED LAYOUT (Léo × Laurens), motion pass.
//   Camera  = Léo: position is a LINEAR function of page scroll (Lenis is the only smoothing), rotation never changes,
//             header dollies down 2.4 / forward 4 over 200vh, then a straight vertical descent — even under paper.
//   Tiger   = Laurens: the character keeps one place on the right of the frame; its CLIPS are scrubbed by scroll
//             (clip time = f(scroll)), root motion stripped (the world moves, not the tiger); idle → turnToWall →
//             overEdge → climbing (loop) → landing → turnAround → sit, with a head-glance layer and time-driven idle bits.
//   The rig below is a procedural placeholder with the same clip grammar, so a skinned GLB can replace it later:
//   each state is a function of (scroll phase) → pose, exactly like `action.time = f(scroll)`.
import * as THREE from './vendor/three.module.min.js';
import { CATS, SIL, PIECES, SECTIONS, TITLE_SCREENS, VALUE_SCREENS, THEMES, CARD_ART, SCREEN_PER_CARD, SHORE_SCREENS, SHORE_TEXT_AT, RATE, CAMERA, TIGER, LEDGE_X, DECK, COPY, ARCHIVE, MOUSE, MOTION, SKY, LIGHT } from './content.js';

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
const NWORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'][NP] || String(NP);
const tpl = (t) => t.replace(/\{N_UP\}/g, NWORD.toUpperCase()).replace(/\{N_CAP\}/g, NWORD[0].toUpperCase() + NWORD.slice(1)).replace(/\{N\}/g, NWORD);
$('ld-sub').textContent = tpl(COPY.loader.sub);
$('nav-brand').innerHTML = `${COPY.nav.name}<span>${COPY.nav.sub}</span>`;
$('nav-links').textContent = 'Product, film, games, analytics';
$('nav-right').innerHTML = COPY.nav.links.map((l, i) => `<a href="#" data-to="${['title0', 'intro', 'archives'][i]}">${l}</a>`).join('');
$('h-statement').innerHTML = COPY.header.statement.map(tpl).join('<br>');
$('h-scroll').textContent = COPY.header.scroll;
$('hero-words').innerHTML = COPY.hero.words.map((w, i) => `<span class="word"><span class="main">${w}</span><span class="alt">${COPY.hero.reveal[i]}</span></span>`).join('') + `<div class="ind">${COPY.hero.indication}</div>`;
$('hero-l').innerHTML = `Raised in Wuhan<br>Designing anywhere`;
$('hero-r').innerHTML = `Northwestern ’27<br>MaDE + RTVF`;
$('intro-big').innerHTML = COPY.intro.big.map((t) => `<p class="split">${t}</p>`).join('');
$('intro-small').innerHTML = COPY.intro.small.map((t) => `<p class="split">${t}</p>`).join('');
$('intro-reel').textContent = COPY.intro.reel;
const cardArt = (p) => { const src = CARD_ART === 'photo' ? (p.img || p.silImg) : (p.silImg || p.img); return src ? `<img src="${src}" alt="${p.name}" loading="lazy" decoding="async">` : `<svg viewBox="0 0 200 140" role="img" aria-label="${p.name}">${SIL[p.sil]}</svg><figcaption>placeholder · silhouette of the object</figcaption>`; };
const body = $('body'); let html = '';
const deckIdx = SECTIONS.findIndex((x) => x.deck);
const projText = (p, pi) => `<div class="text"><p class="eyebrow mono"><span class="n">${String(pi + 1).padStart(2, '0')} / ${NP}</span><span>${CATS[p.cat].name}</span><span>${p.year}</span></p>
    <h2>${p.name}</h2><p class="desc">${p.desc}</p><p class="take">${p.take}</p><p class="more mono">${COPY.cursor.card} ↗</p></div>`;
SECTIONS.forEach((sec, w) => {
  const last = w === SECTIONS.length - 1; const idx = sec.pieces; const dark = THEMES[sec.theme].ink === 'light';
  // screens the projects take: one per floating object, or entry + hold + exit when they live on the computer's screen
  const span = sec.deck ? DECK.entry + (idx.length - 1) + DECK.exit : idx.length * SCREEN_PER_CARD;
  const n = span + VALUE_SCREENS + (last ? SHORE_SCREENS : 0);
  html += `<section class="paper st title" id="title${w}" style="--n:${TITLE_SCREENS}"><div class="wrap"><p class="eyebrow mono">${sec.num} / ${String(SECTIONS.length).padStart(2, '0')} · ${idx.length} ${COPY.section.projects}</p><div class="big" id="title-big${w}">${sec.title.split(' & ').map((l, i, a) => `<span class="line">${l}${i < a.length - 1 ? ' &amp;' : ''}</span>`).join('')}</div><p class="sub split">${sec.sub}</p></div></section>`;
  html += `<section class="window${dark ? ' dark' : ''}" id="win${w}" data-theme="${sec.theme}" style="--n:${n}" aria-label="${sec.title}">`;
  if (!sec.deck) idx.forEach((pi, j) => { const p = PIECES[pi]; html += `<article class="card${p.wide ? ' wide' : ''}" style="--i:${j * SCREEN_PER_CARD}" data-p="${pi}"><div class="in" role="button" tabindex="0" aria-label="Open ${p.name}">
    <figure>${cardArt(p)}</figure>${projText(p, pi)}</div></article>`; });
  // the value statement: over the room, char by char (Léo's library statement) — never paper on paper
  html += `<div class="value-text${dark ? '' : ' halo'}" style="--i:${span}"><div class="big" id="value-big${w}">${sec.value.map((l) => `<span class="line">${tpl(l)}</span>`).join('')}</div></div>`;
  if (last) html += `<div class="shore-text" style="--i:${span + VALUE_SCREENS + SHORE_TEXT_AT}"><div class="big" id="shore-big">${COPY.shore.words.map((x) => `<span class="split" style="display:block">${x}</span>`).join('')}</div><div class="sub split">${tpl(COPY.shore.sub)}</div><br><a class="sayhi" href="mailto:${COPY.footer.email}">${COPY.shore.sayhi}</a></div>`;
  html += `</section>`;
});
body.innerHTML = html;
// the computer's screen (floor 03): a fixed overlay laid over the projected screen plane every frame; one preview per screen of scroll
const deckEl = $('deck');
if (deckIdx >= 0) { const sec = SECTIONS[deckIdx], n = sec.pieces.length;
  deckEl.innerHTML = `<div class="screen" style="--n:${n}"><div class="strip" id="deck-strip">${sec.pieces.map((pi, j) => { const p = PIECES[pi]; return `<article class="slide" data-p="${pi}" data-j="${j}"><div class="in" role="button" tabindex="0" aria-label="Open ${p.name}"><div class="bar mono"><span class="dots"><i></i><i></i><i></i></span><span class="name">${p.name}</span><span>${CATS[p.cat].name}</span></div><div class="body"><figure>${cardArt(p)}</figure>${projText(p, pi)}</div></div></article>`; }).join('')}</div>
    <div class="hud mono"><span id="deck-n">01 / ${String(n).padStart(2, '0')}</span><span class="track"><i id="deck-bar"></i></span><span class="keys">← → · drag</span></div></div>`; }
$('arch-head').innerHTML = `<span class="split">${COPY.archives.title}</span><span class="mono">${COPY.archives.note}</span>`;
$('arch-table').innerHTML = ARCHIVE.map((r, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td><b>${r[0]}</b><span>${r[1]}</span></td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('');
$('foot-words').innerHTML = COPY.footer.words.map((w) => `<span class="word split">${tpl(w)}</span>`).join('') + `<a class="sayhi" href="mailto:${COPY.footer.email}">${COPY.footer.sayhi}</a>`;
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
document.querySelectorAll('.card .in, .slide .in').forEach((el) => { const pi = +el.closest('[data-p]').dataset.p; el.addEventListener('click', () => openPanel(pi, el)); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(pi, el); } }); });
$('panel-close').addEventListener('click', closePanel); panelScrim.addEventListener('click', closePanel);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
// the screen's own controls (floor 03): ← → keys, horizontal wheel / trackpad, drag — each maps onto page scroll, which drives the strip
const deckStrip = deckIdx >= 0 ? $('deck-strip') : null;
if (deckIdx >= 0) { const lo = () => world.hold.s0 * vh, hi = () => (world.hold.s0 + world.hold.len) * vh;
  const toSlide = (k) => lenis.scrollTo((world.hold.s0 + clamp(k, 0, world.hold.len)) * vh, { duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 4) });
  const cur = () => Math.round(scroll / vh - world.hold.s0);
  window.addEventListener('keydown', (e) => { if (!T.deckOn || panelOpen) return; if (e.key === 'ArrowRight') { e.preventDefault(); toSlide(cur() + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); toSlide(cur() - 1); } });
  deckEl.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 2) return; e.preventDefault(); lenis.scrollTo(clamp((lenis.targetScroll ?? scroll) + e.deltaX * 1.5, lo(), hi())); }, { passive: false });
  let drag = null;
  deckEl.addEventListener('pointerdown', (e) => { if (e.button !== 0 || panelOpen) return; drag = { x: e.clientX, s: scroll, moved: false, id: e.pointerId }; });
  // capture only once it is a drag (capturing on pointerdown would retarget the click away from the preview)
  deckEl.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; deckEl.setPointerCapture(drag.id); } if (drag.moved) lenis.scrollTo(clamp(drag.s - dx / Math.max(deckEl.clientWidth, 1) * vh, lo(), hi()), { immediate: true }); });
  const endDrag = () => { if (!drag) return; if (drag.moved) { toSlide(cur()); deckEl.dataset.dragged = '1'; setTimeout(() => { delete deckEl.dataset.dragged; }, 60); } drag = null; };
  deckEl.addEventListener('pointerup', endDrag); deckEl.addEventListener('pointercancel', endDrag);
  deckEl.addEventListener('click', (e) => { if (deckEl.dataset.dragged) { e.stopPropagation(); e.preventDefault(); } }, true); }

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
document.querySelectorAll('.st .big, .value-text .big').forEach((el) => { const c = { el, shown: false }; SplitText.create(el, { type: 'chars', charsClass: 'char', onSplit(self) { c.chars = self.chars; gsap.set(self.chars, { opacity: c.shown ? 1 : 0 }); } });
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
const camLight = new THREE.PointLight(0xffffff, 0, 14, 2); camLight.position.set(1.4, 0.4, 1.2); camera.add(camLight); scene.add(camera);   // the viewer's lamp, only in dark rooms
const T0 = THEMES.stone; const TH = { bg: new THREE.Color(T0.bg), fogNear: T0.fog[0], fogFar: T0.fog[1], key: T0.key, keyC: new THREE.Color(T0.keyColor), hemi: T0.hemi, hemiS: new THREE.Color(T0.hemiSky), hemiG: new THREE.Color(T0.hemiGround), cam: 0, camC: new THREE.Color(T0.camColor) };

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
const texCache = {};
const themeTex = (name, kind) => { const k = name + kind; if (!texCache[k]) { const t = THEMES[name]; const [b, r, sp] = kind === 'wall' ? t.wall : t.side; texCache[k] = stoneTexture(b, r, sp); } return texCache[k]; };
const world = { objs: [], ledges: [], groundY: 0, landS: 0, camYMin: 0, floors: [], hold: { s0: 0, len: 0 }, deck: null };
// the rail: screens → camera y, linear (clamped at the landing) — except the hold in front of the computer's screen, where the
// camera keeps still for (projects − 1) screens while the previews slide (Léo's camera also holds under his long papers)
const camYAt = (s) => -RATE * (s - clamp(s - world.hold.s0, 0, world.hold.len));
const hipsGlued = (s) => camYAt(s) - LAY.glue;
const mat = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9 }, o));
const bx = (w, h, d, m, x, y, z, g, sh = true) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = sh; o.receiveShadow = true; g.add(o); return o; };
const cyl = (r1, r2, h, m, x, y, z, g, seg = 10) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
const lamp = (color, intensity, x, y, z, g, dist = 9) => { const l = new THREE.PointLight(color, intensity, dist, 2); l.position.set(x, y, z); g.add(l); return l; };
const glow = (color, r, x, y, z, g) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 1 })); o.position.set(x, y, z); g.add(o); return o; };
const rnd = (seed) => { let x = Math.sin(seed * 999.1) * 10000; return () => { x = Math.sin(x) * 10000; return x - Math.floor(x); }; };
// ── props per skin: (group, yTop, yBottom) — the floor of a room is the slab under it
const PROPS = {
  stone(g, yT, yB) {},
  workshop(g, yT, yB) { const R = rnd(yT); const floor = yB + 0.15; const wood = mat({ color: 0xa88a62, roughness: 0.85 }), dark = mat({ color: 0x3a3632 }), red = mat({ color: 0xc0392b, roughness: 0.6 }), steel = mat({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.6 });
    for (let y = yT - 2.2; y > floor + 1.6; y -= 3.2) {                                    // pegboards with tools, every few metres of wall
      const pb = bx(4.2, 2.2, 0.06, mat({ color: 0xd7c9a8, roughness: 0.95 }), -4.4, y, -2.74, g, false);
      for (let i = 0; i < 26; i++) { const o = new THREE.Mesh(new THREE.CircleGeometry(0.025, 6), dark); o.position.set(-6.3 + (i % 13) * 0.32, y + 0.7 - Math.floor(i / 13) * 1.4, -2.7); g.add(o); }
      bx(0.16, 1.1, 0.05, dark, -5.8, y + 0.1, -2.68, g); bx(0.5, 0.2, 0.05, steel, -5.8, y + 0.7, -2.68, g);        // hammer
      bx(0.12, 1.2, 0.05, steel, -4.9, y, -2.68, g); bx(0.4, 0.3, 0.05, steel, -4.9, y + 0.65, -2.68, g);           // wrench
      bx(1.1, 0.3, 0.05, steel, -3.6, y + 0.4, -2.68, g); bx(0.35, 0.3, 0.05, wood, -2.95, y + 0.4, -2.68, g);     // saw
      for (let i = 0; i < 5; i++) cyl(0.035, 0.035, 0.7, steel, -4.2 + i * 0.28, y - 0.55, -2.66, g, 6);            // screwdrivers
      const bulbY = y + 1.5; cyl(0.01, 0.01, 1.2, dark, -3.2, bulbY + 0.6, -1.6, g, 4); glow(0xffe0a8, 0.13, -3.2, bulbY, -1.6, g); lamp(0xffd9a0, 4, -3.2, bulbY - 0.15, -1.4, g, 7); }
    bx(4.4, 0.16, 1.3, wood, -4.2, floor + 0.9, -1.7, g); for (const dx of [-2, 2]) for (const dz of [-0.5, 0.5]) bx(0.12, 0.9, 0.12, dark, -4.2 + dx, floor + 0.45, -1.7 + dz, g);   // workbench
    bx(0.5, 0.35, 0.4, steel, -5.6, floor + 1.16, -1.7, g); bx(0.7, 0.3, 0.32, red, -3.2, floor + 1.13, -1.8, g);                                                                    // vise + toolbox
    cyl(0.16, 0.16, 0.8, red, -7.2, floor + 0.4, -2.2, g, 12); cyl(0.05, 0.05, 0.16, dark, -7.2, floor + 0.88, -2.2, g, 8);                                                        // extinguisher
    for (let i = 0; i < 3; i++) bx(0.9, 0.6, 0.7, mat({ color: 0xb9925f }), -6.6 + (i % 2) * 0.2, floor + 0.3 + i * 0.6, -1.6, g); },
  bar(g, yT, yB) { const R = rnd(yT); const floor = yB + 0.15; const dark = mat({ color: 0x1b1520, roughness: 0.7 }), wood = mat({ color: 0x3a2418, roughness: 0.55 }), brass = mat({ color: 0xb58a3c, roughness: 0.35, metalness: 0.7 });
    const cols = [0x7ac8b0, 0xf2a93b, 0xd94f8a, 0x8fb3ff, 0xf6f1e6, 0x5ec8e8];
    for (let y = yT - 1.6; y > floor + 1.9; y -= 1.05) {                                                                                 // back-bar shelves, lit from below
      bx(5.2, 0.06, 0.5, wood, -4.2, y, -2.5, g); const strip = bx(5.0, 0.03, 0.08, new THREE.MeshStandardMaterial({ color: 0xff7fc2, emissive: 0xff5fb0, emissiveIntensity: 1.6 }), -4.2, y - 0.05, -2.3, g, false); lamp(0xff6fb5, 2.2, -4.2, y - 0.2, -2.2, g, 5);
      for (let i = 0; i < 9; i++) { const h = 0.35 + R() * 0.35, r = 0.06 + R() * 0.04; const c = cols[Math.floor(R() * cols.length)]; cyl(r, r, h, new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, transparent: true, opacity: 0.85 }), -6.5 + i * 0.56 + R() * 0.1, y + 0.03 + h / 2, -2.5, g, 10); } }
    const neonY = yT - 1.0; const neon = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 8, 32), new THREE.MeshStandardMaterial({ color: 0xff7fc2, emissive: 0xff5fb0, emissiveIntensity: 2.2 })); neon.position.set(-1.8, neonY, -2.6); g.add(neon);
    bx(1.6, 0.06, 0.06, new THREE.MeshStandardMaterial({ color: 0x8ff0ff, emissive: 0x4fd8f0, emissiveIntensity: 2.2 }), -1.8, neonY - 0.85, -2.6, g, false); lamp(0xff6fb5, 6, -1.8, neonY, -2.0, g, 8); lamp(0x4fd8f0, 3, -1.8, neonY - 0.9, -2.0, g, 6);
    bx(6.0, 1.05, 0.8, dark, -4.0, floor + 0.53, -1.2, g); bx(6.2, 0.08, 0.95, wood, -4.0, floor + 1.09, -1.2, g);                     // the counter
    for (let i = 0; i < 3; i++) { cyl(0.05, 0.05, 0.7, brass, -5.6 + i * 1.5, floor + 0.35, -0.5, g, 8); cyl(0.22, 0.22, 0.08, mat({ color: 0x7a2038, roughness: 0.6 }), -5.6 + i * 1.5, floor + 0.74, -0.5, g, 14); }
    for (const x of [-5.4, -2.6]) { cyl(0.01, 0.01, 1.4, brass, x, floor + 2.6, -1.2, g, 4); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.3, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a1c14, side: THREE.DoubleSide })); cone.position.set(x, floor + 1.9, -1.2); g.add(cone); glow(0xffd28a, 0.07, x, floor + 1.84, -1.2, g); lamp(0xffc978, 3.5, x, floor + 1.78, -1.1, g, 6); } },
  library(g, yT, yB) { const R = rnd(yT); const floor = yB + 0.15; const wood = mat({ color: 0x4a2f1e, roughness: 0.7 }), paperM = mat({ color: 0xd9cfb8, roughness: 1 });
    const cols = [0x8c3b2f, 0x2f4a6e, 0x6b7a3a, 0xc9a961, 0x3e2b4e, 0xa85a2a, 0xe8e0cc, 0x2a4a3e];
    for (const x0 of [-7.2, -3.4]) { const w = 3.4; bx(w, yT - floor - 0.3, 0.06, wood, x0 + w / 2, (yT + floor) / 2, -2.78, g, false); for (const dx of [0, w]) bx(0.1, yT - floor - 0.3, 0.55, wood, x0 + dx, (yT + floor) / 2, -2.5, g);   // shelf units
      for (let y = floor + 0.4; y < yT - 0.6; y += 0.62) { bx(w, 0.05, 0.55, wood, x0 + w / 2, y, -2.5, g); let x = x0 + 0.12; while (x < x0 + w - 0.15) { const bw = 0.06 + R() * 0.07, bh = 0.32 + R() * 0.22; const b = bx(bw, bh, 0.42, mat({ color: cols[Math.floor(R() * cols.length)], roughness: 0.85 }), x + bw / 2, y + bh / 2 + 0.03, -2.5, g, false); if (R() < 0.08) b.rotation.z = 0.12; x += bw + 0.012; } } }
    for (let y = yT - 2.0; y > floor + 1.5; y -= 3.4) { cyl(0.012, 0.012, 1.0, mat({ color: 0x2a2320 }), -5.3, y + 0.5, -1.5, g, 4); const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x2f5f3a, side: THREE.DoubleSide })); shade.position.set(-5.3, y, -1.5); g.add(shade); glow(0xffe6b8, 0.07, -5.3, y - 0.06, -1.5, g); lamp(0xffc978, 4.5, -5.3, y - 0.2, -1.3, g, 7); }
    bx(2.2, 0.08, 1.0, wood, -1.9, floor + 0.78, -1.5, g); for (const dx of [-1.0, 1.0]) bx(0.08, 0.78, 0.9, wood, -1.9 + dx, floor + 0.39, -1.5, g);        // desk
    for (let i = 0; i < 4; i++) bx(0.5 - i * 0.04, 0.09, 0.36, paperM, -2.4 + i * 0.05, floor + 0.87 + i * 0.09, -1.5, g, false);
    const lampArm = cyl(0.02, 0.02, 0.5, mat({ color: 0xb58a3c, metalness: 0.7, roughness: 0.3 }), -1.2, floor + 1.08, -1.6, g, 6); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f6f4a, side: THREE.DoubleSide })); dome.position.set(-1.2, floor + 1.34, -1.6); g.add(dome); glow(0xfff0c8, 0.05, -1.2, floor + 1.3, -1.6, g); lamp(0xffe0a0, 3.5, -1.2, floor + 1.22, -1.5, g, 6);
    for (let i = 0; i < 3; i++) bx(0.8, 0.55, 0.6, mat({ color: 0xb9a37f }), -6.4 + i * 0.1, floor + 0.28 + i * 0.55, -1.3, g); },
};
// the computer's glass at the hold: an NDC box → a world rectangle perpendicular to the view axis (the camera only translates,
// so its projection stays an axis-aligned rectangle and the DOM strip can sit on it exactly)
function deckFrame() { world.deck = null; if (deckIdx < 0) return;
  const s0 = world.hold.s0, P = CAMERA.pitch; const cy = camYAt(s0), cz = CAMERA.z + CAMERA.header.rangeZ * (1 - clamp(s0 / CAMERA.header.screens, 0, 1));
  const fwd = new THREE.Vector3(0, Math.sin(P), -Math.cos(P)), up = new THREE.Vector3(0, Math.cos(P), Math.sin(P)), right = new THREE.Vector3(1, 0, 0);
  const d = (cz - DECK.z) / Math.cos(P); const hh = d * Math.tan(THREE.MathUtils.degToRad(LAY.fov) / 2), hw = hh * (vw / vh);
  const [x0, x1, y0, y1] = DECK.box[LAY.mobile ? 'mobile' : 'desktop'];
  const mid = new THREE.Vector3(LAY.camX, cy, cz).addScaledVector(fwd, d).addScaledVector(right, (x0 + x1) / 2 * hw).addScaledVector(up, (y0 + y1) / 2 * hh);
  const w = (x1 - x0) * hw, h = (y1 - y0) * hh; const corner = (sx, sy) => mid.clone().addScaledVector(right, sx * w / 2).addScaledVector(up, sy * h / 2);
  world.deck = { win: deckIdx, mid, w, h, tl: corner(-1, 1), br: corner(1, -1), n: SECTIONS[deckIdx].pieces.length }; }
PROPS.computer = function (g, yT, yB) { const D = world.deck; if (!D) return; const X = TIGER.x, G = world.groundY, P = CAMERA.pitch;
  const beige = mat({ color: DECK.beige, roughness: 0.85 }), beige2 = mat({ color: 0xC8BDA3, roughness: 0.9 }), dark = mat({ color: DECK.dark, roughness: 0.6 }), wood = mat({ color: 0x9C7A52, roughness: 0.8 });
  const b = DECK.bezel, w = D.w, h = D.h, dep = DECK.depth;
  // the monitor: glass (the DOM strip sits on it), bezel, a shallow body (the pier's face is right behind), LED, grooves, badge
  const mon = new THREE.Group(); mon.position.copy(D.mid); mon.rotation.x = P; g.add(mon);
  mon.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xECEBE4 })));
  bx(w + 2 * b, b, 0.16, beige, 0, h / 2 + b / 2, -0.03, mon); bx(w + 2 * b, b * 1.7, 0.16, beige, 0, -h / 2 - b * 0.85, -0.03, mon);
  bx(b, h, 0.16, beige, -w / 2 - b / 2, 0, -0.03, mon); bx(b, h, 0.16, beige, w / 2 + b / 2, 0, -0.03, mon);
  bx(w + 2 * b + 0.14, h + b * 2.7 + 0.14, dep, beige2, 0, -b * 0.35, -0.11 - dep / 2, mon);
  glow(0x7CFF9A, 0.022, w / 2 - 0.1, -h / 2 - b * 0.85, 0.06, mon);
  for (let i = 0; i < 7; i++) bx(0.06, 0.014, 0.02, dark, -w / 2 + 0.14 + i * 0.1, -h / 2 - b * 0.55, 0.06, mon);
  bx(0.5, 0.05, 0.02, dark, 0, -h / 2 - b * 1.1, 0.06, mon);
  lamp(0xDCE6F5, 5, 0, 0, 1.3, mon, 11);                                                                                   // the screen lights the room (and the tiger)
  // the desk (level, in front of the pier): top just under the monitor's foot, on four thin legs down to the grass (the middle of
  // the frame stays open under it, so the meadow reads at the landing)
  const cP = Math.cos(P), sP = Math.sin(P); const botY = D.mid.y - (h / 2 + b * 1.7) * cP - 0.06;
  const deskY = botY - 0.36, zC = D.mid.z + 0.55, x0 = -9.5, x1 = X - 0.6;
  bx(0.9, 0.34, 0.8, beige2, D.mid.x, botY - 0.19, D.mid.z - 0.1, g);                                                        // the foot
  bx(x1 - x0, 0.14, 2.6, wood, (x0 + x1) / 2, deskY - 0.07, zC, g); bx(x1 - x0, 0.06, 2.5, mat({ color: 0x6B5236 }), (x0 + x1) / 2, deskY - 0.17, zC, g, false);
  const legH = Math.max(0.2, deskY - 0.14 - G); for (const px of [x0 + 0.5, x1 - 0.2]) for (const pz of [zC - 1.0, zC + 1.0]) cyl(0.07, 0.09, legH, mat({ color: 0x5A4632, roughness: 0.8 }), px, deskY - 0.14 - legH / 2, pz, g, 8);
  // keyboard: a slab with instanced keycaps and a spacebar, tilted a little toward you
  const kb = new THREE.Group(); kb.position.set(D.mid.x - 0.25, deskY + 0.07, D.mid.z + 0.85); kb.rotation.x = 0.07; g.add(kb);
  const kw = w * 0.92; bx(kw, 0.12, 0.66, beige, 0, 0, 0, kb);
  const cols = 16, rows = 5, pitch = kw / (cols + 0.6); const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(pitch * 0.78, 0.05, pitch * 0.78), beige2, cols * rows);
  { const mm = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0); let k = 0; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const sp = r === rows - 1 && c >= 5 && c <= 10; caps.setMatrixAt(k++, sp ? zero : mm.makeTranslation(-kw / 2 + pitch * (0.8 + c), 0.085, -0.22 + r * 0.11)); } }
  caps.castShadow = true; kb.add(caps); bx(pitch * 5.8, 0.05, pitch * 0.78, beige2, -kw / 2 + pitch * 8.3, 0.085, -0.22 + (rows - 1) * 0.11, kb);
  // mouse + cord, mug, the tower (floppy slots, LEDs, vents) and two floppies, all on the desk left of the keyboard
  const ms = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), beige); ms.scale.set(1, 0.55, 1.35); ms.position.set(D.mid.x + kw / 2 + 0.28, deskY + 0.09, D.mid.z + 0.9); ms.castShadow = true; g.add(ms);
  const cord = cyl(0.008, 0.008, 0.8, dark, ms.position.x - 0.1, deskY + 0.02, ms.position.z - 0.6, g, 4); cord.rotation.x = HALF;
  cyl(0.12, 0.1, 0.28, mat({ color: 0xF2A93B, roughness: 0.5 }), D.mid.x - kw / 2 - 0.3, deskY + 0.14, D.mid.z + 1.0, g, 14);
  const tx = D.mid.x - w / 2 - b - 0.55, tz = D.mid.z + 0.5; const tw = new THREE.Group(); tw.position.set(tx, deskY + 0.5, tz); g.add(tw);
  bx(0.62, 1.0, 1.9, beige2, 0, 0, 0, tw); bx(0.36, 0.05, 0.02, dark, 0, 0.28, 0.96, tw); bx(0.36, 0.05, 0.02, dark, 0, 0.18, 0.96, tw); glow(0xFF9A5C, 0.02, 0.2, -0.2, 0.96, tw); glow(0x7CFF9A, 0.02, 0.12, -0.2, 0.96, tw);
  for (let i = 0; i < 5; i++) bx(0.3, 0.012, 0.02, dark, -0.05, -0.32 - i * 0.05, 0.96, tw);
  for (let i = 0; i < 2; i++) bx(0.36, 0.014, 0.36, mat({ color: i ? 0x2A3B6B : 0x1C1C1E, roughness: 0.6 }), tx + 0.05 + i * 0.05, deskY + 0.01 + i * 0.016, tz + 1.35, g, false);
  cyl(0.012, 0.012, Math.max(0.1, deskY - G), dark, D.mid.x + 0.3, (deskY + G) / 2, D.mid.z - 0.75, g, 4);                   // the monitor's cable, down behind the desk
};
function buildWorld() {
  world.objs.forEach((o) => scene.remove(o)); world.objs = []; world.ledges = []; world.floors = []; window.__world = world; window.__scene = scene;
  const X = TIGER.x, L = TIGER.ledgeY;
  const wl = R.windows[R.windows.length - 1]; world.landS = (wl.top + wl.h) / vh - 1.5; world.camYMin = camYAt(world.landS);
  world.groundY = hipsGlued(world.landS) - 1.05;
  const G = world.groundY; deckFrame();
  // pier: the tiger's tower on the right, platform on top, ladder down its face (it runs through every floor)
  const pier = new THREE.Group(); scene.add(pier); world.objs.push(pier);
  const pierTex = themeTex('stone', 'wall'); const pierMat = new THREE.MeshStandardMaterial({ map: pierTex, roughness: 0.95 });
  const pH = L - (G - 2); pierTex.repeat.set(2.4, pH / 2.6);
  const block = new THREE.Mesh(new THREE.BoxGeometry(6, pH, 2.5), pierMat); block.position.set(X + 1.5, (L + G - 2) / 2, -1.35); block.castShadow = true; block.receiveShadow = true; pier.add(block);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.18, 2.7), slabTop); lip.position.set(X + 1.5, L - 0.09, -1.35); lip.receiveShadow = true; lip.castShadow = true; pier.add(lip);
  const railTop = L + 1.25, railH = railTop - (G + 0.05);
  for (const sx of [-0.5, 0.5]) { const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, railH, 8), woodMat); rail.position.set(X + sx, (railTop + G + 0.05) / 2, TIGER.ladderZ); rail.castShadow = true; pier.add(rail);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), woodMat); bar.position.set(X + sx, L + 1.0, TIGER.ladderZ - 0.16); pier.add(bar); }
  const rungGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8); rungGeo.rotateZ(HALF);
  const topRung = LAY.RUNG0 + TIGER.rung * Math.floor((railTop - 0.15 - LAY.RUNG0) / TIGER.rung);
  const nR = Math.floor((topRung - (G + 0.25)) / TIGER.rung) + 1; const rungs = new THREE.InstancedMesh(rungGeo, rungMat, nR); rungs.castShadow = true;
  { const mm = new THREE.Matrix4(); for (let j = 0; j < nR; j++) { mm.makeTranslation(X, topRung - j * TIGER.rung, TIGER.ladderZ); rungs.setMatrixAt(j, mm); } }
  pier.add(rungs);
  // floors: the rooms are stacked; the camera passes each slab while that section's title paper covers the screen
  const bounds = [L + 14]; const skins = ['stone'];
  SECTIONS.forEach((sec, i) => { bounds.push(camYAt(R.titles[i].top / vh + 0.2)); skins.push(sec.theme); }); bounds.push(G - 2);
  world.floors = bounds.slice(1, -1);
  for (let i = 0; i < skins.length; i++) { const name = skins[i], yTop = bounds[i], yBot = bounds[i + 1], Hh = yTop - yBot; const th = THEMES[name];
    const g = new THREE.Group(); scene.add(g); world.objs.push(g);
    const wt = themeTex(name, 'wall').clone(); wt.needsUpdate = true; wt.repeat.set(10, Hh / 4); const back = new THREE.Mesh(new THREE.PlaneGeometry(40, Hh), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95 })); back.position.set(0, (yTop + yBot) / 2, -2.8); back.receiveShadow = true; g.add(back);
    const st = themeTex(name, 'side').clone(); st.needsUpdate = true; st.repeat.set(3, Hh / 4); const side = new THREE.Mesh(new THREE.PlaneGeometry(12, Hh), new THREE.MeshStandardMaterial({ map: st, roughness: 0.95 })); side.position.set(-11, (yTop + yBot) / 2, 3.2); side.rotation.y = HALF; side.receiveShadow = true; g.add(side);
    if (i > 0) { const yS = yTop; const slabM = new THREE.MeshStandardMaterial({ color: th.ink === 'light' ? 0x2a2622 : 0xb8b2a4, roughness: 0.95 });   // the slab above this room (its ceiling), with a hatch for the ladder
      for (const [x0, x1] of [[-16, X - 1.2], [X + 1.2, 16]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.3, 7.6), slabM); m.position.set((x0 + x1) / 2, yS, 1.0); m.receiveShadow = true; m.castShadow = true; g.add(m); }
      const rim = new THREE.Mesh(new THREE.BoxGeometry(2.4 + 0.3, 0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.6 })); rim.position.set(X, yS, 0.45); g.add(rim); }
    PROPS[name] && PROPS[name](g, yTop - (i > 0 ? 0.15 : 0), yBot + (i < skins.length - 1 ? 0.15 : 0)); }
  // ledges with lamps on the left wall, one per card, at the tiger's feet when that card is centred
  document.querySelectorAll('.card').forEach((el) => { const r = el.getBoundingClientRect(); const top = r.top + scroll; const sC = (top - vh / 2) / vh; const y = hipsGlued(sC) - 0.9; el.dataset.s = sC;
    const th = THEMES[el.closest('.window').dataset.theme] || THEMES.stone;
    const g = new THREE.Group(); scene.add(g); world.objs.push(g);
    const w = LEDGE_X[1] - LEDGE_X[0], cx = (LEDGE_X[0] + LEDGE_X[1]) / 2;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 2.2), slabMat); slab.position.set(cx, y - 0.25, -1.7); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.05, 2.1), slabTop); t2.position.set(cx, y + 0.02, -1.7); t2.receiveShadow = true; g.add(t2);
    const tx = LEDGE_X[1] - 0.7;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.3, 6), postMat); post.position.set(tx, y + 0.65, -2.2); post.castShadow = true; g.add(post);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: th.torch, emissive: th.torch, emissiveIntensity: 1.2, roughness: 1 })); flame.position.set(tx, y + 1.36, -2.2); g.add(flame);
    const light = new THREE.PointLight(th.torch, th.torchI, LIGHT.torch.distance, 2); light.position.set(tx, y + 1.5, -1.6); g.add(light);
    world.ledges.push({ s: sC, el, seed: Math.random() * 10, flame, light, base: th.torchI, glanced: false }); });
  if (world.deck) document.querySelectorAll('#deck .slide').forEach((el, j) => world.ledges.push({ s: world.hold.s0 + j, el, seed: 0, flame: null, light: null, base: 0, glanced: false, slide: true }));
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
  R.windows = SECTIONS.map((_, w) => { const r = $('win' + w).getBoundingClientRect(); return { top: r.top + scroll, h: r.height, theme: SECTIONS[w].theme }; });
  R.titles = SECTIONS.map((_, w) => { const r = $('title' + w).getBoundingClientRect(); return { top: r.top + scroll, h: r.height }; });
  world.hold = deckIdx >= 0 ? { s0: R.windows[deckIdx].top / vh + DECK.entry, len: SECTIONS[deckIdx].pieces.length - 1 } : { s0: 0, len: 0 };
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
const T = { deckOn: false, deckK: -1, landedCls: false, navLight: false, blinkAt: 2.5, blink: false, earAt: 3, ear: 0, quipT: 0, quip: '', sit: 0, waveAt: 2.5, wave: 0, glance: { y: 0, p: 0 }, hover: { y: 0, p: 0 }, headY: 0, headP: 0, tailV: 0 };
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
const tiltEls = [document.querySelector('.hero .words'), document.querySelector('.shore-text'), ...document.querySelectorAll('.value-text')];
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
  const landed = s >= world.landS; if (landed !== T.landedCls) { T.landedCls = landed; document.documentElement.classList.toggle('landed', landed); }
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
    if (!L.slide && Math.abs(a) < 0.75) { const u = clamp(0.5 - a, 0, 1); L.el.style.transform = `translate3d(0, ${(lerp(MOTION.drift.from, MOTION.drift.to, u) * LAY.drift).toFixed(2)}vh, 0)`; }
    if (a < 0.14 && a > -0.5 && !L.glanced && state === 'climb') { L.glanced = true; glance(TIGER.glance.yaw, TIGER.glance.pitch); }
    if (a > 0.3 || a < -0.6) L.glanced = false;
    if (!L.flame) continue;
    const flick = 1 + 0.08 * Math.sin(t * 9.3 + L.seed) + 0.05 * Math.sin(t * 17.1 + L.seed * 2); L.light.intensity = L.base * flick * (1 - shoreMix * 0.7); L.flame.scale.setScalar(0.9 + 0.15 * flick); }
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

  // ── the room's skin (theme): switches while the section title paper covers the screen; the shore flips lighter (800ms)
  let themeName = 'stone'; for (let i = 0; i < SECTIONS.length; i++) if (s >= R.titles[i].top / vh + 0.2) themeName = SECTIONS[i].theme;
  const th = THEMES[themeName];
  const lk = 1 - Math.pow(0.001, dt / (SKY.flipMs / 1000));
  skyTarget.set(landed ? SKY.shore : th.bg); if (!landed && inWindow >= 0 && activeCat && th.ink === 'dark') skyTarget.lerp(tmpC.set(CATS[activeCat].tint), SKY.windowMix);
  shoreMix = lerp(shoreMix, landed ? 1 : 0, lk);
  skyColor.lerp(skyTarget, lk); scene.fog.color.copy(skyColor);
  key.intensity = lerp(key.intensity, landed ? LIGHT.key.intensityShore : th.key, lk); key.color.lerp(tmpC.set(landed ? LIGHT.key.color : th.keyColor), lk);
  hemi.intensity = lerp(hemi.intensity, landed ? LIGHT.hemi.intensityShore : th.hemi, lk); hemi.color.lerp(tmpC.set(landed ? LIGHT.hemi.skyShore : th.hemiSky), lk); hemi.groundColor.lerp(tmpC.set(landed ? LIGHT.hemi.groundShore : th.hemiGround), lk);
  camLight.intensity = lerp(camLight.intensity, landed ? 0 : th.camLight, lk); camLight.color.lerp(tmpC.set(th.camColor), lk);
  scene.fog.near = lerp(scene.fog.near, landed ? 24 : th.fog[0], lk); scene.fog.far = lerp(scene.fog.far, landed ? 110 : th.fog[1], lk);
  // nav ink flips only while the nav sits inside a dark window (Léo's toggleColor rule)
  const navWin = R.windows.find((w) => scroll + 50 >= w.top && scroll + 50 < w.top + w.h); const navLight = !!navWin && THEMES[navWin.theme].ink === 'light' && !landed;
  if (navLight !== T.navLight) { T.navLight = navLight; document.documentElement.classList.toggle('nav-light', navLight); }

  // ── the computer's screen: the DOM strip is laid over the projected glass; during the hold, page scroll slides the previews
  if (world.deck) { const D = world.deck, W = R.windows[D.win]; let on = false;
    if (scroll + vh > W.top && scroll < W.top + W.h && !landed) { v3.copy(D.tl).project(camera); const x = (v3.x + 1) / 2 * vw, y = (1 - v3.y) / 2 * vh; v3.copy(D.br).project(camera); const w = (v3.x + 1) / 2 * vw - x, h = (1 - v3.y) / 2 * vh - y;
      on = y < vh && y + h > 0;
      if (on) { deckEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; deckEl.style.width = w.toFixed(1) + 'px'; deckEl.style.height = h.toFixed(1) + 'px';
        const u = clamp((s - world.hold.s0) / Math.max(world.hold.len, 1e-3), 0, 1); deckStrip.style.transform = `translate3d(${(-u * (D.n - 1) * 100 / D.n).toFixed(3)}%, 0, 0)`;
        const k = Math.round(u * (D.n - 1)); if (k !== T.deckK) { T.deckK = k; $('deck-n').textContent = `${String(k + 1).padStart(2, '0')} / ${String(D.n).padStart(2, '0')}`; $('deck-bar').style.width = ((k + 1) / D.n * 100).toFixed(1) + '%'; } } }
    if (on !== T.deckOn) { T.deckOn = on; deckEl.classList.toggle('on', on); } }

  // ── quip bubble above the head
  T.quipT -= dt; if (T.quipT <= 0 && T.quip) T.quip = '';
  quipEl.classList.toggle('on', !!T.quip && inWorld);
  if (T.quip) { v3.copy(rig.root.position).y += (state === 'climb' || state === 'edge') ? 1.2 : 1.35; v3.project(camera); quipEl.style.transform = `translate(${((v3.x + 1) / 2 * vw).toFixed(0)}px, ${((1 - v3.y) / 2 * vh - 8).toFixed(0)}px) translate(-50%, -100%)`; }

  // ── headline tilt (Laurens) on the DOM statements only; the camera itself never turns (Léo)
  mouse.hx += (mouse.x - mouse.hx) * MOUSE.headline.damping; mouse.hy += (mouse.y - mouse.hy) * MOUSE.headline.damping;
  const tilt = `translate3d(${(mouse.hx * MOUSE.headline.x).toFixed(2)}px, ${(mouse.hy * MOUSE.headline.y).toFixed(2)}px, 0) rotateY(${(mouse.hx * MOUSE.headline.rotY).toFixed(3)}deg) rotateX(${(-mouse.hy * MOUSE.headline.rotX).toFixed(3)}deg)`;
  tiltEls.forEach((el) => { if (el) el.style.transform = (el.classList.contains('shore-text') || el.classList.contains('value-text') ? 'translateY(-50%) ' : '') + tilt; });

  // ── cursor
  mx.cx += (mx.x - mx.cx) * 0.25; mx.cy += (mx.y - mx.cy) * 0.25;
  cursor.style.transform = `translate3d(${mx.cx.toFixed(1)}px, ${mx.cy.toFixed(1)}px, 0)`;
  ray.setFromCamera(new THREE.Vector2(mouse.x, -mouse.y), camera); hoverTiger = inWorld && ray.intersectObject(tigerHit).length > 0;
  const under = document.elementFromPoint(mx.x, mx.y); const overCard = !panelOpen && under?.closest?.('.card .in, .slide .in'); const overLink = under?.closest?.('a'); const overClose = under?.closest?.('#panel-close');
  setPill(overClose ? COPY.panel.close : hoverTiger && !panelOpen ? COPY.cursor.tiger : overLink ? 'open' : overCard ? COPY.cursor.card : (scroll < vh * 0.4 && booted && !panelOpen ? 'scroll' : ''));

  window.__dbg = { s: +s.toFixed(3), state, landed, aN: +nearestA.toFixed(3), inWindow, cam: camera.position.toArray().map((v) => +v.toFixed(2)), hips: rig.root.position.toArray().map((v) => +v.toFixed(2)), c: +cycleAt(rig.root.position.y).toFixed(3) };
  renderer.render(scene, camera);
  if (!document.hidden) requestAnimationFrame(frame);
}
window.addEventListener('resize', measure);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
measure();
requestAnimationFrame(frame);
