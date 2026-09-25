// KookyTiger — P0: the scroll, the well, the tiger.
// Architecture mirrors the two dissected sites: Lenis is the only clock,
// a background WebGL world + DOM + an actor layer, camera on rails per block,
// masked line reveals, one ink colour that flips with the sky.
import * as THREE from './vendor/three.module.min.js';
import { WELL, SHAPES, LAYOUT, BOARD_ROWS, CLEAR_ROWS, CATS, PIECES, COPY, ARCHIVE, CAMERA, MOTION, SKY, LIGHT } from './content.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mapRange = (v, a, b, c, d) => c + (clamp((v - a) / (b - a), 0, 1)) * (d - c);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = LAYOUT.length;

gsap.registerPlugin(SplitText, CustomEase);
CustomEase.create('reveal', MOTION.reveal.ease);
CustomEase.create('hide', MOTION.hide.ease);

// ───────────────────────── DOM: fill copy ─────────────────────────
document.documentElement.style.setProperty('--n', N);
$('nav-brand').innerHTML = `${COPY.nav.name}<span>${COPY.nav.sub}</span>`;
$('nav-links').innerHTML = COPY.nav.links.map((l, i) => `<a href="#" data-to="${['well', 'intro', 'archives'][i]}">${l}</a>`).join('');
$('nav-right').innerHTML = `<b>Evanston, IL</b><br>open for work, 2027`;
$('h-statement').innerHTML = COPY.header.statement.join('<br>');
$('h-scroll').textContent = COPY.header.scroll;
$('hero-words').innerHTML = COPY.hero.words.map((w, i) => `<span class="word"><span class="main">${w}</span><span class="alt">${COPY.hero.reveal[i]}</span></span>`).join('') + `<div class="ind">${COPY.hero.indication}</div>`;
$('hero-l').innerHTML = `Raised in Wuhan<br>Designing anywhere`;
$('hero-r').innerHTML = `Northwestern ’27<br>MaDE + RTVF`;
$('intro-big').innerHTML = COPY.intro.big.map((t) => `<p class="split">${t}</p>`).join('');
$('intro-small').innerHTML = COPY.intro.small.map((t) => `<p class="split">${t}</p>`).join('');
$('intro-reel').textContent = COPY.intro.reel;
$('intro-title').innerHTML = `<span class="split">${COPY.well.title}</span><span class="mono">${N} pieces · ${CLEAR_ROWS.length} lines</span>`;
$('well-title').textContent = COPY.well.title;
$('clear-big').innerHTML = COPY.clear.words.map((w) => `<span class="split" style="display:block">${w}</span>`).join('');
$('clear-sub').textContent = COPY.clear.sub;
$('arch-head').innerHTML = `<span class="split">${COPY.archives.title}</span><span class="mono">${COPY.archives.note}</span>`;
$('arch-table').innerHTML = ARCHIVE.map((r, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td><b>${r[0]}</b><span>${r[1]}</span></td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('');
$('foot-words').innerHTML = COPY.footer.words.map((w) => `<span class="word split">${w}</span>`).join('') + `<a class="sayhi" href="mailto:${COPY.footer.email}">${COPY.footer.sayhi}</a>`;
$('foot-bottom').innerHTML = `<span>${COPY.footer.bottom[0]} · ${COPY.footer.bottom[1]}</span><a href="mailto:${COPY.footer.email}">${COPY.footer.email}</a><span>${COPY.footer.bottom[2]}</span>`;
$('h-hint').innerHTML = `${COPY.well.hint}<br>${COPY.well.hover}`;
const stackEl = $('h-stack'); for (let i = 0; i < N; i++) stackEl.appendChild(document.createElement('i'));

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
const clearTexts = texts.filter((t) => t.el.closest('#clear')); clearTexts.forEach((t) => (t.fixed = true));
const wellTitle = makeText($('well-title'), { once: false }); wellTitle.fixed = true;
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
const skyColor = new THREE.Color(SKY.pure); scene.background = skyColor; scene.fog = new THREE.Fog(skyColor.clone(), 18, 40);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
const camState = { pos: new THREE.Vector3(...CAMERA.header.from.pos), look: new THREE.Vector3(...CAMERA.header.from.look), tPos: new THREE.Vector3(), tLook: new THREE.Vector3(), shake: 0 };
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };

const COLS = WELL.cols, ROWS = WELL.rows;
const X0 = -(COLS - 1) / 2;                         // world x of column 0 centre
const rowY = (row) => (BOARD_ROWS - 1 - row) + 0.5;  // world y of a board row centre (row 8 → .5)

// well geometry
const wellMat = new THREE.MeshStandardMaterial({ color: LIGHT.well.dark.wall, roughness: 0.97, metalness: 0.0 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(COLS + 8, 14), wellMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 4); floor.receiveShadow = true; scene.add(floor);
const back = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS + 4), gridMaterial()); back.position.set(0, (ROWS + 4) / 2, -0.52); back.receiveShadow = true; scene.add(back);
const sideGeo = new THREE.PlaneGeometry(1.2, ROWS + 4);
const sideL = new THREE.Mesh(sideGeo, wellMat); sideL.rotation.y = Math.PI / 2; sideL.position.set(-COLS / 2, (ROWS + 4) / 2, 0.08); sideL.receiveShadow = true; scene.add(sideL);
const sideR = new THREE.Mesh(sideGeo, wellMat); sideR.rotation.y = -Math.PI / 2; sideR.position.set(COLS / 2, (ROWS + 4) / 2, 0.08); sideR.receiveShadow = true; scene.add(sideR);
// rims (the well's lip) — two thin slabs so the top-down header shot reads as a well
const rimMat = new THREE.MeshStandardMaterial({ color: LIGHT.well.dark.rim, roughness: 0.92 });
[[-COLS / 2 - 0.6, 0], [COLS / 2 + 0.6, 0]].forEach(([x]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, ROWS + 4, 1.4), rimMat); m.position.set(x, (ROWS + 4) / 2, 0.1); m.receiveShadow = true; m.castShadow = true; scene.add(m); });

function gridMaterial() {
  const px = 64, W = COLS * px, H = (ROWS + 4) * px;
  const draw = (bg, stroke) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, W, H); g.strokeStyle = stroke; g.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(x * px + 0.5, 0); g.lineTo(x * px + 0.5, H); g.stroke(); }
    for (let y = 0; y <= ROWS + 4; y++) { g.beginPath(); g.moveTo(0, y * px + 0.5); g.lineTo(W, y * px + 0.5); g.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex; };
  // map: paper-white with faint dark lines (tinted by .color); emissiveMap: the lines alone (lit by .emissive on the dark stage)
  return new THREE.MeshStandardMaterial({ map: draw('#ffffff', 'rgba(0,0,0,0.10)'), emissiveMap: draw('#000000', 'rgba(255,255,255,1)'), emissive: LIGHT.well.dark.lines, color: LIGHT.well.dark.grid, roughness: 0.95 });
}
const gridMat = back.material;

// lights (one theatre spot above the well + a faint hemisphere + a cool fill)
const hemi = new THREE.HemisphereLight(LIGHT.hemi.sky, LIGHT.hemi.ground, LIGHT.hemi.intensity[0]); scene.add(hemi);
const spot = new THREE.SpotLight(LIGHT.spot.color, LIGHT.spot.intensity[0], 70, LIGHT.spot.angle[0], LIGHT.spot.penumbra, 1.5); spot.position.set(...LIGHT.spot.pos); spot.target.position.set(0, 2.5, 0); spot.castShadow = true;
spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0004; spot.shadow.radius = 4; scene.add(spot, spot.target);
const fill = new THREE.DirectionalLight(LIGHT.fill.color, LIGHT.fill.intensity[0]); fill.position.set(-8, 6, 10); scene.add(fill);
const tintLight = new THREE.PointLight(0xffffff, 0, LIGHT.tint.distance, 2); scene.add(tintLight);

// bevelled cube (shared)
const cubeGeo = (() => { const s = 0.9, r = 0.045; const shape = new THREE.Shape(); shape.moveTo(-s / 2 + r, -s / 2); shape.lineTo(s / 2 - r, -s / 2); shape.quadraticCurveTo(s / 2, -s / 2, s / 2, -s / 2 + r); shape.lineTo(s / 2, s / 2 - r); shape.quadraticCurveTo(s / 2, s / 2, s / 2 - r, s / 2); shape.lineTo(-s / 2 + r, s / 2); shape.quadraticCurveTo(-s / 2, s / 2, -s / 2, s / 2 - r); shape.lineTo(-s / 2, -s / 2 + r); shape.quadraticCurveTo(-s / 2, -s / 2, -s / 2 + r, -s / 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth: s - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 3, curveSegments: 4 }); g.center(); return g; })();

// pieces
const pieces = LAYOUT.map((l, i) => {
  const cells = SHAPES[l[0]]; const w = Math.max(...cells.map((c) => c[0])) + 1, h = Math.max(...cells.map((c) => c[1])) + 1;
  const proj = PIECES[i]; const col = new THREE.Color(CATS[proj.cat].color);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.42, metalness: 0.06, emissive: col.clone().multiplyScalar(0.06) });
  const g = new THREE.Group();
  const cellMeshes = cells.map(([dx, dy]) => { const m = new THREE.Mesh(cubeGeo, mat); m.position.set(dx - (w - 1) / 2, -(dy - (h - 1) / 2), 0); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; });
  scene.add(g);
  const cx = X0 + l[1] + (w - 1) / 2, cy = rowY(l[2]) - (h - 1) / 2;   // centre of the final placement
  return { i, shape: l[0], cells, x: l[1], row: l[2], w, h, g, mat, col, cellMeshes, proj, cx, cy, spawnCy: rowY(-4) - (h - 1) / 2, locked: false, isT: l[0] === 'T', eaten: [] };
});
// 4 eaten flags per piece (for the line clear)
pieces.forEach((p) => { p.cellRows = p.cells.map(([dx, dy]) => p.row + dy); p.cellCols = p.cells.map(([dx]) => p.x + dx); });

// dust burst pool
const dust = []; const dustMat = new THREE.MeshStandardMaterial({ color: 0xd9d5c8, roughness: 1 });
for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), dustMat); m.visible = false; scene.add(m); dust.push({ m, v: new THREE.Vector3(), t: 1 }); }
function burst(x, y, n = 14) { let k = 0; for (const d of dust) { if (d.t < 1) continue; d.m.visible = true; d.m.position.set(x + (Math.random() - 0.5) * 2, y, 0.3 + Math.random() * 0.4); d.v.set((Math.random() - 0.5) * 3, 1 + Math.random() * 2.2, (Math.random() - 0.5) * 1.5); d.t = 0; if (++k >= n) break; } }

// ───────────────────────── Tiger (voxel actor) ─────────────────────────
const V = 0.22; // voxel size in world units
const TIGER_A = [ // legs spread
  '...........o.o.',
  'o.........ooooo',
  'o.........owowo',
  '.koookoookooook',
  '..oookoookoooo.',
  '.oo.......ooo..',
  '.oo........oo..',
  '.kk........kk..',
];
const TIGER_B = [ // legs together + bob
  '...........o.o.',
  'o.........ooooo',
  'o.........owowo',
  '.koookoookooook',
  '..oookoookoooo.',
  '...oo.....oo...',
  '...oo.....oo...',
  '...kk.....kk...',
];
const TIGER_SIT = [ // idle sit: tail up, head up
  'o..........o.o.',
  'o.........ooooo',
  '.k........owowo',
  '..oookoookooook',
  '..oookoookoooo.',
  '..oookoookoo...',
  '..oo......oo...',
  '..kk......kk...',
];
const VOXCOL = { o: new THREE.Color('#F2A93B'), k: new THREE.Color('#1A1512'), w: new THREE.Color('#F6F1E6') };
const DEPTH = 3;
const tiger = new THREE.Group(); scene.add(tiger);
const tigerMeshes = {};
for (const key of ['o', 'k', 'w']) { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(V, V, V), new THREE.MeshStandardMaterial({ color: VOXCOL[key], roughness: 0.92 }), 200); m.castShadow = true; m.receiveShadow = true; m.count = 0; tiger.add(m); tigerMeshes[key] = m; }
const tmpM = new THREE.Matrix4();
let tigerFrameKey = '';
function setTigerFrame(map, blink = false) {
  const key = map === TIGER_A ? 'A' : map === TIGER_B ? 'B' : 'S';
  const k2 = key + (blink ? 'b' : '');
  if (k2 === tigerFrameKey) return; tigerFrameKey = k2;
  const counts = { o: 0, k: 0, w: 0 }; const H = map.length, W = map[0].length;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { let ch = map[r][c]; if (ch === '.') continue; if (blink && ch === 'w') ch = 'o';
    for (let d = 0; d < DEPTH; d++) { const mesh = tigerMeshes[ch]; tmpM.makeTranslation((c - W / 2 + 0.5) * V, (H - 1 - r + 0.5) * V, (d - (DEPTH - 1) / 2) * V); mesh.setMatrixAt(counts[ch]++, tmpM); } }
  for (const kk in counts) { tigerMeshes[kk].count = counts[kk]; tigerMeshes[kk].instanceMatrix.needsUpdate = true; }
}
setTigerFrame(TIGER_SIT);
const tigerShadow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); tigerShadow.rotation.x = -Math.PI / 2; scene.add(tigerShadow);
const T = { x: 5.0, y: 0, tx: 5.0, ty: 0, vx: 0, facing: 1, moving: false, walkT: 0, blinkAt: 2.5, blink: false, hop: 0, hopV: 0, faceCam: 0, faceCamT: 0, quipT: 0, quip: '' };
const tigerHit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 1.2), new THREE.MeshBasicMaterial({ visible: false })); scene.add(tigerHit);

// stack surface: world y of the top of the highest locked cell in each column (0 = floor)
function surfaceAt(colF) { const c0 = clamp(Math.floor(colF - 0.9), 0, COLS - 1), c1 = clamp(Math.floor(colF + 0.9), 0, COLS - 1); let y = 0; for (const p of pieces) { if (!p.locked) continue; p.cells.forEach(([dx, dy], k) => { if (p.eaten[k]) return; const col = p.x + dx, row = p.row + dy + (p.shifted ? 2 : 0); if (col >= c0 && col <= c1) y = Math.max(y, rowY(row) + 0.5); }); } return y; }
function stackTopY() { let y = 0; for (const p of pieces) if (p.locked) y = Math.max(y, p.cy + p.h / 2 - (p.shifted ? 2 : 0)); return y; }

// ───────────────────────── Layout measurements ─────────────────────────
const R = {}; // section rects (document coords)
function measure() {
  vh = innerHeight; vw = innerWidth;
  for (const id of ['header', 'hero', 'intro', 'well', 'clear', 'archives', 'footer']) { const el = $(id); const r = el.getBoundingClientRect(); R[id] = { top: r.top + scroll, h: r.height }; }
  texts.forEach((t) => { const r = t.el.getBoundingClientRect(); t.top = r.top + scroll; t.h = r.height; });
  renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.updateProjectionMatrix();
}

// ───────────────────────── Piece drop state ─────────────────────────
let wellProg = 0, clearQ = 0, activeK = 0, lastLocked = -1, linesCleared = 0;
function pieceState(p, k) {
  const t = clamp(wellProg - k, 0, 1);
  if (t >= 1) return { cy: p.cy, rot: 0, t, locked: true };
  const travel = p.cy - p.spawnCy; // negative (falls down)
  const rowsToFall = Math.abs(travel);
  const s = t * rowsToFall, r = Math.floor(s), f = s - r;
  const snap = f < MOTION.drop.holdFraction ? 0 : easeOut((f - MOTION.drop.holdFraction) / (1 - MOTION.drop.holdFraction));
  const cy = p.spawnCy - (r + snap);
  const rt = clamp((t - 0.18) / 0.3, 0, 1);
  const turns = p.isT ? 1.75 : 0.5; // the T "spins" into the slot
  const rot = -Math.PI * 2 * turns * (1 - easeInOut(rt));
  return { cy, rot, t, locked: false };
}
let nextCtx = $('next').getContext('2d');
function drawNext(k) { const c = nextCtx; c.clearRect(0, 0, 88, 44); const p = pieces[k]; if (!p) return; const s = 10, ox = 0, oy = (44 - p.h * s) / 2; c.fillStyle = CATS[p.proj.cat].color; p.cells.forEach(([dx, dy]) => c.fillRect(ox + dx * s + 1, oy + dy * s + 1, s - 2, s - 2)); }

// ───────────────────────── Overlay / card ─────────────────────────
let shownK = -1; const card = $('card');
function showCard(k) {
  if (k === shownK) return; shownK = k; const p = PIECES[k];
  const apply = () => { $('c-n').textContent = String(k + 1).padStart(2, '0') + ' / ' + N; $('c-cat').textContent = CATS[p.cat].name; $('c-name').textContent = p.name; $('c-desc').textContent = p.desc; $('c-meta').innerHTML = p.meta.map((m) => `<span>${m}</span>`).join(''); $('c-take').textContent = p.take; };
  if (reduced) { apply(); return; }
  gsap.to(card, { opacity: 0, y: 8, duration: 0.25, ease: 'expo.out', onComplete: () => { apply(); gsap.fromTo(card, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.65, ease: 'reveal' }); } });
  drawNext(k + 1);
}

// ───────────────────────── Sky stage ─────────────────────────
let skyStage = 0; const skyTarget = new THREE.Color(SKY.pure); const catTint = new THREE.Color(); const tmpC = new THREE.Color();
function setSky(stage, cat) {
  const base = new THREE.Color(stage === 2 ? SKY.white : stage === 1 ? SKY.projects : SKY.pure);
  if (stage === 1 && cat) { catTint.set(CATS[cat].tint); base.lerp(catTint, 0.42); }
  skyTarget.copy(base);
  if ((stage === 2) !== document.body.classList.contains('light')) { document.body.classList.toggle('light', stage === 2); document.body.style.backgroundColor = stage === 2 ? SKY.white : SKY.pure; }
  skyStage = stage;
}

// ───────────────────────── Cursor + quip ─────────────────────────
const cursor = $('cursor'), pill = $('cursor-pill'); let pillShown = false, pillText = '';
const mx = { x: -100, y: -100, cx: -100, cy: -100 };
window.addEventListener('pointermove', (e) => { mx.x = e.clientX; mx.y = e.clientY; mouse.x = (e.clientX / vw) * 2 - 1; mouse.y = (e.clientY / vh) * 2 - 1; });
function setPill(text) { if (text === pillText) return; pillText = text; if (text) { pill.textContent = text; if (!pillShown) { pillShown = true; gsap.to(pill, { '--reveal': 1, duration: MOTION.cursor.inDuration, ease: MOTION.cursor.inEase, overwrite: true }); } } else if (pillShown) { pillShown = false; gsap.to(pill, { '--reveal': 0, duration: MOTION.cursor.outDuration, ease: MOTION.cursor.outEase, overwrite: true }); } }
const quipEl = $('quip'); const v3 = new THREE.Vector3();
function say(text, dur = 2.6) { T.quip = text; T.quipT = dur; quipEl.textContent = text; quipEl.classList.add('on'); }
const ray = new THREE.Raycaster(); let hoverTiger = false;
canvas.addEventListener('click', () => { if (!hoverTiger) return; T.hopV = 5.2; camState.shake = 0.12; say(['kooky.', 'again?', 'i’m a T. we do this.', 'that tickles.'][Math.floor(Math.random() * 4)]); });

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
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  lenis.raf(now); scroll = lenis.animatedScroll ?? scrollY;
  if (!R.well) measure();
  const t = now / 1000;

  // ── phase progress
  const headerP = clamp(scroll / (R.header.h), 0, 1);
  const inWhite = scroll > R.hero.top - vh * 0.15 && scroll < R.well.top - vh * 0.6;
  wellProg = clamp((scroll - R.well.top) / vh, 0, N);
  clearQ = clamp((scroll - R.clear.top) / (R.clear.h - vh), 0, 1);
  const inWell = scroll >= R.well.top - vh * 0.6 && scroll < R.clear.top + (R.clear.h - vh) * 0.95;
  const afterClear = scroll >= R.archives.top - vh * 0.4;
  canvas.classList.toggle('dim', inWhite || afterClear);
  const overlayOn = scroll >= R.well.top - vh * 0.2 && scroll < R.clear.top - vh * 0.1;
  $('overlay').classList.toggle('on', overlayOn); if (overlayOn) wellTitle.reveal(); else wellTitle.hide();

  // ── header content parallax + fade (Léo: 800px, fade .2→.45)
  const hc = document.querySelector('.header .content');
  hc.style.transform = `translate3d(0, ${(-headerP * 800 * 0.35).toFixed(1)}px, 0)`;
  hc.style.opacity = 1 - smooth((headerP - 0.2) / 0.25);

  // ── text reveals by local progress (like Léo's revealOnScroll)
  for (const tx of texts) { if (tx.fixed || tx.el.id === 'h-statement' || tx.el.id === 'h-scroll') continue; const pr = (scroll + vh - tx.top) / (tx.h + vh * 0.35); if (pr > 0.12) tx.reveal(); else if (pr <= 0) tx.hide(); }
  if (!heroShown && scroll + vh > R.hero.top + vh * 0.35) { heroShown = true; gsap.to(heroWords.map((w) => w.querySelector('.main')), { yPercent: 0, duration: MOTION.reveal.duration, ease: 'reveal', stagger: MOTION.reveal.heroStagger }); }

  // ── pieces
  activeK = clamp(Math.floor(wellProg), 0, N - 1);
  let lockEvent = -1;
  pieces.forEach((p, k) => {
    const st = pieceState(p, k);
    if (st.locked && !p.locked) { p.locked = true; lockEvent = k; }
    if (!st.locked && p.locked) { p.locked = false; p.shifted = false; p.g.scale.set(1, 1, 1); p.eaten = []; }
    const shift = p.shifted ? -2 : 0;
    p.g.position.set(p.cx, st.cy + shift, 0); p.g.rotation.z = st.rot;
    p.g.visible = (p.locked || (k === activeK && scroll > R.well.top - vh * 0.5));
    p.mat.emissive.copy(p.col).multiplyScalar(st.locked ? 0.06 : 0.16 + 0.07 * Math.sin(t * 7));
  });
  if (lockEvent >= 0 && lockEvent > lastLocked) {
    const p = pieces[lockEvent];
    if (!reduced) { gsap.fromTo(p.g.scale, { y: 0.82, x: 1.08 }, { y: 1, x: 1, duration: 0.55, ease: 'elastic.out(1, 0.5)' }); }
    burst(p.cx, p.cy - p.h / 2, p.isT ? 30 : 14); camState.shake = p.isT ? 0.22 : 0.08;
    T.hopV = 3.4; say(p.proj.quip); stackTouch = true;
  }
  lastLocked = Math.max(...pieces.map((p, k) => (p.locked ? k : -1)));

  // ── line clear (driven by clearQ)
  const allLocked = pieces.every((p) => p.locked);
  const eatX = allLocked ? lerp(-1.5, COLS + 0.5, smooth((clearQ - 0.12) / 0.42)) : -10;   // tiger runs across
  const collapse = allLocked ? smooth((clearQ - 0.58) / 0.22) : 0;
  pieces.forEach((p) => {
    p.cells.forEach(([dx, dy], k) => {
      const row = p.row + dy, col = p.x + dx, m = p.cellMeshes[k];
      const inClear = CLEAR_ROWS.includes(row);
      if (inClear && allLocked) {
        const flash = clearQ > 0.02 && clearQ < 0.12 && Math.floor(clearQ * 60) % 2 === 0;
        const eaten = col + 0.3 < eatX; p.eaten[k] = eaten;
        const s = eaten ? Math.max(0, 1 - (eatX - col - 0.3) * 1.4) : 1; m.scale.setScalar(s); m.visible = s > 0.02;
        m.material = flash ? flashMat : p.mat;
      } else { m.scale.setScalar(1); m.visible = true; m.material = p.mat; }
    });
    p.shifted = allLocked && collapse > 0 && !p.cellRows.every((r) => CLEAR_ROWS.includes(r));
    if (p.shifted) p.g.position.y = p.cy - 2 * collapse;
  });
  linesCleared = allLocked && clearQ > 0.55 ? CLEAR_ROWS.length : 0;
  if (allLocked && clearQ > 0.62) clearTexts.forEach((t) => t.reveal()); else if (clearQ < 0.5) clearTexts.forEach((t) => t.hide());

  // ── sky
  const stage = (allLocked && clearQ > 0.72) ? 2 : (wellProg > 0.05 ? 1 : 0);
  if (stage !== skyStage || stage === 1) setSky(stage, stage === 1 ? PIECES[activeK].cat : null);
  skyColor.lerp(skyTarget, 1 - Math.pow(0.001, dt / (SKY.flipMs / 1000))); scene.fog.color.copy(skyColor);
  // stage lighting eases toward the stage's numbers (same clock as the sky flip)
  const lk = 1 - Math.pow(0.001, dt / (SKY.flipMs / 1000));
  hemi.intensity = lerp(hemi.intensity, LIGHT.hemi.intensity[stage], lk); spot.intensity = lerp(spot.intensity, LIGHT.spot.intensity[stage], lk); spot.angle = lerp(spot.angle, LIGHT.spot.angle[stage], lk); fill.intensity = lerp(fill.intensity, LIGHT.fill.intensity[stage], lk);
  const wl = stage === 2 ? LIGHT.well.light : LIGHT.well.dark;
  wellMat.color.lerp(tmpC.set(wl.wall), lk); rimMat.color.lerp(tmpC.set(wl.rim), lk); gridMat.color.lerp(tmpC.set(wl.grid), lk); gridMat.emissive.lerp(tmpC.set(wl.lines), lk);
  // tint light follows the active piece
  tintLight.intensity = 0;

  // ── tiger brain
  T.quipT -= dt; if (T.quipT <= 0 && T.quip) { T.quip = ''; } quipEl.classList.toggle('on', !!T.quip && !(inWhite || afterClear));
  const falling = wellProg < N ? pieces[activeK] : null;
  if (allLocked && clearQ > 0.12) {
    if (clearQ < 0.6) { T.tx = eatX; }                                  // eating run
    else { T.tx = 5.0; }                                                  // then centre stage
    if (clearQ > 0.88 && !T.faceCam) { T.faceCam = 1; say(COPY.clear.tiger, 4); }
  } else if (falling && !falling.locked) {
    T.faceCam = 0;
    const f0 = falling.x - 1.3, f1 = falling.x + falling.w + 0.3;       // footprint of the falling piece (in cols)
    if (T.x > f0 && T.x < f1 && falling.row > -1) {                       // get out from under it
      const left = f0 - 0.4, right = f1 + 0.4; T.tx = (left >= 0.6 && (T.x - left < right - T.x || right > COLS - 0.6)) ? left : Math.min(COLS - 0.6, right);
    }
  } else if (lastLocked >= 0 && !allLocked) { const p = pieces[lastLocked]; T.tx = clamp(p.x + p.w / 2, 0.6, COLS - 0.6); }
  // move
  const dx = T.tx - T.x; const sp = 7.5;
  if (Math.abs(dx) > 0.05) { T.vx = clamp(dx * 6, -sp, sp); T.x += T.vx * dt; T.moving = true; T.facing = Math.sign(T.vx) || T.facing; } else { T.vx = 0; T.moving = false; }
  const surf = allLocked && clearQ > 0.12 && clearQ < 0.62 ? rowY(CLEAR_ROWS[0]) - 0.5 : surfaceAt(T.x);
  T.ty = surf;
  // vertical: hop physics on top of the surface
  T.hopV -= 16 * dt; T.hop = Math.max(0, T.hop + T.hopV * dt); if (T.hop === 0 && T.hopV < 0) T.hopV = 0;
  T.y += (T.ty - T.y) * Math.min(1, dt * 10);
  // frames
  T.walkT += dt * (T.moving ? 9 : 0);
  T.blinkAt -= dt; if (T.blinkAt < 0) { T.blink = !T.blink; T.blinkAt = T.blink ? 0.12 : 2.2 + Math.random() * 3; }
  setTigerFrame(T.moving ? (Math.floor(T.walkT) % 2 ? TIGER_A : TIGER_B) : (Math.floor(t * 1.2) % 5 === 0 ? TIGER_A : TIGER_SIT), T.blink);
  const bob = T.moving ? Math.abs(Math.sin(T.walkT * Math.PI)) * 0.08 : Math.sin(t * 2.2) * 0.015;
  tiger.position.set(X0 + T.x, T.y + T.hop + bob, 0);
  T.faceCamT += ((T.faceCam ? 1 : 0) - T.faceCamT) * Math.min(1, dt * 5);
  tiger.rotation.y = lerp(T.facing < 0 ? Math.PI : 0, Math.PI / 2, T.faceCamT);
  tiger.scale.set(1, 1 - Math.min(0.12, Math.abs(T.hopV) * 0.02), 1);
  tigerShadow.position.set(tiger.position.x, T.y + 0.01, 0); tigerShadow.material.opacity = 0.35 / (1 + T.hop * 1.5); tigerShadow.scale.setScalar(1 / (1 + T.hop * 0.4));
  tigerHit.position.copy(tiger.position).add(new THREE.Vector3(0, 0.95, 0));
  // quip position → screen
  if (T.quip) { v3.set(tiger.position.x, tiger.position.y + 2.1, 0).project(camera); quipEl.style.transform = `translate(${((v3.x + 1) / 2 * vw).toFixed(0)}px, ${((1 - v3.y) / 2 * vh - 8).toFixed(0)}px) translate(-50%, -100%)`; }

  // ── camera rails
  let tp = camState.tPos, tl = camState.tLook;
  if (scroll < R.hero.top) { const p = smooth(headerP); tp.set(lerp(CAMERA.header.from.pos[0], CAMERA.header.to.pos[0], p), lerp(CAMERA.header.from.pos[1], CAMERA.header.to.pos[1], p), lerp(CAMERA.header.from.pos[2], CAMERA.header.to.pos[2], p)); tl.set(0, lerp(CAMERA.header.from.look[1], CAMERA.header.to.look[1], p), lerp(CAMERA.header.from.look[2], CAMERA.header.to.look[2], p)); }
  else if (scroll < R.clear.top) { const top = stackTopY(); const ax = wellProg < N ? pieces[activeK].cx : 0; const sx = vw > 800 ? CAMERA.well.sideShift : 0; tp.set(sx + ax * CAMERA.well.followX, CAMERA.well.pos[1] + top * CAMERA.well.followStack, CAMERA.well.pos[2] + top * 0.12); tl.set(sx + ax * CAMERA.well.followX * 0.6, CAMERA.well.look[1] + top * CAMERA.well.followStack, 0); }
  else { const q = smooth(clearQ); const sx = vw > 800 ? CAMERA.well.sideShift : 0; tp.set(sx, lerp(CAMERA.clear.from.pos[1], CAMERA.clear.to.pos[1], q), lerp(CAMERA.clear.from.pos[2], CAMERA.clear.to.pos[2], q)); tl.set(sx, lerp(CAMERA.clear.from.look[1], CAMERA.clear.to.look[1], q), 0); }
  const k = reduced ? 1 : Math.min(1, dt * 4.5);
  camState.pos.lerp(tp, k); camState.look.lerp(tl, k);
  mouse.sx += (mouse.x - mouse.sx) * CAMERA.mouse.damping; mouse.sy += (mouse.y - mouse.sy) * CAMERA.mouse.damping;
  const dist = camState.pos.distanceTo(camState.look);
  camState.shake *= 0.9;
  camera.position.set(camState.pos.x + mouse.sx * CAMERA.mouse.yaw * dist * 2.2 + (Math.random() - 0.5) * camState.shake, camState.pos.y - mouse.sy * CAMERA.mouse.pitch * dist * 1.6 + (Math.random() - 0.5) * camState.shake, camState.pos.z);
  camera.lookAt(camState.look);

  // ── dust
  for (const d of dust) { if (d.t >= 1) continue; d.t += dt * 1.7; d.v.y -= 9 * dt; d.m.position.addScaledVector(d.v, dt); const s = 1 - d.t; d.m.scale.setScalar(Math.max(0.001, s)); if (d.t >= 1) d.m.visible = false; }

  // ── HUD
  if (inWell) {
    const kk = clamp(activeK, 0, N - 1); showCard(kk);
    $('h-piece').textContent = String(kk + 1).padStart(2, '0') + ' / ' + N;
    const p = pieces[kk]; const st = pieceState(p, kk); $('h-xy').textContent = String(p.x).padStart(2, '0') + ' · ' + String(clamp(Math.round(BOARD_ROWS - 1 - (st.cy - 0.5 + (p.h - 1) / 2)), 0, 99)).padStart(2, '0');
    $('h-lines').textContent = String(linesCleared).padStart(2, '0');
    [...stackEl.children].forEach((el, i) => el.classList.toggle('on', pieces[i].locked));
  }

  // ── cursor
  mx.cx += (mx.x - mx.cx) * 0.25; mx.cy += (mx.y - mx.cy) * 0.25;
  cursor.style.transform = `translate3d(${mx.cx.toFixed(1)}px, ${mx.cy.toFixed(1)}px, 0)`;
  ray.setFromCamera(new THREE.Vector2(mouse.x, -mouse.y), camera); hoverTiger = !inWhite && !afterClear && ray.intersectObject(tigerHit).length > 0;
  const overLink = document.elementFromPoint(mx.x, mx.y)?.closest?.('a, button');
  setPill(hoverTiger ? COPY.well.hover : overLink ? 'open' : (scroll < vh * 0.4 && booted ? 'scroll' : ''));

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
const flashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 });
let stackTouch = false;
window.addEventListener('resize', measure);
measure();
requestAnimationFrame(frame);
