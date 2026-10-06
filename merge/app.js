// KookyTiger — MERGED LAYOUT (Léo × Laurens), motion pass.
//   Camera  = Léo: position is a LINEAR function of page scroll (Lenis is the only smoothing), rotation never changes,
//             header dollies down 2.4 / forward 4 over 200vh, then a straight vertical descent — even under paper.
//   Tiger   = Laurens: the character keeps one place on the right of the frame; its CLIPS are scrubbed by scroll
//             (clip time = f(scroll)), root motion stripped (the world moves, not the tiger); idle → turnToWall →
//             overEdge → climbing (loop) → landing → turnAround → sit, with a head-glance layer and time-driven idle bits.
//   The rig below is a procedural placeholder with the same clip grammar, so a skinned GLB can replace it later:
//   each state is a function of (scroll phase) → pose, exactly like `action.time = f(scroll)`.
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { CATS, SIL, PIECES, SECTIONS, TITLE_SCREENS, VALUE_SCREENS, THEMES, CARD_ART, SCREEN_PER_CARD, SHORE_TEXT_AT, INTRO_SCREENS, MEADOW_SCREENS, LAND_AT, RATE, CAMERA, TIGER, LEDGE_X, DECK, COPY, ARCHIVE, MOUSE, MOTION, SKY, LIGHT, OPENING, LIGHTS, FLOOR_STYLE, WEAR, REWARD } from './content.js';
import { WRITEUPS, WRITEUP_LIB, TOOL_ICONS, SITE_TEXT } from './writeups.js';
import { renderWriteup, wuView } from './writeup-view.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (v, [a, b]) => clamp((v - a) / (b - a), 0, 1);
const frac = (v) => v - Math.floor(v);
// The site copy Kay edits in the Studio (merge/writeups/_site.json → SITE_TEXT) replaces content.js's text: cards, floors, archive, everything else.
// Inside the Studio's preview (?studio in an iframe) the text and type she is still trying come from her browser instead (localStorage),
// so nothing unpublished ever reaches anyone else.
const STUDIO = new URLSearchParams(location.search).has('studio') && window.parent !== window;
const studioDraft = () => { try { return JSON.parse(localStorage.getItem('studio.siteDraft'))?.site || null; } catch { return null; } };
// Type (Studio → Site text → Type): size, weight and case of the five kinds of big display text, as CSS variables style.css reads
const TYPE_GROUPS = { hero: 0.9, titles: 0.8, values: 0.8, shore: 0.8, footer: 0.9 };      // group → its line height in capitals
function applyType(style) {
  const root = document.documentElement.style;
  Object.entries(TYPE_GROUPS).forEach(([g, lh]) => { const t = style?.[g] || {}, lower = t.case === 'none';
    root.setProperty(`--${g}-size`, String((+t.size || 100) / 100)); root.setProperty(`--${g}-weight`, String(+t.weight || 800));
    root.setProperty(`--${g}-case`, lower ? 'none' : 'uppercase'); root.setProperty(`--${g}-lh`, String(lower ? lh + 0.17 : lh)); });   // lowercase needs room for descenders
}
// The lineup comes from the Studio (Kay, 2026-10-01): a project is on the site when its write-up is ● Approved and ticked "on the site",
// on the floor and in the order the Studio gives it (merge/writeups/*.json → WRITEUPS; the Studio sorts a floor by `order`, then name).
// content.js's PIECES only lends a project its art (cut-out, line drawing) and its old copy; a project it doesn't know yet gets its card
// from the write-up (name, one-liner, year) and its cover as the object. With no approved write-up at all, content.js's lineup stands.
(function applyLineup() {
  const fo = Object.fromEntries(SECTIONS.map((s, i) => [s.id, i]));
  const on = Object.entries(WRITEUPS).map(([slug, w]) => ({ slug, w })).filter(({ w }) => w.floor in fo);
  if (!on.length) return;
  on.sort((a, b) => fo[a.w.floor] - fo[b.w.floor] || (a.w.order ?? 99) - (b.w.order ?? 99) || String(a.w.name).localeCompare(String(b.w.name)));
  const known = Object.fromEntries(PIECES.map((p) => [p.slug, p]));
  const next = on.map(({ slug, w }) => known[slug] || { name: w.name || slug, slug, cat: '', year: (String(w.context?.when || '').match(/\d{4}/) || [''])[0],
    sil: 'house', img: w.cover || null, desc: w.oneLiner || '', meta: [], take: '' });
  PIECES.splice(0, PIECES.length, ...next);
  SECTIONS.forEach((s) => { s.pieces = []; });
  on.forEach(({ w }, i) => SECTIONS[fo[w.floor]].pieces.push(i));
})();
(function applySiteText(t) {
  if (!t) return;
  applyType(t.style);
  PIECES.forEach((p) => { const c = t.cards?.[p.slug]; if (!c) return;
    if (c.name) p.name = c.name; if (c.category) p.catName = c.category; if (c.year != null) p.year = c.year;
    if (c.tags != null) p.meta = String(c.tags).split('·').map((x) => x.trim()).filter(Boolean);
    if (c.desc != null) p.desc = c.desc; if (c.take != null) p.take = c.take; });
  (t.sections || []).forEach((s, i) => { const S = SECTIONS[i]; if (!S) return;
    ['title', 'sub'].forEach((k) => { if (s[k] != null) S[k] = s[k]; }); if (Array.isArray(s.value) && s.value.length) S.value = s.value; });
  const deep = (to, from) => Object.entries(from || {}).forEach(([k, v]) => { if (v && typeof v === 'object' && !Array.isArray(v)) deep(to[k] ||= {}, v); else if (v != null) to[k] = v; });
  deep(COPY, t.copy);
  if (Array.isArray(t.archive)) ARCHIVE.splice(0, ARCHIVE.length, ...t.archive.map((r) => [r.name, r.line, r.course, r.year]));
})((STUDIO && studioDraft()) || SITE_TEXT);
const FLOOR_IDS = SECTIONS.map((s) => s.id);                     // the floors in content.js's order: the Studio's site text addresses them by this place (`at`)
SECTIONS.forEach((s, i) => { s.at = i; });
if (SECTIONS.some((s) => !s.pieces.length) && SECTIONS.some((s) => s.pieces.length)) {
  for (let i = SECTIONS.length - 1; i >= 0; i--) if (!SECTIONS[i].pieces.length) SECTIONS.splice(i, 1);
  SECTIONS.forEach((s, i) => { s.num = String(i + 1).padStart(2, '0'); });
}
const catName = (p) => p.catName || CATS[p.cat]?.name || '';
const NP = PIECES.length;
const PARAMS = new URLSearchParams(location.search); const SNAP = PARAMS.has('snap');
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;      // no flights, no flicker, shorter opening
// the opening is the top of the page: never restore a mid-page scroll on reload (it would open on blank paper with no tiger)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!SNAP || PARAMS.has('entry')) scrollTo(0, 0);
const HALF = Math.PI / 2;

gsap.registerPlugin(SplitText, CustomEase);
CustomEase.create('reveal', MOTION.reveal.ease);
CustomEase.create('hide', MOTION.hide.ease);

// ───────────────────────── DOM: build the page from content ─────────────────────────
const NWORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'][NP] || String(NP);
const tpl = (t) => t.replace(/\{N_UP\}/g, NWORD.toUpperCase()).replace(/\{N_CAP\}/g, NWORD[0].toUpperCase() + NWORD.slice(1)).replace(/\{N\}/g, NWORD);
// ───────────────────────── The visitor's progress (Kay, 2026-10-01): what you have seen unlocks the tiger's acts and wardrobe ─────────────────────────
// localStorage `kooky.progress`: projects seen (slugs), achievements said, what the tiger wears, visits, the floor you were last on, time here.
// Never in the Studio's preview. ptl fills {n}-style slots in the copy.
// Floors are remembered by id, since the Studio can take one away ('floor0'-style keys from 2026-10-01 were positions in content.js's order).
const PROG = (() => { let d = {}; try { d = JSON.parse(localStorage.getItem('kooky.progress')) || {}; } catch (e) {} if (!d || typeof d !== 'object') d = {};
  const arr = (v) => (Array.isArray(v) ? v : []), floorId = (k) => (typeof k === 'number' ? FLOOR_IDS[k] ?? null : k ?? null);
  return { seen: new Set(arr(d.seen)), ach: new Set(arr(d.ach).map((a) => (/^floor\d+$/.test(a) && FLOOR_IDS[+a.slice(5)] ? 'floor-' + FLOOR_IDS[+a.slice(5)] : a))), wear: new Set(arr(d.wear)),
    visits: +d.visits || 0, lastFloor: floorId(d.lastFloor === -1 ? null : d.lastFloor), secs: +d.secs || 0, back: (+d.visits || 0) > 0 && !STUDIO }; })();
function progSave() { if (STUDIO) return; try { localStorage.setItem('kooky.progress', JSON.stringify({ seen: [...PROG.seen], ach: [...PROG.ach], wear: [...PROG.wear], visits: PROG.visits, lastFloor: PROG.lastFloor, secs: Math.round(PROG.secs) })); } catch (e) {} }
if (!STUDIO) { PROG.visits++; progSave(); }
addEventListener('pagehide', progSave);
const PL = COPY.progress, ptl = (t, o) => tpl(String(t || '')).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
const toastEl = $('toast'); const toastQ = []; let toastT = null;
function toast(text) { toastQ.push(text); if (!toastT && !panelOpen) toastNext(); }   // an open panel covers the toast: it waits for the close
function toastNext() { if (panelOpen) { toastT = null; return; } const t = toastQ.shift(); if (!t) { toastT = null; return; } toastEl.textContent = t; toastEl.classList.add('on'); toastT = setTimeout(() => { toastEl.classList.remove('on'); toastT = setTimeout(toastNext, 450); }, 3200); }
function ach(id, text) { if (PROG.ach.has(id)) return; PROG.ach.add(id); progSave(); toast(text); }
const seenKey = (pi) => PIECES[pi].slug || 'p' + pi;
const seenN = () => PIECES.reduce((n, p, i) => n + (PROG.seen.has(seenKey(i)) ? 1 : 0), 0);   // of the projects on the site now
const needOf = (k) => Math.min(k || 0, NP);                                                   // an unlock never asks for more projects than there are
function markSeen(pi) { const key = seenKey(pi); if (PROG.seen.has(key)) return; PROG.seen.add(key); progSave(); progUI();
  const n = seenN(), A = PL.ach;
  if (n === 1) ach('first', A.first);
  SECTIONS.forEach((sec, i) => { if (sec.pieces.every((k) => PROG.seen.has(seenKey(k)))) ach('floor-' + sec.id, ptl(A.floor, { f: sec.num })); });
  if (n >= Math.ceil(NP / 2) && n < NP) ach('half', A.half);
  if (n === NP) ach('all', tpl(A.all)); }
function progUI() { $('lift-seen').textContent = ptl(PL.seen, { n: String(seenN()).padStart(2, '0'), t: String(NP).padStart(2, '0') }); renderTalents(); renderWardrobe(); }
$('vh-a').textContent = matchMedia('(hover: none)').matches ? COPY.entry.hintTouch : COPY.entry.hint; $('vh-b').textContent = COPY.entry.sub;
$('bubble-who').textContent = COPY.intro.who; $('intro').style.setProperty('--n', INTRO_SCREENS);
$('intro').innerHTML = `<div class="sr-only">${COPY.intro.pages.map((pg) => `<p>${pg.join(' ')}</p>`).join('')}</div>`;
const navMask = (x, i) => `<span class="m" style="--d:${(i * 0.08).toFixed(2)}s"><span class="mi">${x}</span></span>`;   // the nav's words rise in order when the world opens (A3)
$('nav-brand').innerHTML = `${navMask(COPY.nav.name, 0)}<span class="sub">${COPY.nav.sub}</span>`;
$('nav-links').innerHTML = navMask(COPY.nav.tagline || 'Product, film, games, analytics', 1);
$('nav-right').innerHTML = COPY.nav.links.map((l, i) => `<a href="#" data-to="${['title0', 'intro', 'archives'][i]}">${navMask(l, i + 2)}</a>`).join('');
$('h-statement').innerHTML = COPY.header.statement.map(tpl).join('<br>');
$('h-scroll').textContent = COPY.header.scroll;
$('hero-words').innerHTML = COPY.hero.words.map((w, i) => `<span class="word"><span class="main">${w}</span><span class="alt"><span class="t">${String(COPY.hero.reveal[i] ?? '').replace(/\//g, '/<wbr>')}</span></span></span>`).join('') + `<div class="ind">${COPY.hero.indication}</div>`;
$('hero-l').innerHTML = (COPY.hero.left || ['Raised in Wuhan', 'Designing anywhere']).join('<br>');
$('hero-r').innerHTML = (COPY.hero.right || ['Northwestern ’27', 'MaDE + RTVF']).join('<br>');
// a hover line longer than its word (e.g. "Radio/Television/Film (RTVF)" under ZISHU) wraps, then shrinks until it fits the word's box
function fitAlts() { document.querySelectorAll('.hero .word .alt').forEach((a) => { const t = a.firstElementChild; let f = 0.44; a.style.fontSize = f + 'em';
  while (f > 0.14 && (t.scrollWidth > a.clientWidth + 1 || t.offsetHeight > a.clientHeight + 1)) { f -= 0.02; a.style.fontSize = f.toFixed(2) + 'em'; } }); }
document.fonts.ready.then(fitAlts); addEventListener('resize', fitAlts);
const artSrc = (p) => CARD_ART === 'photo' ? (p.img || p.silImg) : (p.silImg || p.img);
const cardArt = (p) => { const src = artSrc(p); return src ? `<img src="${src}" alt="${p.name}" loading="lazy" decoding="async">` : `<svg viewBox="0 0 200 140" role="img" aria-label="${p.name}">${SIL[p.sil]}</svg><figcaption>placeholder · silhouette of the object</figcaption>`; };
// each floor shows its work its own way (FLOOR_STYLE): the workshop prints the part out of its drawing, the bar finds it with a spotlight
const floorArt = (p, show) => { const src = artSrc(p);
  if (show === 'print' && p.lineImg && src) return `<figure class="print"><img class="line" src="${p.lineImg}" alt="" aria-hidden="true" loading="lazy" decoding="async"><img class="part" src="${src}" alt="${p.name}" loading="lazy" decoding="async"><i class="scan" aria-hidden="true"></i></figure>`;
  if (show === 'spot') return `<figure class="spot"><i class="beam" aria-hidden="true"></i><i class="pool" aria-hidden="true"></i>${cardArt(p)}</figure>`;
  return `<figure>${cardArt(p)}</figure>`; };
const body = $('body'); let html = '';
const deckIdx = SECTIONS.findIndex((x) => x.deck);
const titleLines = (t) => t.split(' & ').map((l, i, a) => `<span class="line">${l}${i < a.length - 1 ? ' &amp;' : ''}</span>`).join('');
const eyebrowOf = (p, pi) => `<span class="n">${String(pi + 1).padStart(2, '0')} / ${NP}</span><span>${catName(p)}</span><span>${p.year}</span>`;
const projText = (p, pi) => `<div class="text"><p class="eyebrow mono">${eyebrowOf(p, pi)}</p>
    <h2>${p.name}</h2><p class="desc">${p.desc}</p><p class="take">${p.take}</p><p class="more mono">${COPY.cursor.card} ↗</p></div>`;
// a floating object's words: its number and name announce themselves when it reaches the middle (.on); the rest comes on hover (Kay, 2026-10-01)
const cardText = (p, pi) => `<div class="text"><div class="label"><p class="eyebrow mono"><span class="mi">${eyebrowOf(p, pi)}</span></p><h2><span class="mi">${p.name}</span></h2></div>
    <div class="detail"><p class="desc">${p.desc}</p><p class="take">${p.take}</p><p class="more mono">${COPY.cursor.card} ↗</p></div></div>`;
SECTIONS.forEach((sec, w) => {
  const last = w === SECTIONS.length - 1; const idx = sec.pieces; const dark = THEMES[sec.theme].ink === 'light'; const show = FLOOR_STYLE[sec.theme]?.show;
  // screens the projects take: one per floating object, or entry + hold + exit when they live on the computer's screen
  const span = sec.deck ? DECK.entry + (idx.length - 1) + DECK.exit : idx.length * SCREEN_PER_CARD;
  const n = span + VALUE_SCREENS;
  // the floor's title: a full-screen paper block over the world (Léo's paper, Kay 2026-10-01); the camera passes the slab behind it
  html += `<section class="paper st title" id="title${w}" style="--n:${TITLE_SCREENS}"><div class="wrap"><p class="eyebrow mono">${sec.num} / ${String(SECTIONS.length).padStart(2, '0')} · ${idx.length} ${COPY.section.projects}</p><div class="big" id="title-big${w}">${titleLines(sec.title)}</div><p class="sub split">${sec.sub}</p></div></section>`;
  html += `<section class="window${dark ? ' dark' : ''}" id="win${w}" data-theme="${sec.theme}" style="--n:${n}" aria-label="${sec.title}">`;
  if (!sec.deck) idx.forEach((pi, j) => { const p = PIECES[pi]; html += `<article class="card${p.wide ? ' wide' : ''}${show ? ' show-' + show : ''}" style="--i:${j * SCREEN_PER_CARD}" data-p="${pi}"><div class="in" role="button" tabindex="0" aria-label="Open ${p.name}">
    ${floorArt(p, show)}${cardText(p, pi)}</div></article>`; });
  // the value statement: over the room, char by char (Léo's library statement) — never paper on paper
  const said = sec.value.some((l) => String(l).trim());          // Kay can empty a statement in the Studio: then no halo either
  html += `<div class="value-text${dark || !said ? '' : ' halo'}" style="--i:${span}"><div class="big" id="value-big${w}" data-style="${FLOOR_STYLE[sec.theme]?.value || ''}">${sec.value.map((l) => `<span class="line">${tpl(l)}</span>`).join('')}</div></div>`;
  html += `</section>`;
});
body.innerHTML = html;
// D2 print: where the contained cut-out actually sits in its figure (the letterbox around it), so the print's clip and its head run over the part
document.querySelectorAll('figure.print img.part').forEach((img) => { const set = () => { const f = img.parentElement, fa = f.offsetWidth / f.offsetHeight || 200 / 140, ar = img.naturalWidth / img.naturalHeight; if (!ar) return;
  f.style.setProperty('--ix', ar < fa ? ((1 - ar / fa) / 2 * 100).toFixed(2) : '0'); f.style.setProperty('--iy', ar > fa ? ((1 - fa / ar) / 2 * 100).toFixed(2) : '0'); };
  if (img.complete && img.naturalWidth) set(); else img.addEventListener('load', set, { once: true }); });
// the meadow comes after the archives (Kay, 2026-09-27): landing, THE OTHER SHORE, turn, sit, the talent show; then the footer paper
const meadowEl = $('meadow'); meadowEl.style.setProperty('--n', MEADOW_SCREENS); meadowEl.dataset.theme = SECTIONS[SECTIONS.length - 1].theme;
meadowEl.innerHTML = `<div class="shore-text" style="--i:${SHORE_TEXT_AT}"><div class="big" id="shore-big">${COPY.shore.words.map((x) => `<span class="split" style="display:block">${x}</span>`).join('')}</div><div class="sub split">${tpl(COPY.shore.sub)}</div><br><a class="sayhi" href="mailto:${COPY.footer.email}">${COPY.shore.sayhi}</a><button class="trick mono" id="trick" type="button" disabled></button><button class="trick mono" id="wear" type="button" disabled></button></div>`;
// the computer's screen (floor 03): a fixed overlay laid over the projected screen plane every frame; one preview per screen of scroll
const deckEl = $('deck');
if (deckIdx >= 0) { const sec = SECTIONS[deckIdx], n = sec.pieces.length;
  deckEl.innerHTML = `<div class="screen" style="--n:${n}"><div class="strip" id="deck-strip">${sec.pieces.map((pi, j) => { const p = PIECES[pi]; return `<article class="slide" data-p="${pi}" data-j="${j}"><div class="in" role="button" tabindex="0" aria-label="Open ${p.name}"><div class="bar mono"><span class="dots"><i></i><i></i><i></i></span><span class="name">${p.name}</span><span>${catName(p)}</span></div><div class="body"><figure>${cardArt(p)}</figure>${projText(p, pi)}</div></div></article>`; }).join('')}</div>
    <div class="hud mono"><span id="deck-n">01 / ${String(n).padStart(2, '0')}</span><span class="track"><i id="deck-bar"></i></span><span class="keys">← → · drag</span></div>
    <div class="crt" id="deck-crt" aria-hidden="true"><i class="t"></i><i class="b"></i><i class="ln"></i></div></div>`; }
// the opening's title card and the lift's floor display (fixed overlays, filled from the same copy)
const mi = (x) => `<span class="mi">${x}</span>`;
$('titlecard').innerHTML = `<p class="tc0 mono">${mi(COPY.nav.sub || '')}</p><p class="tc1">${mi(COPY.nav.name)}</p><p class="tc2 mono">${mi(COPY.nav.tagline || '')}</p>`;
$('lift-roll').innerHTML = SECTIONS.map((x) => `<i>${x.num}</i>`).join('');
$('arch-head').innerHTML = `<span class="split">${COPY.archives.title}</span><span class="mono">${COPY.archives.note}</span>`;
$('arch-table').innerHTML = ARCHIVE.map((r, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td><b>${r[0]}</b><span>${r[1]}</span></td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('');
$('foot-words').innerHTML = COPY.footer.words.map((w) => `<span class="word split">${tpl(w)}</span>`).join('') + `<a class="sayhi" href="mailto:${COPY.footer.email}">${COPY.footer.sayhi}</a>`;
$('foot-bottom').innerHTML = `<span>${COPY.footer.bottom[0]} · ${COPY.footer.bottom[1]}</span><a href="mailto:${COPY.footer.email}">${COPY.footer.email}</a><span>${COPY.footer.bottom[2]}</span>`;

// ───────────────────────── Project detail panel (slides in from the left; the tiger keeps hanging on the right) ─────────────────────────
const panel = $('panel'), panelInner = $('panel-inner'), panelScrim = $('panel-scrim'); let panelOpen = false, panelFrom = null;
// A project whose write-up Kay approved in the Studio (merge/writeups.js) opens as its case study; the others keep the copy in content.js.
// ?drafts on localhost shows every Studio draft instead, approved or not, for checking them in the real panel.
const DRAFTS = { on: new URLSearchParams(location.search).has('drafts') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname), w: {}, lib: null, icons: null };
if (DRAFTS.on) {
  const get = (path) => fetch(path).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  get('writeups/_studio.json').then((j) => (DRAFTS.lib = j));
  get('vendor/tool-icons.json').then((j) => (DRAFTS.icons = j?.icons || {}));
  PIECES.forEach((p) => p.slug && get(`writeups/${p.slug}.json`).then((j) => { if (j) DRAFTS.w[p.slug] = j; }));
}
// the clicked object itself flies into the panel (its place at the panel's top right) and back to the room on close — one continuous move,
// not a cut (Kay, 2026-10-01: Aristide's "transitioned through, not a 跳转"). The room keeps an empty spot while it is away.
let flight = null, flownFrom = null, flyTgt = null;
const objOf = (el) => el?.querySelector('figure .part') || el?.querySelector('figure img:not(.line), figure svg');   // the cut-out itself, never the workshop's line drawing
// fly: a copy of srcEl travels fromRect → toRect. cross: on landing it fades out while the target fades in (a write-up cover that is
// another picture of the same project). A flight cut short by the next one still finishes its business (done), so nothing stays hidden.
function fly(fromRect, toRect, srcEl, dur, done, cross) {
  if (flight) { const f = flight; flight = null; f.tw.kill(); f.el.remove(); f.done && f.done(); }
  const el = srcEl.tagName === 'IMG' ? new Image() : srcEl.cloneNode(true); if (el.tagName === 'IMG') { el.src = srcEl.currentSrc || srcEl.src; el.alt = ''; }
  el.setAttribute('class', 'fly'); el.removeAttribute('id'); el.setAttribute('aria-hidden', 'true');   // setAttribute: an SVG's className is read-only
  Object.assign(el.style, { left: fromRect.left + 'px', top: fromRect.top + 'px', width: fromRect.width + 'px', height: fromRect.height + 'px', opacity: '' }); document.body.appendChild(el);
  const end = () => { el.remove(); if (flight && flight.el === el) flight = null; done && done(); };
  const tw = gsap.timeline({ onComplete: end }).to(el, { left: toRect.left, top: toRect.top, width: toRect.width, height: toRect.height, duration: dur, ease: 'reveal' });
  if (cross) tw.to(el, { opacity: 0, duration: 0.35, ease: 'power1.out' });
  flight = { el, tw, done };
}
// the panel is modal: the page, the nav and the computer's screen behind it are inert while it is open
const modalBg = (on) => { for (const el of [$('page'), document.querySelector('.nav')]) if (el) el.inert = on; deckLock(); };
function settlePanel() { if (flight) { const f = flight; flight = null; f.tw.kill(); f.el.remove(); f.done && f.done(); }
  if (flownFrom) { flownFrom.closest('figure')?.classList.remove('away'); flownFrom = null; } if (flyTgt) { flyTgt.style.opacity = ''; flyTgt = null; } }
function openPanel(pi, from) { if (panelOpen) settlePanel(); const p = PIECES[pi], d = p.detail || {}, L = COPY.panel; panelFrom = from || null;
  const draft = DRAFTS.on && DRAFTS.lib && DRAFTS.w[p.slug], w = draft || WRITEUPS[p.slug];
  const src = artSrc(p), obj = `<figure class="obj" aria-hidden="true">${src ? `<img src="${src}" alt="">` : `<svg viewBox="0 0 200 140">${SIL[p.sil]}</svg>`}</figure>`;
  let cross = false;
  if (w) {
    panelInner.innerHTML = renderWriteup(w, draft ? DRAFTS.lib : WRITEUP_LIB, draft ? DRAFTS.icons : TOOL_ICONS, { index: pi + 1, total: NP, email: COPY.footer.email, labels: COPY.panel });   // opens on the short version when the write-up has one
    // the object flies into the write-up's cover; if the cover is another picture (People Like Us), it lands there and dissolves into it
    const cov = panelInner.querySelector('.wu-cover img');
    if (cov) { cov.loading = 'eager'; cov.closest('figure').classList.add('obj-in'); cross = !src || cov.getAttribute('src') !== src; } else panelInner.insertAdjacentHTML('afterbegin', obj);
    panelInner.querySelector('.wu-title')?.setAttribute('id', 'panel-title');
    panelInner.querySelectorAll('.wu > :not(.wu-process), .wu-process > :not(.wu-block)').forEach((el) => el.classList.add('blk'));   // the head, the tabs and the short version reveal like the old panel; the stages sit below the fold
  } else {
  const sec = (k, v, cls = '') => v ? `<div class="sec blk ${cls}"><span class="k mono">${k}</span><p>${v}</p></div>` : '';
  panelInner.innerHTML = obj + `<p class="eyebrow mono blk"><span class="n">${String(pi + 1).padStart(2, '0')} / ${NP}</span><span>${catName(p)}</span><span>${p.year}</span><span>${p.meta.join(' · ')}</span></p>
    <h2 id="panel-title" class="blk">${p.name}</h2><p class="line blk">${d.line || p.desc}</p>
    ${sec(L.role, d.role)}${sec(L.tools, d.tools)}${sec(L.numbers, d.numbers)}${sec(L.one, d.one || p.take, 'one')}
    <a class="ask blk" href="mailto:${COPY.footer.email}?subject=${encodeURIComponent(p.name)}">${L.ask}</a>`;
  }
  panel.scrollTop = 0; const s0 = REDUCE ? null : objOf(from), tgt = panelInner.querySelector('.obj img, .obj svg, .obj-in img'); flyTgt = tgt;
  if (s0 && tgt) {                                             // measure the target where it will be once the panel has slid in
    const a = s0.getBoundingClientRect(), b = tgt.getBoundingClientRect(), dx = new DOMMatrixReadOnly(getComputedStyle(panel).transform).m41;
    if (a.width > 4 && a.bottom > 0 && a.top < vh) {
      fly(a, { left: b.left - dx, top: b.top, width: b.width, height: b.height }, s0, 0.9, () => { tgt.style.opacity = ''; }, cross);
      if (cross) gsap.fromTo(tgt, { opacity: 0 }, { opacity: 1, duration: 0.35, delay: 0.9, ease: 'power1.in' });
      flownFrom = s0; s0.closest('figure').classList.add('away'); tgt.style.opacity = '0'; } }   // after fly(): a flight it cut short has already sent its object home
  panel.classList.add('open'); panel.inert = false; panel.setAttribute('aria-hidden', 'false'); panelScrim.classList.add('on'); panelOpen = true; panel.scrollTop = 0; modalBg(true);
  clearTimeout(PW.t); panelGrip.hidden = false; void panelGrip.offsetWidth; panelGrip.classList.add('on'); panelGrip.setAttribute('aria-valuenow', Math.round(panelFrac() * 100));   // the grip fades in once the panel is in
  markSeen(pi);                                                   // after panelOpen: its achievements wait for the close (the panel would cover them)
  panelInner.querySelector('.obj-in')?.classList.remove('blk');               // the cover the object lands in holds still
  gsap.fromTo(panelInner.querySelectorAll('.blk'), { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'reveal', stagger: 0.05, delay: 0.12, overwrite: true });
  lenis.stop(); setTimeout(() => $('panel-close').focus({ preventScroll: true }), 50); }
function closePanel() { if (!panelOpen) return; panelOpen = false;
  const back = flownFrom, tgt = flyTgt; flownFrom = null; flyTgt = null;
  if (back) { const home = () => back.closest('figure')?.classList.remove('away');
    const b = flight ? flight.el.getBoundingClientRect() : tgt?.getBoundingClientRect(), a = back.getBoundingClientRect();
    // the room's own object flies home (not the cover it may have dissolved into), from wherever it is now
    if (b && b.width > 4 && b.bottom > 0 && b.top < vh) { if (tgt) gsap.killTweensOf(tgt); fly(b, a, back, 0.75, home); if (tgt) tgt.style.opacity = '0'; }
    else { if (flight) { const f = flight; flight = null; f.tw.kill(); f.el.remove(); } home(); } }
  panel.classList.remove('open'); panel.inert = true; panel.setAttribute('aria-hidden', 'true'); panelScrim.classList.remove('on'); modalBg(false); lenis.start(); if (panelFrom) panelFrom.focus({ preventScroll: true });
  gripEnd(); panelGrip.classList.remove('on'); clearTimeout(PW.t); PW.t = setTimeout(() => { if (!panelOpen) panelGrip.hidden = true; }, 320);
  setTimeout(() => { if (!toastT && !panelOpen) toastNext(); }, 450); }
document.querySelectorAll('.card .in, .slide .in').forEach((el) => { const pi = +el.closest('[data-p]').dataset.p; el.addEventListener('click', () => openPanel(pi, el)); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(pi, el); } }); });
panel.inert = true; $('panel-close').addEventListener('click', closePanel); panelScrim.addEventListener('click', closePanel);
panelInner.addEventListener('click', (e) => {
  const v = e.target.closest('[data-view]');                      // the two versions of a write-up: the short one (default) ⇄ the whole process (writeup-view.js → wuView)
  if (v) { wuView(panelInner.querySelector('.wu'), v.dataset.view); const tabs = panelInner.querySelector('.wu-tabs'), y = tabs ? Math.max(0, tabs.offsetTop - 84) : 0;
    if (panel.scrollTop > y || v.classList.contains('wu-more')) panel.scrollTo({ top: y, behavior: 'smooth' }); return; }
  const a = e.target.closest('a[href^="#wu-"]'); if (!a) return;   // a write-up's process strip and skills jump inside the panel
  e.preventDefault(); panelInner.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
// the screen's own controls (floor 03): ← → keys, horizontal wheel / trackpad, drag — each maps onto page scroll, which drives the strip
const deckStrip = deckIdx >= 0 ? $('deck-strip') : null;
let deckLive = false; deckEl.inert = true;                        // nothing on a black screen can be hovered, clicked or tabbed to
function deckLock() { const v = panelOpen || !deckLive; if (deckEl.inert !== v) deckEl.inert = v; }
if (deckIdx >= 0) { const lo = () => world.hold.s0 * vh, hi = () => (world.hold.s0 + world.hold.len) * vh;
  const toSlide = (k) => (REW.autoUntil = performance.now() / 1000 + 1.2, lenis.scrollTo((world.hold.s0 + clamp(k, 0, world.hold.len)) * vh, { duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 4) }));
  // Tab between previews: the browser would scroll the overflow-hidden box itself; keep it still and bring the focused preview round
  deckEl.addEventListener('scroll', (e) => { const el = e.target; if (el.scrollLeft || el.scrollTop) { el.scrollLeft = 0; el.scrollTop = 0; } }, true);
  deckEl.addEventListener('focusin', (e) => { const sl = e.target.closest?.('.slide'); if (sl && !panelOpen && e.target.matches(':focus-visible')) toSlide(+sl.dataset.j); });   // keyboard focus only: a click opens it where it is
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
// the value statements: still letter by letter, but each floor says it its own way (FLOOR_STYLE.value, Kay 2026-10-01) — the workshop
// stamps the letters on, the bar's flicker on like neon, the computer types them behind a cursor
const chars = [];
const placeChars = (c) => c.chars?.forEach((ch) => { ch.style.setProperty('--cx', ch.offsetLeft + 'px'); ch.style.setProperty('--cy', ch.offsetTop + 'px'); });   // each letter's place, for the glow (C-g)
document.querySelectorAll('.st .big, .value-text .big').forEach((el) => { const c = { el, title: !!el.closest('.st'), shown: false, style: REDUCE ? '' : el.dataset.style || '', tl: null }; SplitText.create(el, { type: 'chars', charsClass: 'char', onSplit(self) { c.chars = self.chars; gsap.set(self.chars, { opacity: c.shown ? 1 : 0 }); self.chars.forEach((ch) => { ch.style.setProperty('--cx', ch.offsetLeft + 'px'); ch.style.setProperty('--cy', ch.offsetTop + 'px'); }); } });   // --cx/--cy: each letter's place, for the glow (C-g)
  if (c.style === 'type') { c.caret = document.createElement('i'); c.caret.className = 'caret'; c.caret.setAttribute('aria-hidden', 'true'); el.appendChild(c.caret); }
  // a statement Kay emptied in the Studio has no letters: reveal and hide have nothing to do
  const caretAt = (ch) => { const k = c.caret; if (!k) return; k.style.left = (ch.offsetLeft + ch.offsetWidth).toFixed(1) + 'px'; k.style.top = ch.offsetTop.toFixed(1) + 'px'; k.style.height = ch.offsetHeight.toFixed(1) + 'px'; };
  c.reveal = () => { if (c.shown || !c.chars?.length) return; c.shown = true; c.tl?.kill(); gsap.killTweensOf(c.chars); const ch = c.chars;
    if (c.style === 'stamp') { gsap.set(ch, { yPercent: -60, rotate: (i) => ((i * 37) % 15) - 7, opacity: 0 });
      c.tl = gsap.timeline().to(ch, { opacity: 1, duration: 0.12, stagger: 0.024 }, 0).to(ch, { yPercent: 0, rotate: 0, duration: 0.55, ease: 'back.out(2.6)', stagger: 0.024 }, 0); }
    else if (c.style === 'neon') { el.classList.add('lit'); c.tl = gsap.timeline().to(ch, { keyframes: { opacity: [0, 1, 0.12, 0.85, 0.2, 1], easeEach: 'none' }, duration: 0.6, stagger: { each: 0.02, from: 'random' } }); }
    else if (c.style === 'type') { c.caret.classList.add('on'); caretAt(ch[0]); c.tl = gsap.timeline(); ch.forEach((x, i) => { c.tl.set(x, { opacity: 1 }, i * 0.034).call(caretAt, [x], i * 0.034); }); }
    else c.tl = gsap.to(ch, { opacity: 1, duration: 0.5, stagger: 0.014, ease: 'power2.out' }); };
  c.hide = () => { if (!c.shown || !c.chars?.length) return; c.shown = false; c.tl?.kill(); el.classList.remove('lit'); c.caret?.classList.remove('on');
    gsap.to(c.chars, { opacity: 0, duration: 0.3, overwrite: true, onComplete: () => { if (!c.shown) gsap.set(c.chars, { yPercent: 0, rotate: 0 }); } }); }; chars.push(c); });
document.fonts.ready.then(() => chars.forEach(placeChars));
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
// the panel is a window the reader can stretch (Kay, 2026-10-05): its right edge is a grip — drag it, or ← → / Home / End with it focused,
// double-click = the whole screen and back — from a third of the screen to all of it. The width is kept between visits (kooky.panelW; never in the Studio's preview).
const panelGrip = $('panel-grip'); const PW = { min: 0.34, drag: false, t: 0 };
const panelFrac = () => panel.offsetWidth / vw;
function setPanelW(f) {                                          // f: a fraction of the window; 0 = the stylesheet's own width
  if (f) { f = clamp(f, Math.max(PW.min, 420 / vw), 1); if (f > 0.965) f = 1; document.documentElement.style.setProperty('--panel-w', (f * 100).toFixed(2) + 'vw'); }
  else document.documentElement.style.removeProperty('--panel-w');
  panelGrip.setAttribute('aria-valuenow', Math.round(panelFrac() * 100)); if (panelOpen) navOnPaper(); }
function savePanelW() { if (STUDIO) return; try { const v = document.documentElement.style.getPropertyValue('--panel-w'); v ? localStorage.setItem('kooky.panelW', v) : localStorage.removeItem('kooky.panelW'); } catch {} }
try { const v = STUDIO ? '' : localStorage.getItem('kooky.panelW'); if (/^\d+(\.\d+)?vw$/.test(v || '')) setPanelW(parseFloat(v) / 100); } catch {}
panelGrip.addEventListener('pointerdown', (e) => { if (e.button) return; e.preventDefault(); panelGrip.setPointerCapture(e.pointerId); PW.drag = true; panelGrip.classList.add('drag'); document.body.classList.add('resizing'); });
panelGrip.addEventListener('pointermove', (e) => { if (PW.drag) setPanelW(e.clientX / vw); });
function gripEnd() { if (!PW.drag) return; PW.drag = false; panelGrip.classList.remove('drag'); document.body.classList.remove('resizing'); savePanelW(); }
panelGrip.addEventListener('pointerup', gripEnd); panelGrip.addEventListener('pointercancel', gripEnd); panelGrip.addEventListener('lostpointercapture', gripEnd);
panelGrip.addEventListener('dblclick', () => { setPanelW(panelFrac() > 0.98 ? 0 : 1); savePanelW(); });
panelGrip.addEventListener('keydown', (e) => { const d = { ArrowRight: 0.05, ArrowLeft: -0.05, Home: -2, End: 2 }[e.key]; if (!d) return; e.preventDefault(); setPanelW(panelFrac() + d); savePanelW(); });
document.querySelectorAll('.nav a[data-to]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); REW.autoUntil = performance.now() / 1000 + 1.9; lenis.scrollTo('#' + a.dataset.to, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) }); }));

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
for (const l of [key, hemi, camLight]) l.layers.enable(1);                    // layer 1 = the tiger alone (the opening's pass over the paper)
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
const rig = new Rig(); scene.add(rig.root); rig.root.traverse((o) => o.layers.enable(1));
const tigerHit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 1.5), new THREE.MeshBasicMaterial({ visible: false })); scene.add(tigerHit);

// ── standing paw targets (hips frame) and the climb bands (Laurens: clips scrubbed by scroll; feet on alternate rungs)
const STAND = [[0.46, PAWY, -0.22], [0.46, PAWY, 0.22], [-0.42, PAWY, -0.2], [-0.42, PAWY, 0.2]].map((a) => new THREE.Vector3(...a));
const WALL = -0.36;                                                                     // paw centre on the rung, in the hips frame (belly = −y)
const CLIMB = [ { ph: 0.25, lo: 0.67, planted: 0.6, z: -0.22 }, { ph: 0.75, lo: 0.67, planted: 0.6, z: 0.22 },        // hands (front paws)
                { ph: 0.5, lo: -0.98, planted: 0.78, z: -0.2 }, { ph: 0.0, lo: -0.98, planted: 0.78, z: 0.2 } ];       // feet
CLIMB.forEach((b) => { b.hi = b.lo + TIGER.step * b.planted; });
// layout tiers: phones get a narrower frame, so the camera shifts right, opens up, and the tiger hangs lower
const LAY = { mobile: false, camX: CAMERA.x, fov: CAMERA.fov, glue: TIGER.glue, H0: 0, RUNG0: 0, drift: 1 };
function tune() { LAY.mobile = matchMedia('(max-width: 820px), (orientation: portrait) and (max-width: 1024px)').matches;   // the CSS phone tier
  LAY.camX = LAY.mobile ? 1.15 : CAMERA.x; LAY.fov = LAY.mobile ? 40 : CAMERA.fov; LAY.glue = (LAY.mobile ? 1.55 : TIGER.glue) + (TIGER.glb && GT.ready ? (LAY.mobile ? TIGER.glb.liftMobile : TIGER.glb.lift) : 0); LAY.drift = LAY.mobile ? 0.5 : 1;
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
const world = { objs: [], ledges: [], groundY: 0, landS: 0, camYMin: 0, floors: [], hold: { s0: 0, len: 0 }, deck: null, lamps: [] };
const LAMP_ST = new Map(), lampState = (k) => { if (!LAMP_ST.has(k)) LAMP_ST.set(k, { on: false, t: 0, k: 0 }); return LAMP_ST.get(k); };   // a lamp's on/off survives a rebuild
// the rail: screens → camera y, linear (clamped at the landing) — except the hold in front of the computer's screen, where the
// camera keeps still for (projects − 1) screens while the previews slide (Léo's camera also holds under his long papers)
const camYAt = (s) => -RATE * (s - clamp(s - world.hold.s0, 0, world.hold.len));
// where the camera passes each floor slab: when the section title band is centred on the screen (the band is half a screen now; the
// slab going by around it is the floor change, seen like an elevator shot — Kay, 2026-09-27)
const crossS = (i) => (R.titles[i].top + R.titles[i].h / 2) / vh - 0.5;
// the room's skin, blended across each slab as the camera passes it (scroll-driven, so the colour change is continuous)
const SKINS = ['stone', ...SECTIONS.map((x) => x.theme)], THB = { bg: new THREE.Color(), keyColor: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), camColor: new THREE.Color(), fog: [0, 0] }, _ca = new THREE.Color(), _cb = new THREE.Color();
function themeAt(s) {
  let i = -1; for (let k = 0; k < SECTIONS.length; k++) if (s >= crossS(k) - 0.35) i = k;
  const A = THEMES[SKINS[Math.max(0, i)]], B = THEMES[SKINS[i + 1] || SKINS[0]], m = i < 0 ? 0 : smooth(seg(s, [crossS(i) - 0.35, crossS(i) + 0.35])), P = i < 0 ? A : B;
  // the new floor arrives dark and its light comes up with its lamps (B1: the elevator opens onto a dark room, then the lights click on)
  const dk = i < 0 ? 1 : lerp(LIGHTS.dark, 1, smooth(seg(s, [crossS(i) + LIGHTS.on[0], crossS(i) + LIGHTS.on[1] + 0.15])));
  const mix = (k, out, f = 1) => out.copy(_ca.set(A[k])).lerp(_cb.set(P[k]).multiplyScalar(f), m);
  mix('bg', THB.bg, lerp(0.4, 1, (dk - LIGHTS.dark) / (1 - LIGHTS.dark))); mix('keyColor', THB.keyColor); mix('hemiSky', THB.hemiSky); mix('hemiGround', THB.hemiGround); mix('camColor', THB.camColor);
  THB.key = lerp(A.key, P.key * dk, m); THB.hemi = lerp(A.hemi, P.hemi * dk, m); THB.camLight = lerp(A.camLight, P.camLight * dk, m); THB.fog[0] = lerp(A.fog[0], P.fog[0], m); THB.fog[1] = lerp(A.fog[1], P.fog[1], m);
  THB.ink = m < 0.5 ? A.ink : P.ink; return THB;
}
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
      const bulbY = y + 1.5, cord = Math.max(0.1, Math.min(1.2, yT - 0.05 - bulbY)); cyl(0.01, 0.01, cord, dark, -3.2, bulbY + cord / 2, -1.6, g, 4); glow(0xffe0a8, 0.13, -3.2, bulbY, -1.6, g); lamp(0xffd9a0, 4, -3.2, bulbY - 0.15, -1.4, g, 7);
      // the middle of the room (in view since the pier slimmed, 2026-10-01): a wall shelf of tins and tape, and a second bulb
      bx(1.7, 0.05, 0.34, wood, -0.55, y - 0.35, -2.6, g); for (let i = 0; i < 4; i++) cyl(0.11, 0.11, 0.26 + (i % 2) * 0.08, mat({ color: [0x8a9aa6, 0xc0392b, 0x3e6d8e, 0xd8b45c][i], roughness: 0.5, metalness: 0.3 }), -1.2 + i * 0.36, y - 0.18 + (i % 2) * 0.04, -2.6, g, 12);
      cyl(0.09, 0.09, 0.06, steel, -0.05, y - 0.1, -2.6, g, 14);
      const b2 = y + 0.9, c2 = Math.max(0.1, Math.min(1.4, yT - 0.05 - b2)); cyl(0.01, 0.01, c2, dark, -0.4, b2 + c2 / 2, -1.9, g, 4); glow(0xffe0a8, 0.11, -0.4, b2, -1.9, g); lamp(0xffd9a0, 3, -0.4, b2 - 0.15, -1.7, g, 6); }
    for (let i = 0; i < 3; i++) { const sh = bx(1.1, 1.9, 0.04, mat({ color: [0xc9a878, 0xb8956a, 0xd2b48a][i], roughness: 0.9 }), 0.05 + i * 0.08, floor + 0.93, -2.45 + i * 0.07, g); sh.rotation.x = -0.12; }   // ply sheets leaning by the pier
    bx(4.4, 0.16, 1.3, wood, -4.2, floor + 0.9, -1.7, g); for (const dx of [-2, 2]) for (const dz of [-0.5, 0.5]) bx(0.12, 0.9, 0.12, dark, -4.2 + dx, floor + 0.45, -1.7 + dz, g);   // workbench
    bx(0.5, 0.35, 0.4, steel, -5.6, floor + 1.16, -1.7, g); bx(0.7, 0.3, 0.32, red, -3.2, floor + 1.13, -1.8, g);                                                                    // vise + toolbox
    cyl(0.16, 0.16, 0.8, red, -7.2, floor + 0.4, -2.2, g, 12); cyl(0.05, 0.05, 0.16, dark, -7.2, floor + 0.88, -2.2, g, 8);                                                        // extinguisher
    for (let i = 0; i < 3; i++) bx(0.9, 0.6, 0.7, mat({ color: 0xb9925f }), -6.6 + (i % 2) * 0.2, floor + 0.3 + i * 0.6, -1.6, g); },
  bar(g, yT, yB) { const R = rnd(yT); const floor = yB + 0.15; const dark = mat({ color: 0x1b1520, roughness: 0.7 }), wood = mat({ color: 0x3a2418, roughness: 0.55 }), brass = mat({ color: 0xb58a3c, roughness: 0.35, metalness: 0.7 });
    const cols = [0x7ac8b0, 0xf2a93b, 0xd94f8a, 0x8fb3ff, 0xf6f1e6, 0x5ec8e8];
    for (let y = yT - 1.6; y > floor + 1.9; y -= 1.05) {                                                                                 // back-bar shelves, lit from below
      bx(5.2, 0.06, 0.5, wood, -4.2, y, -2.5, g); const strip = bx(5.0, 0.03, 0.08, new THREE.MeshStandardMaterial({ color: 0xff7fc2, emissive: 0xff5fb0, emissiveIntensity: 1.6 }), -4.2, y - 0.05, -2.3, g, false); lamp(0xff6fb5, 2.2, -4.2, y - 0.2, -2.2, g, 5);
      for (let i = 0; i < 9; i++) { const h = 0.35 + R() * 0.35, r = 0.06 + R() * 0.04; const c = cols[Math.floor(R() * cols.length)]; cyl(r, r, h, new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, transparent: true, opacity: 0.85 }), -6.5 + i * 0.56 + R() * 0.1, y + 0.03 + h / 2, -2.5, g, 10); }
      // the back bar runs on toward the pier (in view since it slimmed, 2026-10-01): shorter shelves, every other row, lit cyan
      if (Math.round((yT - y) / 1.05) % 2 === 0) { bx(1.9, 0.06, 0.44, wood, -0.45, y - 0.2, -2.55, g); bx(1.8, 0.03, 0.07, new THREE.MeshStandardMaterial({ color: 0x8ff0ff, emissive: 0x4fd8f0, emissiveIntensity: 1.4 }), -0.45, y - 0.25, -2.36, g, false); lamp(0x4fd8f0, 1.4, -0.45, y - 0.4, -2.2, g, 4);
        for (let i = 0; i < 4; i++) { const h = 0.32 + R() * 0.3, r = 0.06 + R() * 0.03; cyl(r, r, h, new THREE.MeshStandardMaterial({ color: cols[Math.floor(R() * cols.length)], roughness: 0.2, transparent: true, opacity: 0.85 }), -1.2 + i * 0.5 + R() * 0.08, y - 0.17 + h / 2, -2.55, g, 10); } } }
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
  world.glass = new THREE.MeshBasicMaterial({ color: 0x0D0E10 }); mon.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), world.glass));   // dark until the CRT powers on (frame)
  bx(w + 2 * b, b, 0.16, beige, 0, h / 2 + b / 2, -0.03, mon); bx(w + 2 * b, b * 1.7, 0.16, beige, 0, -h / 2 - b * 0.85, -0.03, mon);
  bx(b, h, 0.16, beige, -w / 2 - b / 2, 0, -0.03, mon); bx(b, h, 0.16, beige, w / 2 + b / 2, 0, -0.03, mon);
  bx(w + 2 * b + 0.14, h + b * 2.7 + 0.14, dep, beige2, 0, -b * 0.35, -0.11 - dep / 2, mon);
  glow(0x7CFF9A, 0.022, w / 2 - 0.1, -h / 2 - b * 0.85, 0.06, mon);
  for (let i = 0; i < 7; i++) bx(0.06, 0.014, 0.02, dark, -w / 2 + 0.14 + i * 0.1, -h / 2 - b * 0.55, 0.06, mon);
  bx(0.5, 0.05, 0.02, dark, 0, -h / 2 - b * 1.1, 0.06, mon);
  lamp(0xDCE6F5, 5, 0, 0, 1.3, mon, 11);                                                                                   // the screen lights the room (and the tiger)
  // the desk (level, in front of the pier): top just under the monitor's foot, on two thin back legs down to the grass (the frame stays
  // open under it, so the meadow reads at the landing)
  const cP = Math.cos(P), sP = Math.sin(P); const botY = D.mid.y - (h / 2 + b * 1.7) * cP - 0.06;
  const deskY = botY - 0.36, zC = D.mid.z + 0.55, x0 = -9.5, x1 = X - 0.6;
  bx(0.9, 0.34, 0.8, beige2, D.mid.x, botY - 0.19, D.mid.z - 0.1, g);                                                        // the foot
  bx(x1 - x0, 0.14, 2.6, wood, (x0 + x1) / 2, deskY - 0.07, zC, g); bx(x1 - x0, 0.06, 2.5, mat({ color: 0x6B5236 }), (x0 + x1) / 2, deskY - 0.17, zC, g, false);
  // one back leg, far left and out of the meadow shot; the desk's right end rests against the pier. At the landing the camera looks under
  // the desk, and any leg near the ladder stood between it and the tiger (or in the talent show's way)
  const legH = Math.max(0.2, deskY - 0.14 - G); for (const px of [x0 + 0.5]) cyl(0.07, 0.09, legH, mat({ color: 0x5A4632, roughness: 0.8 }), px, deskY - 0.14 - legH / 2, zC - 1.15, g, 8);
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
};
function buildWorld() {
  world.objs.forEach((o) => scene.remove(o)); world.objs = []; world.ledges = []; world.floors = []; world.lamps = []; window.__world = world; window.__scene = scene;
  const X = TIGER.x, L = TIGER.ledgeY;
  // the landing: just after the meadow window arrives; the camera then settles a little lower so the grass and the whole tiger are in frame
  world.landS = R.meadow.top / vh + LAND_AT; world.camYMin = camYAt(world.landS) - (GT.ready ? (LAY.mobile ? GB.settleMobile : GB.settle) : 0);
  const landedTop = world.camYMin + (CAMERA.z + 2.8) * Math.tan(CAMERA.pitch + LAY.fov * Math.PI / 360);   // the landed frame's top edge on the back wall
  // the grass is just under the tiger's feet on its last rung: at the landing it only has to put its feet down, stand (hips at the mount
  // clip's first pose) and turn — and it stays in the lower right of the clamped frame, like the rig did
  const rigMode = !GT.ready, LM = ladderMetrics(); world.groundY = hipsGlued(world.landS) - (rigMode ? 1.05 : LM.mountStart + 0.03);   // the rig keeps its own numbers
  const G = world.groundY; deckFrame();
  // pier: the tiger's tower on the right, platform on top, ladder down its face (it runs through every floor)
  const pier = new THREE.Group(); scene.add(pier); world.objs.push(pier);
  const pierTex = themeTex('stone', 'wall'); const pierMat = new THREE.MeshStandardMaterial({ map: pierTex, roughness: 0.95 });
  // slim on the left (TIGER.pier): just wide enough behind the ladder and the tiger, so each room gets most of the screen; its right side runs off the frame
  const pl = X - TIGER.pier, pr = X + 4.5, pw = pr - pl, pH = L - (G - 2); pierTex.repeat.set(2.4 * pw / 6, pH / 2.6);
  const sideTex = pierTex.clone(); sideTex.needsUpdate = true; sideTex.repeat.set(2.4 * 2.5 / 6, pH / 2.6); const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.95 });   // its left face, now in view: bricks at the front's scale
  const block = new THREE.Mesh(new THREE.BoxGeometry(pw, pH, 2.5), [sideMat, sideMat, pierMat, pierMat, pierMat, pierMat]); block.position.set((pl + pr) / 2, (L + G - 2) / 2, -1.35); block.castShadow = true; block.receiveShadow = true; pier.add(block);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.2, 0.18, 2.7), slabTop); lip.position.set((pl + pr) / 2, L - 0.09, -1.35); lip.receiveShadow = true; lip.castShadow = true; pier.add(lip);
  // the ladder is sized by the tiger's climb clip: rails where its hands slide, rungs half a climb cycle apart (its feet step two rungs at a
  // time, alternating), one rung under the left toe when the climb begins — so every planted foot is on a rung
  // the GLB's ladder only pokes up a hand's height past the platform, so the standing tiger is not behind it
  const railTop = L + (rigMode ? 1.25 : 0.45), railH = railTop - (G + 0.05), railX = rigMode ? 0.5 : LM.rail + 0.03, RUNG = rigMode ? TIGER.rung : LM.rung; if (!rigMode) LAY.RUNG0 = hipsGlued(TIGER.edgeEnd) + LM.relToe;
  for (const sx of [-railX, railX]) { const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, railH, 8), woodMat); rail.position.set(X + sx, (railTop + G + 0.05) / 2, TIGER.ladderZ); rail.castShadow = true; pier.add(rail);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.4), woodMat); bar.position.set(X + sx, L + (rigMode ? 1.0 : 0.3), TIGER.ladderZ - 0.16); pier.add(bar); }
  const rungGeo = new THREE.CylinderGeometry(0.024, 0.024, 2 * railX, 8); rungGeo.rotateZ(HALF);
  const topRung = LAY.RUNG0 + RUNG * Math.floor((railTop - 0.15 - LAY.RUNG0) / RUNG);
  const nR = Math.floor((topRung - (G + 0.1)) / RUNG) + 1; const rungs = new THREE.InstancedMesh(rungGeo, rungMat, nR); rungs.castShadow = true;
  { const mm = new THREE.Matrix4(); for (let j = 0; j < nR; j++) { mm.makeTranslation(X, topRung - j * RUNG, TIGER.ladderZ); rungs.setMatrixAt(j, mm); } }
  pier.add(rungs);
  // floors: the rooms are stacked; the camera passes each slab when that section's title band is centred (crossS), in view, like an elevator
  const bounds = [L + 14]; const skins = ['stone'];
  SECTIONS.forEach((sec, i) => { bounds.push(camYAt(crossS(i))); skins.push(sec.theme); }); bounds.push(G - 2);
  world.floors = bounds.slice(1, -1);
  for (let i = 0; i < skins.length; i++) { const name = skins[i], yTop = bounds[i], yBot = bounds[i + 1], Hh = yTop - yBot; const th = THEMES[name];
    const g = new THREE.Group(); scene.add(g); world.objs.push(g);
    const wt = themeTex(name, 'wall').clone(); wt.needsUpdate = true; wt.repeat.set(10, Hh / 4); const back = new THREE.Mesh(new THREE.PlaneGeometry(40, Hh), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95 })); back.position.set(0, (yTop + yBot) / 2, -2.8); back.receiveShadow = true; g.add(back);
    const st = themeTex(name, 'side').clone(); st.needsUpdate = true; st.repeat.set(3, Hh / 4); const side = new THREE.Mesh(new THREE.PlaneGeometry(12, Hh), new THREE.MeshStandardMaterial({ map: st, roughness: 0.95 })); side.position.set(-11, (yTop + yBot) / 2, 3.2); side.rotation.y = HALF; side.receiveShadow = true; g.add(side);
    if (i > 0) { const yS = yTop; const slabM = new THREE.MeshStandardMaterial({ color: th.ink === 'light' ? 0x2a2622 : 0xb8b2a4, roughness: 0.95 });   // the slab above this room (its ceiling), with a hatch for the ladder
      for (const [x0, x1] of [[-16, Math.max(X - 1.2, X - TIGER.pier)], [X + 1.2, 16]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.3, 5.3), slabM); m.position.set((x0 + x1) / 2, yS, -0.15); m.receiveShadow = true; m.castShadow = true; g.add(m); }
}   // (no rim board at the hatch: now that the slab is seen, it cut across the tiger climbing through)
    const yProps = i === skins.length - 1 && name !== 'computer' ? Math.min(yTop - 3, Math.max(yBot, landedTop + 0.3)) : yBot;   // the meadow is tuned for the computer room
    PROPS[name] && PROPS[name](g, yTop - (i > 0 ? 0.15 : 0), yProps + (i < skins.length - 1 ? 0.15 : 0));
    // the room's lamps and glowing things, for the lights coming on as you arrive (B1): each keeps its own base, position and turn in the order
    if (i > 0) { const seen = new Set(); let n = 0; g.updateMatrixWorld(true);
      g.traverse((o) => { const isLamp = o.isPointLight, m = o.isMesh && o.material && o.material.emissive && o.material.emissive.getHex() !== 0 && o.material.emissiveIntensity > 0 ? o.material : null;
        if (!isLamp && (!m || seen.has(m))) return; if (m) seen.add(m);
        const p = o.getWorldPosition(new THREE.Vector3()); n++;
        world.lamps.push({ floor: i - 1, light: isLamp ? o : null, mat: m, base: isLamp ? o.intensity : m.emissiveIntensity, p, r: frac(Math.sin(n * 12.9898 + i * 78.233) * 43758.5453), kind: name, st: lampState(`${i}:${n}`) }); }); } }
  // ledges with lamps on the left wall, one per card, at the tiger's feet when that card is centred
  // the card's centre (on phones the card is laid out from its top, so add half its height): the object's middle-of-the-screen moment
  document.querySelectorAll('.card').forEach((el) => { const r = el.getBoundingClientRect(); const top = r.top + window.scrollY + (LAY.mobile ? r.height / 2 : 0); const sC = (top - vh / 2) / vh; const y = hipsGlued(sC) - 0.9; el.dataset.s = sC;
    const th = THEMES[el.closest('.window').dataset.theme] || THEMES.stone;
    const g = new THREE.Group(); scene.add(g); world.objs.push(g);
    const w = LEDGE_X[1] - LEDGE_X[0], cx = (LEDGE_X[0] + LEDGE_X[1]) / 2;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 2.2), slabMat); slab.position.set(cx, y - 0.25, -1.7); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.05, 2.1), slabTop); t2.position.set(cx, y + 0.02, -1.7); t2.receiveShadow = true; g.add(t2);
    const tx = LEDGE_X[1] - 0.7;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.3, 6), postMat); post.position.set(tx, y + 0.65, -2.2); post.castShadow = true; g.add(post);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: th.torch, emissive: th.torch, emissiveIntensity: 1.2, roughness: 1 })); flame.position.set(tx, y + 1.36, -2.2); g.add(flame);
    const light = new THREE.PointLight(th.torch, th.torchI, LIGHT.torch.distance, 2); light.position.set(tx, y + 1.5, -1.6); g.add(light);
    if (y - 0.5 < landedTop) g.userData.hidden = true;             // the last project's ledge would stand in the landed meadow when no computer floor comes between
    world.ledges.push({ s: sC, el, seed: Math.random() * 10, flame, light, base: th.torchI, glanced: false, floor: +el.closest('.window').id.slice(3), p: flame.getWorldPosition(new THREE.Vector3()), r: frac(Math.sin(sC * 91.7) * 4375.85), st: lampState('torch:' + el.dataset.p), ann: el.classList.contains('on') }); });
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
  for (let i = 0; i < gN; i++) { let x = (Math.random() - 0.5) * 30, z = 11 - Math.random() * 24; if (x > X - 1.6 && z < -0.1) x -= 6; if (x > X - 2.9 && x < X + 0.8 && z > -0.1 && z < 2.8) x -= 4.4; e.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4); q.setFromEuler(e); p.set(x, G + 0.16, z); sc.set(1, 0.6 + Math.random() * 0.9, 1); mm.compose(p, q, sc); grass.setMatrixAt(i, mm); }
  grass.castShadow = true; shore.add(grass);
  { const base = new Float32Array(grass.instanceMatrix.array), px = new Float32Array(gN), pz = new Float32Array(gN), m4 = new THREE.Matrix4(); for (let i = 0; i < gN; i++) { grass.getMatrixAt(i, m4); px[i] = m4.elements[12]; pz[i] = m4.elements[14]; }
    world.grass = { mesh: grass, n: gN, base, px, pz, tilt: new Float32Array(gN), ax: new Float32Array(gN), az: new Float32Array(gN), y0: G - 0.05 }; }   // C-d: the blades bend away from the cursor
  world.flowers = [];
  const petalCols = [0xf6c1cf, 0xffe28a, 0xffffff, 0xf2a93b, 0xc7b8ff];
  for (let i = 0; i < 60; i++) { let x = (Math.random() - 0.5) * 26, z = 10 - Math.random() * 20; if (x > X - 1.6 && z < -0.1) x -= 6; if (x > X - 2.9 && x < X + 0.8 && z > -0.1 && z < 2.8) x -= 4.4; const f = new THREE.Group(); f.position.set(x, G, z); shore.add(f);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4), new THREE.MeshStandardMaterial({ color: 0x5fa04a })); stem.position.set(0, 0.22, 0); f.add(stem);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: petalCols[i % petalCols.length], roughness: 0.8 })); hd.position.set(0, 0.46, 0); f.add(hd); world.flowers.push({ g: f, x, z, tilt: 0, ax: 0, az: 0 }); }
  for (const [x, z, s] of [[-7, -1.2, 1.2], [-11, 4, 1.5], [10, 6, 1.1], [-4, 8, 0.9]]) { const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.28 * s, 1.5 * s, 7), new THREE.MeshStandardMaterial({ color: 0x6a4d38 })); trunk.position.set(x, G + 0.75 * s, z); trunk.castShadow = true; shore.add(trunk); const crown = new THREE.Mesh(new THREE.SphereGeometry(1.3 * s, 12, 10), new THREE.MeshStandardMaterial({ color: 0x74b25a, roughness: 1 })); crown.position.set(x, G + 2.2 * s, z); crown.castShadow = true; shore.add(crown); }
}

// ───────────────────────── Layout ─────────────────────────
const R = {};
function measure() {
  vh = innerHeight; vw = innerWidth; if (lenis.resize) lenis.resize(); const sy = window.scrollY;
  for (const id of ['header', 'hero', 'intro', 'win0', 'archives', 'meadow', 'footer']) { const el = $(id); const r = el.getBoundingClientRect(); R[id] = { top: r.top + sy, h: r.height }; }
  R.windows = SECTIONS.map((_, w) => { const r = $('win' + w).getBoundingClientRect(); return { top: r.top + sy, h: r.height, theme: SECTIONS[w].theme }; });
  R.titles = SECTIONS.map((_, w) => { const r = $('title' + w).getBoundingClientRect(); return { top: r.top + sy, h: r.height }; });
  R.worlds = [{ top: R.intro.top, h: R.intro.h, theme: 'stone' }, ...R.windows, { top: R.meadow.top, h: R.meadow.h, theme: SECTIONS[SECTIONS.length - 1].theme }];
  // for the nav's and the lift's ink: the windows with their floor (over paper — the title blocks, hero, archives, footer — the ink is dark)
  R.inks = [{ top: R.intro.top, h: R.intro.h, theme: 'stone', fl: -1 }, ...R.windows.map((w, i) => ({ ...w, fl: i })), { top: R.meadow.top, h: R.meadow.h, theme: SECTIONS[SECTIONS.length - 1].theme, fl: -1 }];
  world.hold = deckIdx >= 0 ? { s0: R.windows[deckIdx].top / vh + DECK.entry, len: SECTIONS[deckIdx].pieces.length - 1 } : { s0: 0, len: 0 };
  texts.forEach((t) => { const r = t.el.getBoundingClientRect(); t.top = r.top + sy; t.h = r.height; });
  chars.forEach((c) => { const r = c.el.getBoundingClientRect(); c.top = r.top + sy; c.h = r.height; placeChars(c); });
  R.nav = [...document.querySelectorAll('.nav .brand, .nav .links, .nav .right')].map((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  T.gx = null;                                                    // the glow re-measures on the next frame
  tune(); renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.fov = LAY.fov; camera.updateProjectionMatrix();
  buildWorld();
}

// ───────────────────────── cursor / quip / loader ─────────────────────────
const cursor = $('cursor'), pill = $('cursor-pill'); let pillShown = false, pillText = '';
const mx = { x: -100, y: -100 };
// the dot sits on the pointer itself (moved by the event, not by the 3D frame, so it never lags — Kay, 2026-10-01)
cursor.classList.add('out');
window.addEventListener('pointermove', (e) => { mx.x = e.clientX; mx.y = e.clientY; mouse.x = (e.clientX / vw) * 2 - 1; mouse.y = (e.clientY / vh) * 2 - 1; mouse.seen = true;
  if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
  cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`; cursor.classList.remove('out'); });
window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') cursor.classList.add('press'); });
window.addEventListener('pointerup', () => cursor.classList.remove('press'));
document.addEventListener('mouseleave', () => cursor.classList.add('out')); document.addEventListener('mouseenter', () => cursor.classList.remove('out'));
function setPill(text) { if (text === pillText) return; pillText = text; if (text) { pill.textContent = text; if (!pillShown) { pillShown = true; gsap.to(pill, { '--reveal': 1, duration: MOTION.cursor.inDuration, ease: MOTION.cursor.inEase, overwrite: true }); } } else if (pillShown) { pillShown = false; gsap.to(pill, { '--reveal': 0, duration: MOTION.cursor.outDuration, ease: MOTION.cursor.outEase, overwrite: true }); } }
const quipEl = $('quip'); const v3 = new THREE.Vector3();
const T = { nod: 0, liftF: -2, fol: { y: 0, p: 0 }, rew: null, wmenu: false, peek: 0, menu: false, perf: null, hinted: false, deckOn: false, deckK: -1, landedCls: false, inWorld: false, navLight: false, blinkAt: 2.5, blink: false, earAt: 3, ear: 0, quipT: 0, quip: '', sit: 0, waveAt: 2.5, wave: 0, glance: { y: 0, p: 0 }, hover: { y: 0, p: 0 }, headY: 0, headP: 0, tailV: 0 };
function say(text, dur = 2.6, who = 'KOOKYTIGER') { T.quip = text; T.quipT = dur; quipEl.textContent = text; quipEl.dataset.who = who + '  '; }
function glance(yaw, pitch) { const g = TIGER.glance; gsap.killTweensOf(T.glance); gsap.timeline().to(T.glance, { y: yaw, p: pitch, duration: g.turn, ease: 'power2.out' }).to(T.glance, { y: 0, p: 0, duration: g.back, ease: 'power2.inOut' }, `+=${g.hold}`); }
const ray = new THREE.Raycaster(); let hoverTiger = false; const clickNdc = new THREE.Vector2();
// click the tiger: the paper and window sections sit over the canvas, so listen on the window and cast from the click itself
// (this also makes a tap work on phones, where there is no hover to rely on)
const pokeTiger = (e) => { if (ENTRY.phase !== 'done') { entryPoke(); return; } if (panelOpen || !T.inWorld) return;
  if (e.target?.closest?.('a, button, .card .in, .slide .in, .nav, .panel, #panel-scrim, #deck, #talents, #wardrobe')) return;
  clickNdc.set((e.clientX / vw) * 2 - 1, -((e.clientY / vh) * 2 - 1)); ray.setFromCamera(clickNdc, camera); if (!ray.intersectObject(tigerHit).length) { if (T.menu) talents(false); if (T.wmenu) wardrobe(false); return; }
  if (GT.ready && state === 'sit' && T.sit > 0.8) { talents(!T.menu); return; }                    // on the meadow: the talent show
  if (state === 'idle') T.wave = T.waveLen = 1.6; glance(1.9, 0.6); T.waveAt = 0; say(['kooky.', 'again?', 'which floor is this.', 'that tickles.'][Math.floor(Math.random() * 4)]); };
window.addEventListener('click', pokeTiger);
let booted = false;
(async () => {                                                // no loader any more: the opening (paper + the tiger) is the first screen
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  booted = true; measure(); if (ENTRY.phase === 'done') entryDone();
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

// ───────────────────────── The tiger GLB: Kay's Tripo model rigged in Mixamo, one clip per state ─────────────────────────
// assets/tiger/tiger.glb (merge/tools/tiger_anim.py): clips idle, turn, mount (Start Climbing Ladder), climb (Climbing Ladder), sit, wave.
// Every locomotion clip's time is a function of the scroll phase (Laurens: action.time = f(scroll)); idle, sit and wave run on time. Root
// motion is stripped where the site moves the tiger itself: the climb is glued to the camera, the mount keeps only its up-and-down. Until
// the GLB loads, and if it fails (or with ?rig), the procedural Rig above plays.
const GB = TIGER.glb, HS = GB.height, UP = new THREE.Vector3(0, 1, 0);
const GT = { ready: false, failed: false, root: new THREE.Group(), model: null, mixer: null, act: {}, dur: {}, bone: {}, hipsRest: 0, climb: null, mount: null, turnYaw0: 0 };
const gv = [V(), V(), V(), V()], gq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
function ladderMetrics() {                                   // world units: sampled from the GLB once it is in, Blender-measured fractions before
  const C = GT.climb, F = GB.fallback;
  return C ? { rise: C.rise, rung: C.rise / 2, rail: C.rail, depth: C.depth, relToe: C.relToe, hipsRest: GT.hipsRest, mountStart: GT.mount.h0, mountEnd: GT.mount.hEnd }
           : { rise: F.rise * HS, rung: F.rise * HS / 2, rail: F.rail * HS, depth: F.depth * HS, relToe: F.relToe * HS, hipsRest: F.hipsRest * HS, mountStart: F.mountStart * HS, mountEnd: F.mountEnd * HS };
}
function loadTiger() { return new Promise((res) => {
  if (!GB || PARAMS.has('rig')) { GT.failed = true; return res(false); }
  new GLTFLoader().load(GB.url, (g) => { try { setupTiger(g); res(true); } catch (e) { console.error('tiger.glb setup failed, keeping the procedural tiger', e); GT.failed = true; GT.ready = false; GT.root.visible = false; rig.root.visible = true; res(false); } },
    undefined, (e) => { console.warn('tiger.glb did not load, keeping the procedural tiger', e); GT.failed = true; res(false); }); }); }
function setupTiger(gltf) {
  const model = gltf.scene; GT.model = model; GT.root.add(model); scene.add(GT.root); GT.root.visible = false;
  let skin = null;
  model.traverse((o) => { if (o.isSkinnedMesh) skin = o; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.roughness = 0.85; o.material.metalness = 0; o.material.side = THREE.FrontSide; } } });
  for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftUpLeg', 'RightUpLeg', 'LeftToeBase', 'RightToeBase', 'LeftHand', 'RightHand']) { GT.bone[n] = model.getObjectByName('mixamorig' + n); if (!GT.bone[n]) throw new Error('missing bone ' + n); }
  // size: the bind pose's height → HS; feet on y = 0, hips over the origin
  const bbox = () => { model.updateMatrixWorld(true); skin.computeBoundingBox(); return skin.boundingBox.clone().applyMatrix4(skin.matrixWorld); };
  let bb = bbox(); model.scale.multiplyScalar(HS / (bb.max.y - bb.min.y)); bb = bbox();
  GT.bone.Hips.getWorldPosition(gv[0]); model.position.set(-gv[0].x, -bb.min.y, -gv[0].z); model.updateMatrixWorld(true);
  GT.hipsRest = GT.bone.Hips.getWorldPosition(gv[0]).y;
  GT.bind = { model: model.matrixWorld.clone(), inv: {} }; for (const n in GT.bone) GT.bind.inv[n] = GT.bone[n].matrixWorld.clone().invert();   // the bind pose, for the wardrobe (wearItem)
  const hipsRestLocal = GT.bone.Hips.position.clone(); GT.bone.Hips.parent.getWorldQuaternion(gq[0]); const upL = UP.clone().applyQuaternion(gq[0].invert()).normalize();
  const clips = {}; for (const c of gltf.animations) clips[c.name] = c;
  for (const n of ['idle', 'turn', 'mount', 'climb', 'sit', 'wave']) if (!clips[n]) throw new Error('missing clip ' + n);
  const mixer = new THREE.AnimationMixer(model); GT.mixer = mixer; const acts = {};
  const poseAt = (clip, time) => { const a = acts[clip.name] || (acts[clip.name] = mixer.clipAction(clip)); a.play();
    for (const k in acts) { acts[k].enabled = acts[k] === a; acts[k].setEffectiveWeight(acts[k] === a ? 1 : 0); } a.time = time; mixer.update(0); model.updateMatrixWorld(true); };
  const wp = (n, out) => GT.bone[n].getWorldPosition(out);
  const facing = () => { wp('RightUpLeg', gv[0]); wp('LeftUpLeg', gv[1]); gv[2].crossVectors(UP, gv[0].sub(gv[1])); return Math.atan2(gv[2].x, gv[2].z); };   // 0 = facing the camera (+z)
  const strip = (clip, keepVertical) => { const tr = clip.tracks.find((t) => t.name === GT.bone.Hips.name + '.position'); if (!tr) return; const v = tr.values;
    for (let i = 0; i < v.length; i += 3) { gv[0].set(v[i], v[i + 1], v[i + 2]).sub(hipsRestLocal); const k = keepVertical ? gv[0].dot(upL) : 0; gv[1].copy(hipsRestLocal).addScaledVector(upL, k); v[i] = gv[1].x; v[i + 1] = gv[1].y; v[i + 2] = gv[1].z; } };
  // climb (with its root motion): how far one cycle rises, when the left foot is planted, where the hands and feet are
  { const c = clips.climb, N = 60, hy = [], hx = [], hz = [], tl = [], tr = [], tz = [], hl = [], hr = [];
    for (let i = 0; i <= N; i++) { poseAt(c, c.duration * i / N); wp('Hips', gv[0]); hy.push(gv[0].y); hx.push(gv[0].x); hz.push(gv[0].z);
      wp('LeftToeBase', gv[1]); tl.push(gv[1].y); tz.push(gv[1].z); wp('RightToeBase', gv[2]); tr.push(gv[2].y); wp('LeftHand', gv[3]); hl.push(gv[3].x - gv[0].x); wp('RightHand', gv[3]); hr.push(gv[3].x - gv[0].x); }
    const rise = hy[N] - hy[0], m = []; for (let i = 0; i <= N; i++) m.push(Math.min(rise, Math.max(i ? m[i - 1] : 0, hy[i] - hy[0])));
    let best = [0, 0], run = 0; for (let i = 1; i <= N; i++) { run = Math.abs(tl[i] - tl[i - 1]) < 0.004 * HS ? run + 1 : 0; if (run > best[1]) best = [i - Math.floor(run / 2), run]; }
    const i0 = best[0]; let pr = 0, prn = 0; for (let i = 1; i <= N; i++) if (Math.abs(tr[i] - tr[i - 1]) < 0.004 * HS) { pr += tr[i] - (hy[i] - hy[i0]); prn++; }
    const tOf = (r) => { let i = 0; while (i < N - 1 && m[i + 1] < r) i++; const d = m[i + 1] - m[i]; return c.duration * (i + (d > 1e-6 ? clamp((r - m[i]) / d, 0, 1) : 0)) / N; };
    GT.climb = { rise, r0: m[i0], tOf, relToe: tl[i0] - hy[i0], rail: (hl.reduce((a, b) => a + Math.abs(b), 0) + hr.reduce((a, b) => a + Math.abs(b), 0)) / (2 * (N + 1)),
                 depth: hz.reduce((a, b, i) => a + (b - tz[i]), 0) / (N + 1), rightVsLeft: prn ? (pr / prn - tl[i0]) : null };
    strip(c, false); }
  strip(clips.mount, true); strip(clips.sit, true);          // the sit keeps its drop to the grass, not its drift sideways
  { const c = clips.mount, N = 60, h = [], f = []; for (let i = 0; i <= N; i++) { poseAt(c, c.duration * i / N); h.push(wp('Hips', gv[0]).y); f.push(facing()); }
    let ia = N; for (let i = 0; i <= N; i++) if (Math.abs(Math.atan2(Math.sin(f[i] - Math.PI), Math.cos(f[i] - Math.PI))) < 0.3) { ia = i; break; }
    const H = (t) => { const x = clamp(t / c.duration, 0, 1) * N, i = Math.min(N - 1, Math.floor(x)); return lerp(h[i], h[i + 1], x - i); };
    GT.mount = { h: H, ta: c.duration * ia / N, hEnd: h[N], h0: h[0] }; }
  poseAt(clips.turn, 0); GT.turnYaw0 = facing();
  const RARM = /^mixamorigRight(Shoulder|Arm|ForeArm|Hand)/;
  const sub = (clip, name, keep) => new THREE.AnimationClip(name, clip.duration, clip.tracks.filter((t) => keep(t.name.split('.')[0])));
  // the right arm is its own layer on the idle and the sit, so the wave can take it over while the body keeps the base clip
  const use = { idleBody: sub(clips.idle, 'idleBody', (n) => !RARM.test(n)), idleArm: sub(clips.idle, 'idleArm', (n) => RARM.test(n)), turn: clips.turn, mount: clips.mount, climb: clips.climb,
                sitBody: sub(clips.sit, 'sitBody', (n) => !RARM.test(n)), sitArm: sub(clips.sit, 'sitArm', (n) => RARM.test(n)), waveArm: sub(clips.wave, 'waveArm', (n) => RARM.test(n)) };
  for (const n of ['dance', 'zidle', 'zscream', 'zattack', 'catwalk', 'thumbs']) if (clips[n]) use[n] = clips[n];      // the meadow's talent show
  // the visitor's reward (G3): head-only layers over the climb — the climb keeps the body, a nod or a look-away takes the neck and head
  const HEADB = /^mixamorig(Neck|Head)/;
  if (clips.nod && clips.lookaway) Object.assign(use, { climbBody: sub(clips.climb, 'climbBody', (n) => !HEADB.test(n)), climbHead: sub(clips.climb, 'climbHead', (n) => HEADB.test(n)), nodHead: sub(clips.nod, 'nodHead', (n) => HEADB.test(n)), lookHead: sub(clips.lookaway, 'lookHead', (n) => HEADB.test(n)) });
  if (clips.catwalk) {                                       // the catwalk's hips path on the ground (model frame, yaw 0), for planWalk()
    const c = clips.catwalk, N = 30; GT.walkPath = []; poseAt(c, 0); const a = wp('Hips', gv[0]).clone();
    for (let i = 0; i <= N; i++) { poseAt(c, c.duration * i / N); wp('Hips', gv[1]); GT.walkPath.push([gv[1].x - a.x, gv[1].z - a.z]); } }
  for (const n in use) { const a = acts[use[n].name] || mixer.clipAction(use[n]); a.play(); a.setEffectiveWeight(0); GT.act[n] = a; GT.dur[n] = use[n].duration; }
  GT.look = ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head'].map((n) => [GT.bone[n], new THREE.Quaternion()]); GT.lookSaved = false;
  model.traverse((o) => o.layers.enable(1));
  GT.ready = true; rig.root.visible = false; GT.root.visible = true; progUI(); applyWear();
  window.__tiger = { hipsRest: GT.hipsRest, climb: { rise: GT.climb.rise, rung: GT.climb.rise / 2, relToe: GT.climb.relToe, rail: GT.climb.rail, depth: GT.climb.depth, rightVsLeft: GT.climb.rightVsLeft }, mount: { ta: GT.mount.ta, h0: GT.mount.h0, hEnd: GT.mount.hEnd }, turnYaw0: GT.turnYaw0, dur: GT.dur, walkPath: GT.walkPath };
  if (R.win0) measure();                                     // rebuild the ladder and the ground from the GLB's own numbers
}
const climbTime = (s) => { const C = GT.climb, D = hipsGlued(TIGER.edgeEnd) - hipsGlued(s); return C.tOf((((C.r0 - D) % C.rise) + C.rise) % C.rise); };   // descending = the climb-up clip backwards
function glbFrame(s, t) {
  const state = T.perf && T.perf.fadeAt != null ? 'sit' : stateNow();   // an act easing out keeps the sit spot until it has faded
  const X = TIGER.x, L = TIGER.ledgeY, sl = world.landS, M = ladderMetrics(), zHang = TIGER.ladderZ + M.depth, Rt = GT.root, W = {}; let yaw = 0;
  if (state === 'idle') { const wv = T.waveK || 0, ti = t % GT.dur.idleBody; W.idleBody = [ti, 1]; W.idleArm = [ti, 1 - wv]; W.waveArm = [t % GT.dur.waveArm, wv]; Rt.position.set(X, L, GB.zStand); }
  else if (state === 'turn') { const u = seg(s, [TIGER.idleEnd, TIGER.turnEnd]); W.turn = [u * GT.dur.turn, 1]; yaw = -GT.turnYaw0; Rt.position.set(X, L, GB.zStand); }
  else if (state === 'edge') {                                // back up to the edge, then down over it onto the ladder; hand over to the climb
    const u = seg(s, [TIGER.turnEnd, TIGER.edgeEnd]), tm = lerp(GT.mount.ta, GT.dur.mount, u), kc = smooth(seg(u, [0.75, 1]));
    W.mount = [tm, 1 - kc]; W.climb = [climbTime(TIGER.edgeEnd), kc];
    const yHang = hipsGlued(TIGER.edgeEnd) - lerp(GT.mount.h(tm), M.hipsRest, kc);
    Rt.position.set(X, lerp(L, yHang, smooth(seg(u, [0.3, 1]))), lerp(lerp(GB.zStand, GB.zEdge, smooth(seg(u, [0, 0.35]))), zHang, smooth(seg(u, [0.35, 0.85])))); }
  else if (state === 'climb') { const tc = climbTime(s), rw = GT.act.climbHead ? rewardW() : 0;                    // leans off the ladder in the intro
    if (rw > 0) { W.climbBody = [tc, 1]; W.climbHead = [tc, 1 - rw]; W[T.rew.kind === 'nod' ? 'nodHead' : 'lookHead'] = [T.rew.t, rw]; } else W.climb = [tc, 1];
    Rt.position.set(X - 0.16 * (T.peek || 0), hipsGlued(s) - M.hipsRest, zHang); }
  else if (state === 'land' || state === 'turnBack') {       // the mount clip backwards: off the ladder, down to the grass, turn to face you
    const U = seg(s, [sl, sl + TIGER.landLen + TIGER.turnBackLen]), tm = GT.dur.mount * (1 - U), kc = 1 - smooth(seg(U, [0, 0.12]));
    W.mount = [tm, 1 - kc]; W.climb = [climbTime(sl), kc];
    const hips = lerp(hipsGlued(sl), world.groundY + GT.mount.h0, smooth(seg(U, [0.05, 0.6])));     // the hips barely drop; the clip lowers the feet
    const mv = smooth(seg(U, [0.08, 0.7])); Rt.position.set(X + GB.xGround * mv, lerp(hips - GT.mount.h(tm), hipsGlued(sl) - M.hipsRest, kc), lerp(zHang, GB.zGround, mv)); }
  else {                                                      // sit (time-driven once landed and turned), the right arm waves now and then; the talent show on top
    const k = smooth(T.sit), wv = T.waveK || 0, ts = t % GT.dur.sitBody, q = T.perf ? perfPose(T.perf) : null, wS = q ? 1 - q.w : 1;
    W.mount = [0, (1 - k) * wS]; W.sitBody = [ts, k * wS]; W.sitArm = [ts, k * (1 - wv) * wS]; W.waveArm = [t % GT.dur.waveArm, k * wv * wS];
    if (q) for (const [n, tm, w] of q.clips) W[n] = [tm, w * q.w];
    Rt.position.set(X + GB.xGround + (q ? q.dx : 0), world.groundY, GB.zGround + (q ? q.dz : 0)); yaw = q ? q.yaw : 0; }
  for (const n in GT.act) { const a = GT.act[n], v = W[n], w = v ? v[1] : 0; a.enabled = w > 1e-4; a.setEffectiveWeight(w); if (v) a.time = v[0]; }
  // the mixer only writes a bone when its value changes: when the clip time stands still (the panel open, the page not scrolling) the head
  // would keep last frame's look rotation and spin as it is added again — so put the clean clip pose back before every update
  if (GT.lookSaved) for (const [b, q] of GT.look) b.quaternion.copy(q);
  Rt.rotation.y = yaw; GT.mixer.update(0); for (const [b, q] of GT.look) q.copy(b.quaternion); GT.lookSaved = true; Rt.updateMatrixWorld(true);
}
// the head layer on top of the clip: glance at a project / look back over the shoulder, as extra world rotation on the neck and head
function headLook(yaw, pitch, spine = 0) {
  if (Math.abs(yaw) + Math.abs(pitch) < 1e-4) return;
  GT.bone.RightUpLeg.getWorldPosition(gv[0]); GT.bone.LeftUpLeg.getWorldPosition(gv[1]); const right = gv[0].sub(gv[1]).normalize();
  const parts = [[GT.bone.Spine, spine / 3, 0], [GT.bone.Spine1, spine / 3, 0], [GT.bone.Spine2, spine / 3, 0], [GT.bone.Neck, (1 - spine) * 0.35, 0.35], [GT.bone.Head, (1 - spine) * 0.65, 0.65]];
  for (const [b, k, kp] of parts) { if (k < 1e-4 && kp * Math.abs(pitch) < 1e-4) continue;
    b.parent.getWorldQuaternion(gq[0]); b.getWorldQuaternion(gq[1]);
    gq[2].setFromAxisAngle(UP, yaw * k).multiply(gq[3].setFromAxisAngle(right, pitch * kp));
    b.quaternion.copy(gq[0].invert().multiply(gq[1].premultiply(gq[2]))); b.updateMatrixWorld(true); }
}
// the tiger's head on screen, px: centre, left edge, top (to keep the bubble and the menu off its face)
function headBox() { if (GT.ready) GT.bone.Head.getWorldPosition(gv[2]).add(gv[3].set(0, HS * 0.2, 0)); else tigerPoint(gv[2], true).add(gv[3].set(0, -0.3, 0));
  v3.copy(gv[2]).project(camera); const x = (v3.x + 1) / 2 * vw, y = (1 - v3.y) / 2 * vh; const r = GT.ready ? HS * 0.25 : 0.35;
  v3.copy(gv[2]).add(gv[3].set(-r, 0, 0)).project(camera); const left = (v3.x + 1) / 2 * vw; v3.copy(gv[2]).add(gv[3].set(0, r, 0)).project(camera);
  return { x, y, left: Math.min(left, x - 10), top: (1 - v3.y) / 2 * vh }; }
const tigerPoint = (out, top) => GT.ready ? (top ? GT.bone.Head.getWorldPosition(out).add(gv[3].set(0, HS * 0.42, 0)) : GT.bone.Hips.getWorldPosition(out))
  : out.copy(rig.root.position).add(gv[3].set(0, (state === 'climb' || state === 'edge') ? (top ? 1.2 : 0.1) : (top ? 1.35 : 0.4), 0));
// ───────────────────────── The meadow's talent show (Kay, 2026-09-27): click the tiger after it sits, pick an act ─────────────────────────
// segments [clip, from, to (null = its end)] play back to back, 0.25 s crossfades; the catwalk walks one wide 180° turn out and the same
// clip back (root turned half round), so it ends where it started
const PERF = { dance: [['dance', 0, 9.5]], zombie: [['zidle', 0, 1.6], ['zscream', 0, null], ['zattack', 0, null]], catwalk: [['catwalk', 0, null], ['catwalk', 0, null]], thumbs: [['thumbs', 0, null]] };
function perfPose(P) {
  const segs = PERF[P.kind], lens = segs.map(([n, a, b]) => (b ?? GT.dur[n]) - a), total = lens.reduce((x, y) => x + y, 0);
  if (P.t >= total + 0.5 || (P.fadeAt != null && P.t - P.fadeAt >= 0.4)) { T.perf = null; return null; }
  let j = 0, acc = 0; while (j < segs.length - 1 && P.t >= acc + lens[j]) { acc += lens[j]; j++; }
  const tt = Math.min(P.t - acc, lens[j]), [n, a] = segs[j], clips = [[n, a + tt, 1]];
  if (j > 0 && segs[j - 1][0] !== n && tt < 0.25) { const x = smooth(tt / 0.25); clips[0][2] = x; clips.push([segs[j - 1][0], segs[j - 1][1] + lens[j - 1], 1 - x]); }
  const w = smooth(Math.min(1, P.t / 0.4)) * (1 - smooth(clamp((P.t - total) / 0.5, 0, 1))) * (P.fadeAt != null ? 1 - smooth((P.t - P.fadeAt) / 0.4) : 1);   // fadeAt: scrolled away mid-act
  let yaw = 0, dx = 0, dz = 0;
  if (P.kind === 'catwalk' && GT.walk) {                      // walk out across the open grass (planWalk's heading), turn, walk back
    const Wk = GT.walk, yl = j === 0 ? Wk.y : Wk.y + Math.PI; yaw = yl * w; if (j > 0) { dx = Wk.ex * w; dz = Wk.ez * w; }
    if (Wk.k < 1) { const f = Math.min(tt / lens[j], 1), i = f * (GT.walkPath.length - 1), i0 = Math.floor(i), i1 = Math.min(i0 + 1, GT.walkPath.length - 1), u = i - i0;
      const px = lerp(GT.walkPath[i0][0], GT.walkPath[i1][0], u) * (Wk.k - 1), pz = lerp(GT.walkPath[i0][1], GT.walkPath[i1][1], u) * (Wk.k - 1), c = Math.cos(yl), sn = Math.sin(yl);
      dx += (px * c + pz * sn) * w; dz += (-px * sn + pz * c) * w; } }
  return { clips, w, yaw, dx, dz };
}
const talentsEl = $('talents');
// G1: an act unlocks after that many projects seen; the thumbs-up needs its clip in the GLB
function renderTalents() { const n = seenN(); talentsEl.innerHTML = `<p class="who mono">${COPY.talents.title}</p><div class="acts">${COPY.talents.acts.filter(([k]) => k !== 'thumbs' || !GT.ready || GT.act.thumbs).map(([k, label, , need]) => { need = needOf(need); const ok = n >= need;
  return `<button type="button" data-act="${k}"${ok ? '' : ' disabled'}>${label}${ok ? '' : `<span class="lk">${ptl(COPY.talents.locked, { n: need })}</span>`}</button>`; }).join('')}</div>`; }
function talents(open) { const was = T.menu; T.menu = open; if (open && T.wmenu) wardrobe(false); talentsEl.classList.toggle('on', open); talentsEl.inert = !open; talentsEl.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open && !was) { T.menuFrom = document.activeElement; setTimeout(() => talentsEl.querySelector('button')?.focus({ preventScroll: true }), 30); }
  else if (!open && talentsEl.contains(document.activeElement)) { const f = T.menuFrom; T.menuFrom = null; if (f && f.focus && f !== document.body) f.focus({ preventScroll: true }); else document.activeElement.blur(); } }
talentsEl.inert = true;
const trapTab = (el) => el.addEventListener('keydown', (e) => { if (e.key !== 'Tab') return; const bs = [...el.querySelectorAll('button:not([disabled])')]; if (!bs.length) return;
  e.preventDefault(); const i = bs.indexOf(document.activeElement); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus({ preventScroll: true }); });
trapTab(talentsEl);
const trickEl = $('trick'); if (trickEl) { trickEl.textContent = COPY.talents.trigger; trickEl.addEventListener('click', (e) => { e.stopPropagation(); if (GT.ready && state === 'sit') talents(!T.menu); }); }
// the catwalk's heading, planned when it starts (with this frame's camera): out along the clip's own curve and back, clear of the pier
// face and the rails (z > 0.5 for the hips; the body is about 0.45 deep), the whole tiger in frame, off the shore words on a wide screen,
// and as far across the frame as that allows without walking into the lens. On a phone the tiger fills the frame, so the walk is shortened
// (scale < 1: the root slides back a little under the steps) rather than leave it.
function planWalk() { const path = GT.walkPath; if (!path) return null; const N = path.length - 1, gy = world.groundY, sx = TIGER.x + GB.xGround, sz = GB.zGround;
  const V = gv[4] || (gv[4] = new THREE.Vector3()), scr = (x, y, z) => { V.set(x, y, z).project(camera); return [(V.x + 1) / 2, (1 - V.y) / 2]; };
  const xMin = LAY.mobile ? 0.02 : 0.52, xMax = 0.98, hw = LAY.mobile ? 0.6 : 0.45; let best = null;   // hw: half the body's width (a head in profile is wider)                        // the body's edges (the chibi head is ~0.9 wide)
  for (const k of LAY.mobile ? [1, 0.75, 0.55, 0.4, 0.3, 0.2] : [1, 0.8, 0.6, 0.45]) {
    const dx = path[N][0] * k, dz = path[N][1] * k;
    for (let d = -180; d < 180; d += 4) { const y = d * Math.PI / 180, c1 = Math.cos(y), s1 = Math.sin(y), ex = dx * c1 + dz * s1, ez = -dx * s1 + dz * c1; let bad = 0, left = 1, near = -9;
      for (let i = 0; i <= N; i += 2) for (const leg of [0, 1]) { const px = path[i][0] * k, pz = path[i][1] * k, cc = leg ? -c1 : c1, ss = leg ? -s1 : s1;
        const x = sx + (leg ? ex : 0) + px * cc + pz * ss, z = sz + (leg ? ez : 0) - px * ss + pz * cc;
        const bx = scr(x, gy + HS * 0.4, z)[0], el = scr(x - hw, gy + HS * 0.7, z)[0], er = scr(x + hw, gy + HS * 0.7, z)[0], foot = scr(x, gy, z)[1], head = scr(x, gy + HS, z)[1];
        bad += Math.max(0, 0.5 - z) * 4 + Math.max(0, xMin - el) + Math.max(0, er - xMax) + Math.max(0, foot - 0.985) + Math.max(0, 0.04 - head);
        left = Math.min(left, bx); near = Math.max(near, z); }
      const score = bad > 0 ? -bad * 100 : (1 - left) - 0.8 * Math.max(0, near - sz - 0.25) - (1 - k) * 0.3;
      if (!best || score > best.score) best = { score, y, ex, ez, k }; }
    if (best && best.score > 0 && best.k === k) break; }
  return best; }
function perform(kind) { const a = COPY.talents.acts.find((x) => x[0] === kind); if (!GT.ready || !PERF[kind] || !GT.act[PERF[kind][0][0]] || !a || seenN() < needOf(a[3])) return;
  talents(false); if (kind === 'catwalk') GT.walk = planWalk(); T.perf = { kind, t: 0 }; say(tpl(a[2]), 2.2); }
talentsEl.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (!b) return; e.stopPropagation(); perform(b.dataset.act); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (T.menu) talents(false); if (T.wmenu) wardrobe(false); } });
// ───────────────────────── The wardrobe (G2, Kay's pieces): what the tiger wears, chosen on the meadow, kept between visits ─────────────────────────
const wardrobeEl = $('wardrobe'), wearEl = $('wear'); wardrobeEl.inert = true; trapTab(wardrobeEl);
const WORN = {};                                               // id → { meshes, loaded, loading }
// a piece whose file is not there yet (Kay is still making it) shows, locked, as "soon"
function renderWardrobe() { const n = seenN(), items = WEAR;
  wardrobeEl.innerHTML = `<p class="who mono">${PL.wardrobeTitle}</p><div class="acts">${items.length ? items.map((w) => { const have = !!w.src, need = needOf(w.need), ok = have && n >= need, on = PROG.wear.has(w.id);
    return `<button type="button" data-wear="${w.id}"${ok ? ` aria-pressed="${on}"` : ' disabled'}>${w.name}${ok ? '' : `<span class="lk">${have ? ptl(PL.lockedItem, { n: need }) : PL.soon}</span>`}</button>`; }).join('') : `<span class="mono none">${PL.nothing}</span>`}</div>`; }
function wardrobe(open) { const was = T.wmenu; T.wmenu = open; wardrobeEl.classList.toggle('on', open); wardrobeEl.inert = !open; wardrobeEl.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) { if (T.menu) talents(false); if (!was) { T.wFrom = document.activeElement; setTimeout(() => wardrobeEl.querySelector('button')?.focus({ preventScroll: true }), 30); } }
  else if (wardrobeEl.contains(document.activeElement)) { const f = T.wFrom; T.wFrom = null; if (f && f.focus && f !== document.body) f.focus({ preventScroll: true }); else document.activeElement.blur(); } }
if (wearEl) { wearEl.textContent = PL.wardrobe; wearEl.addEventListener('click', (e) => { e.stopPropagation(); if (GT.ready && state === 'sit') wardrobe(!T.wmenu); }); }
wardrobeEl.addEventListener('click', (e) => { const b = e.target.closest('button[data-wear]'); if (!b) return; e.stopPropagation(); const id = b.dataset.wear; if (PROG.wear.has(id)) PROG.wear.delete(id); else PROG.wear.add(id); progSave(); renderWardrobe(); applyWear(); });
// a piece lands on its bone: its placement in the reference's coordinates (tiger-ref.glb) → the bone's own space at the bind pose
function wearItem(w, on) { const W = WORN[w.id] || (WORN[w.id] = { meshes: [], loaded: false, loading: false });
  if (!on) { W.meshes.forEach((m) => { m.visible = false; }); return; }
  if (W.loaded) { W.meshes.forEach((m) => { m.visible = true; }); return; }
  if (W.loading || !GT.ready || !GT.bone[w.bone]) return; W.loading = true;
  new GLTFLoader().load(w.src, (g) => { g.scene.updateMatrixWorld(true); const bone = GT.bone[w.bone], toBone = new THREE.Matrix4().multiplyMatrices(GT.bind.inv[w.bone], GT.bind.model);
    g.scene.traverse((o) => { if (!o.isMesh) return; const m = o.clone(); m.matrixAutoUpdate = false; m.matrix.multiplyMatrices(toBone, o.matrixWorld); m.castShadow = true; m.frustumCulled = false; m.layers.enable(1);
      if (m.material) { m.material = m.material.clone(); m.material.fog = true; } bone.add(m); W.meshes.push(m); });
    W.loaded = true; W.loading = false; if (!PROG.wear.has(w.id)) W.meshes.forEach((m) => { m.visible = false; }); },
    undefined, () => { W.loading = false; console.warn('wardrobe: could not load', w.src); }); }
function applyWear() { if (!GT.ready) return; for (const w of WEAR) if (w.src) wearItem(w, PROG.wear.has(w.id) && seenN() >= needOf(w.need)); }
// ───────────────────────── The visitor's reward (G3): a nod when you stay on a project, a look-away when you rush past ─────────────────────────
const REW = { cur: null, pi: -1, still: 0, said: false, nodded: new Set(), rushed: null, lastRush: -99, autoUntil: 0 };
function rewardW() { const R = T.rew; if (!R) return 0; const d = GT.dur[R.kind === 'nod' ? 'nodHead' : 'lookHead'] || 1; return smooth(Math.min(1, R.t / 0.3)) * (1 - smooth(seg(R.t, [d - 0.45, d - 0.05]))); }
function rewardFrame(dt, t) { const L = REW.cur, pi = L ? +L.el.dataset.p : -1, still = Math.abs(vel) < 25 && !panelOpen;
  if (pi !== REW.pi) { REW.pi = pi; REW.still = 0; REW.said = false; } else if (L && still) REW.still += dt; else REW.still = 0;
  if (T.rew) { T.rew.t += dt; if (T.rew.t >= (GT.dur[T.rew.kind === 'nod' ? 'nodHead' : 'lookHead'] || 1)) T.rew = null; }
  const can = GT.ready && !!GT.act.nodHead && state === 'climb' && !T.rew && !T.perf && ENTRY.phase === 'done';
  if (L && REW.still >= REWARD.stay && !REW.nodded.has(pi) && can) { REW.nodded.add(pi); T.rew = { kind: 'nod', t: 0 }; const q = PL.quips.nod; say(q[REW.nodded.size % q.length], 2.4); }
  else if (L && REW.still >= REWARD.stay * 5 && !REW.said) { REW.said = true; const q = PL.quips.stay; say(q[Math.abs(pi) % q.length], 2.6); }
  if (REW.rushed) { const Lr = REW.rushed; REW.rushed = null; const rp = +Lr.el.dataset.p;
    if (can && !PROG.seen.has(seenKey(rp)) && !REW.nodded.has(rp) && t - REW.lastRush > REWARD.rushEvery) { REW.lastRush = t; T.rew = { kind: 'look', t: 0 }; const q = PL.quips.rush; say(q[Math.floor(t) % q.length], 2); } } }
// C-d: the meadow's grass bends away from the cursor's spot on the ground and springs back; the flowers nod with it
const _o = { ax: 0, az: 0, w: 0 }, lampNdc = new THREE.Vector2();
function grassFrame(dt) { const Gs = world.grass, G = world.groundY; ray.setFromCamera(lampNdc.set(mouse.x, -mouse.y), camera); const o = ray.ray.origin, d = ray.ray.direction; const hit = d.y < -1e-4 ? (G - o.y) / d.y : -1;
  const hx = hit > 0 ? o.x + d.x * hit : 1e9, hz = hit > 0 ? o.z + d.z * hit : 1e9, R = 2.6, ease = Math.min(1, dt * 9); let dirty = false;
  const bend = (x, z, cur) => { const dx = x - hx, dz = z - hz, dd = Math.hypot(dx, dz); const want = dd < R && dd > 1e-3 ? (1 - dd / R) * (1 - dd / R) * 1.1 : 0;
    if (want === 0 && cur < 1e-3) return -1; _o.w = want; if (want > 0) { _o.ax = dz / (dd || 1); _o.az = -dx / (dd || 1); } const tilt = cur + (want - cur) * ease; return tilt < 1e-3 ? 0 : tilt; };
  for (let i = 0; i < Gs.n; i++) { const r = bend(Gs.px[i], Gs.pz[i], Gs.tilt[i]); if (r < 0) continue; if (r > 0 && _o.w > 0) { Gs.ax[i] = _o.ax; Gs.az[i] = _o.az; } Gs.tilt[i] = r;
    _m.fromArray(Gs.base, i * 16); _q.setFromAxisAngle(_a.set(Gs.ax[i], 0, Gs.az[i]), r); _m2.makeRotationFromQuaternion(_q);
    _m3.makeTranslation(Gs.px[i], Gs.y0, Gs.pz[i]); _m2.premultiply(_m3); _m3.makeTranslation(-Gs.px[i], -Gs.y0, -Gs.pz[i]); _m2.multiply(_m3); _m2.multiply(_m); Gs.mesh.setMatrixAt(i, _m2); dirty = true; }
  if (dirty) Gs.mesh.instanceMatrix.needsUpdate = true;
  for (const f of world.flowers || []) { const r = bend(f.x, f.z, f.tilt); if (r < 0) continue; if (r > 0 && _o.w > 0) { f.ax = _o.ax; f.az = _o.az; } f.tilt = r; f.g.quaternion.setFromAxisAngle(_a.set(f.ax, 0, f.az), r); } }
// C-g: a light on the big words — the cursor's spot inside the letters (CSS .glow reads --lx/--ly); only for words near the pointer
const glowEls = [...document.querySelectorAll('.value-text .big, .shore-text .big, .st.title .big, .footer .words')]; glowEls.forEach((el) => el.classList.add(el.closest('.value-text') || el.closest('.st') ? 'glow-c' : 'glow'));
function glowFrame() { if (!mouse.seen || LAY.mobile || (mx.x === T.gx && mx.y === T.gy && scroll === T.gs)) return; T.gx = mx.x; T.gy = mx.y; T.gs = scroll;
  for (const el of glowEls) { const r = el.getBoundingClientRect(); const near = r.bottom > -260 && r.top < vh + 260 && mx.x > r.left - 260 && mx.x < r.right + 260 && mx.y > r.top - 260 && mx.y < r.bottom + 260;
    if (near) { el._g = true; el.style.setProperty('--lx', (mx.x - r.left).toFixed(0) + 'px'); el.style.setProperty('--ly', (mx.y - r.top).toFixed(0) + 'px'); } else if (el._g) { el._g = false; el.style.setProperty('--lx', '-999px'); } } }

// ───────────────────────── The opening (Kay, 2026-09-27; the motion pass 2026-10-01) ─────────────────────────
// A film opening in beats: a title card (her name, set like a credit) holds while the tiger loads → it folds away and the tiger drops
// onto the paper out of its own shadow → click: it waves → a line is drawn down the paper through it, the paper splits along the line
// and both halves slide off while the camera backs out to the rail's first position (the world is seen only in the gap; the tiger stays
// in front of the paper) → the nav, the statement and the scroll hint arrive in order; the tiger nods down the ladder → scroll starts.
// Phases: card → cardOut → drop → void (waits for a click) → [waiting] → wave → enter → done. A click or scroll before the tiger has
// landed is kept (queued) and skips the wave. ?snap and the Studio skip it all (?snap&entry=1 plays it).
const QUIET = (SNAP && !PARAMS.has('entry')) || STUDIO;
const ENTRY = { phase: QUIET ? 'done' : 'card', t: 0, k: QUIET ? 1 : 0, queued: false, chrome: false }, PAPER = new THREE.Color('#F1F1EE'), INKC = new THREE.Color('#111111');
const OP = REDUCE ? { ...OPENING, card: 0.6, cardOut: 0.4, drop: 0.01, wave: 0.6, line: 0.01, split: [0, 0.45], dolly: [0, 0.5], chrome: 0.2 } : OPENING;
const tcard = $('titlecard'); window.__entry = ENTRY;                 // tools/opening.js steps through it
const hintEl = $('void-hint'); if (QUIET) hintEl.hidden = true;
function entryGo() { if (ENTRY.phase !== 'void') return; ENTRY.t = 0; document.documentElement.classList.add('entering'); lockPage(false); setTimeout(() => { hintEl.hidden = true; }, 700);
  const start = () => { ENTRY.t = 0; if (REDUCE) { entryDone(); return; }                       // reduced motion: a cut, no split, no dolly
    if (GT.ready && !ENTRY.queued) { ENTRY.phase = 'wave'; T.wave = T.waveLen = OP.wave + 0.5; } else ENTRY.phase = 'enter'; };
  if (GT.ready || GT.failed) start(); else { ENTRY.phase = 'waiting'; tigerLoad.then(start); } }   // a click before the model is in waits for it
const entryPoke = () => { if (ENTRY.phase === 'void') entryGo(); else if (['card', 'cardOut', 'drop'].includes(ENTRY.phase)) ENTRY.queued = true; };
function lockPage(on) { for (const el of [$('page'), document.querySelector('.nav')]) if (el) el.inert = on; }
if (ENTRY.phase !== 'done') lockPage(true);
// A3: the nav items rise one by one (CSS, html.chrome), then the statement, then the scroll hint
function entryChrome() { if (ENTRY.chrome) return; ENTRY.chrome = true; document.documentElement.classList.add('chrome');
  const st = texts.find((x) => x.el.id === 'h-statement'), sc = texts.find((x) => x.el.id === 'h-scroll');
  if (st) { st.stagger = MOTION.reveal.heroStagger; st.delay = QUIET ? 0 : 0.35; st.reveal(); } if (sc) setTimeout(() => sc.reveal(), QUIET ? 0 : 1100); }
function entryDone() { ENTRY.phase = 'done'; ENTRY.k = 1; document.documentElement.classList.add('entering', 'entered'); lenis.start(); entryChrome(); tcard.classList.add('gone');
  if (!QUIET && !REDUCE) T.nod = OP.nod;
  if (PROG.back && !QUIET) setTimeout(() => { say(PL.quips.back, 3); const lf = SECTIONS.find((x) => x.id === PROG.lastFloor); if (lf) toast(ptl(PL.ach.back, { f: lf.num })); }, 900); }
window.addEventListener('wheel', entryPoke, { passive: true });
window.addEventListener('touchmove', entryPoke, { passive: true });
window.addEventListener('keydown', (e) => { if (ENTRY.phase !== 'done' && e.key === 'Tab') e.preventDefault(); });
window.addEventListener('keydown', (e) => { if (['card', 'cardOut', 'drop', 'void'].includes(ENTRY.phase) && ['Enter', ' ', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); entryPoke(); } });
// the opening's clock (called from frame): the card holds until there is a tiger (the GLB, or the procedural one if the GLB failed) — the
// card is the loading state, like Léo's "World building" — then folds, the tiger drops, then the hint
function entryTick(dt) { const E = ENTRY; if (E.phase === 'done' || !booted) return; E.t += dt;
  // every shader (the world's, the tiger's, their shadows) compiles while the card is up, not on a frame you see move
  if (!E.compiled && (GT.ready || GT.failed) && R.win0 && world.objs.length) { E.compiled = true; const tg = GT.ready ? GT.root : rig.root, was = tg.visible;
    for (const o of world.objs) o.visible = true; tg.visible = true;
    try { (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera))).catch(() => {}); } catch (e) {}
    for (const o of world.objs) o.visible = false; tg.visible = was; }
  if (E.phase === 'card') { if (!tcard.classList.contains('on')) tcard.classList.add('on');
    if (E.t >= (E.queued ? 0.6 : OP.card) && (GT.ready || GT.failed)) { E.phase = 'cardOut'; E.t = 0; tcard.classList.add('out'); } }
  else if (E.phase === 'cardOut' && E.t >= OP.cardOut) { E.phase = 'drop'; E.t = 0; }
  else if (E.phase === 'drop' && E.t >= OP.drop) { E.phase = 'void'; E.t = 0; tcard.classList.add('gone'); document.documentElement.classList.add('entry-ready'); if (E.queued) entryGo(); }
  else if (E.phase === 'wave' && E.t >= OP.wave) { E.phase = 'enter'; E.t = 0; }
  else if (E.phase === 'enter') { E.k = smooth(seg(E.t, OP.dolly)); if (E.t >= OP.chrome) entryChrome(); if (E.t >= Math.max(OP.split[1], OP.dolly[1])) entryDone(); } }
// the tiger's drop onto the paper: its contact shadow grows under it as it falls, then it squashes and settles
const contact = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g2 = c.getContext('2d'), gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(20,18,14,.5)'); gr.addColorStop(0.55, 'rgba(20,18,14,.2)'); gr.addColorStop(1, 'rgba(20,18,14,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false }));
  m.rotation.x = -HALF; m.renderOrder = -1; m.layers.enable(1); m.visible = false; scene.add(m); return m; })();
function entryBody() { const E = ENTRY, tg = GT.ready ? GT.root : rig.root, shown = E.phase !== 'card' && E.phase !== 'cardOut';
  if (GT.ready) GT.root.visible = shown; else rig.root.visible = shown && (E.phase === 'enter' || E.phase === 'done' || GT.failed === true);   // never the placeholder while the GLB loads
  let fall = 0, sq = 0, sh = 1;
  if (E.phase === 'drop') { const u = clamp(E.t / OP.drop, 0, 1), f = clamp(u / 0.5, 0, 1), w = clamp((u - 0.5) / 0.5, 0, 1); fall = 1 - f * f; sq = u >= 0.5 ? Math.exp(-5 * w) * Math.cos(10 * w) : 0; sh = 0.3 + 0.7 * f * f; }
  if (fall || sq) { tg.position.y += fall * HS * 1.4; tg.scale.set(1 + 0.09 * sq, 1 - 0.15 * sq, 1 + 0.09 * sq); tg.updateMatrixWorld(true); }
  else if (tg.scale.y !== 1) { tg.scale.set(1, 1, 1); tg.updateMatrixWorld(true); }
  const fade = E.phase === 'enter' ? 1 - smooth(seg(E.t, [OP.split[0], OP.split[0] + 0.6])) : 1;
  contact.visible = shown && (GT.ready || GT.failed) && E.phase !== 'done' && fade > 0.01;
  if (contact.visible) { contact.position.set(TIGER.x, TIGER.ledgeY + 0.012, GB.zStand); contact.scale.set(HS * 0.62 * sh, HS * 0.36 * sh, 1); contact.material.opacity = sh * fade; } }
// the opening's picture: paper everywhere, the world only inside the split (between its two cut edges), the tiger on top of both.
// The tiger and its contact shadow are on layer 1 (so are the lights): a scissored pass draws them alone over the paper.
const CLEAR0 = renderer.getClearColor(new THREE.Color()), CLEARA0 = renderer.getClearAlpha();
function renderOpening() {
  const E = ENTRY, inEnter = E.phase === 'enter', line = inEnter ? clamp(E.t / OP.line, 0, 1) : 0, g = inEnter ? CustomEase.get('reveal')(seg(E.t, OP.split)) : 0;
  tigerPoint(v3, false); v3.project(camera); const cx = clamp((v3.x + 1) / 2 * vw, 2, vw - 2), gl = cx * (1 - g), gr = cx + (vw - cx) * g, open = gr - gl >= 1.5;
  // order: paper → the line → the world in the gap (it renders the shadow map, with every caster) → the paper's cut edges → the tiger alone
  // on top (no depth clear: outside the gap it lands on the paper; inside it, the world's depth keeps what stands in front of it in front)
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.autoClear = false; renderer.setScissorTest(false); renderer.setClearColor(PAPER, 1); renderer.clear(true, true, true); renderer.setScissorTest(true);
  if (line > 0 && !open) { const lh = vh * smooth(line); renderer.setScissor(cx - 0.75, vh - lh, 1.5, lh); renderer.setClearColor(INKC, 1); renderer.clear(true, false, false); }
  if (open) { renderer.setScissor(gl, 0, gr - gl, vh); scene.background = skyColor; renderer.render(scene, camera);
    renderer.setClearColor(INKC, 1); for (const ex of [gl, gr]) if (ex > 1 && ex < vw - 1) { renderer.setScissor(ex - 0.75, 0, 1.5, vh); renderer.clear(true, false, false); } }
  renderer.setScissorTest(false); scene.background = null; camera.layers.set(1); renderer.render(scene, camera); camera.layers.set(0);
  scene.background = skyColor; renderer.setClearColor(CLEAR0, CLEARA0); renderer.autoClear = true; renderer.shadowMap.autoUpdate = true; }

// ───────────────────────── The intro (Kay, 2026-09-27): no paper; the tiger leans off the ladder and talks in a game dialogue bubble ─────────────────────────
// pages follow the scroll through the intro window; each page types itself out on time
const bubbleEl = $('bubble'), bubblePage = $('bubble-page'), photoEl = $('photo'), BUB = { page: -1, t: 0, n: -1, full: '' };
const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function bubbleFrame(on, page, dt) {
  bubbleEl.classList.toggle('on', on); if (!on) { BUB.page = -1; photoEl.classList.remove('on'); return; }
  if (page !== BUB.page) { BUB.page = page; BUB.t = 0; BUB.n = -1; BUB.full = COPY.intro.pages[page].join('\n'); bubbleEl.classList.toggle('last', page === COPY.intro.pages.length - 1); }
  BUB.t += dt; const n = Math.min(BUB.full.length, Math.floor(BUB.t * 55));
  if (n !== BUB.n) { BUB.n = n; bubblePage.innerHTML = esc(BUB.full.slice(0, n)) + '<span class="rest">' + esc(BUB.full.slice(n)) + '</span>'; bubbleEl.classList.toggle('done', n >= BUB.full.length); }
  const H = headBox(), hx = H.x, hy = H.y, bw = bubbleEl.offsetWidth, bh = bubbleEl.offsetHeight;
  if (LAY.mobile) { bubbleEl.style.left = '16px'; bubbleEl.style.top = clamp(H.top - bh - 22, 70, vh - bh - 16).toFixed(0) + 'px'; }
  else { bubbleEl.style.left = clamp(H.left - bw - 26, 24, vw - bw - 24).toFixed(0) + 'px'; bubbleEl.style.top = clamp(hy - bh * 0.4, 80, vh - bh - 24).toFixed(0) + 'px'; }
  const ph = COPY.intro.photo && hoverTiger;                  // a photo of Kay on hover (none yet)
  photoEl.classList.toggle('on', !!ph); if (ph) { photoEl.style.backgroundImage = `url(${COPY.intro.photo})`; photoEl.style.left = clamp(hx - 90, 16, vw - 196).toFixed(0) + 'px'; photoEl.style.top = clamp(hy + 30, 16, vh - 236).toFixed(0) + 'px'; }
}
const tigerLoad = loadTiger();

// ───────────────────────── The motion pass (Kay, 2026-10-01): floors, lights, the objects' entrances ─────────────────────────
const bump = (u, a, b) => Math.sin(Math.PI * seg(u, [a, b]));
const setVar = (el, k, v) => { const c = el._v || (el._v = {}); if (Math.abs((c[k] ?? -9) - v) > 0.002) { c[k] = v; el.style.setProperty(k, v.toFixed(3)); } };
// how a lamp comes on: neon stutters (held steps), a bulb pops past full and settles, a spotlight clacks on; the screen's lamp just fades up
const FLICK = { bar: [[0, 0], [0.04, 0.9], [0.09, 0.08], [0.15, 0.8], [0.2, 0.15], [0.28, 1.15], [0.4, 1]], spot: [[0, 0], [0.05, 1], [0.1, 0.12], [0.16, 1.1], [0.3, 1]],
                workshop: [[0, 0], [0.03, 1.6], [0.22, 1]], torch: [[0, 0], [0.05, 1.4], [0.3, 1]] }, FLICK_STEP = { bar: true, spot: true };
function flickT(t, kind) { const k = FLICK[kind]; if (REDUCE || !k) return Math.min(1, t / 0.35);
  if (t >= k[k.length - 1][0]) return k[k.length - 1][1]; let i = 0; while (t > k[i + 1][0]) i++;
  return FLICK_STEP[kind] ? k[i][1] : lerp(k[i][1], k[i + 1][1], (t - k[i][0]) / (k[i + 1][0] - k[i][0])); }
// B1: a lamp is on once its floor has arrived (each at its own point of LIGHTS.on, so they click on one by one) and once it has risen
// into the frame (motion-sensor lights all the way down); scrolling back up switches it off again. The switching-on plays on time.
function lampK(Lp, floor, kind, s, dt) { const x = crossS(floor), a0 = x + LIGHTS.on[0] + (LIGHTS.on[1] - LIGHTS.on[0]) * Lp.r, S = Lp.st;
  let want = s >= a0; if (want) { v3.copy(Lp.p).project(camera); want = v3.y > -0.88; }
  if (want && !S.on) { S.on = true; S.t = 0; } else if (!want && S.on) S.on = false;
  S.t += dt; S.k = S.on ? flickT(S.t, kind) : Math.max(0, S.k - dt * 6); return S.k; }
// C1 + C2 + D2 for one floating object, from a = its centre's distance from the screen's centre in screens (+ = still below)
function cardFrame(L, a, dt) { const el = L.el, abs = Math.abs(a);
  L.show ??= el.classList.contains('show-spot') ? 'spot' : el.classList.contains('show-print') ? 'print' : '';
  const on = L.ann ? abs < 0.44 : abs < 0.34; if (on !== L.ann) { L.ann = on; el.classList.toggle('on', on); }     // C1: number + name announce at the middle
  setVar(el, '--rise', 1 - smooth(clamp((0.62 - a) / 0.5, 0, 1)));                                           // C2: up out of its shadow on the way in,
  setVar(el, '--sink', smooth(clamp((-a - 0.25) / 0.45, 0, 1)));                                              // back down on the way out,
  setVar(el, '--turn', clamp(a / 0.55, -1, 1));                                                               // a little turn as it passes (a turntable)
  setVar(el, '--dim', smooth(clamp((abs - 0.22) / 0.45, 0, 1)));                                              // and the ones not in the middle step back
  // D2 workshop: the drawing shows while the object comes into view, then the part prints into it, bottom up, by the time it is centred
  if (L.show === 'print') setVar(el, '--p', smooth(clamp((0.32 - a) / 0.32, 0, 1)));
  if (L.show === 'spot') { const S = el._spot || (el._spot = { on: false, t: 0, k: 0 }), want = S.on ? abs < 0.46 : abs < 0.4;   // D2 bar: a spotlight finds it (state on the element: survives a rebuild)
    if (want && !S.on) { S.on = true; S.t = 0; } else if (!want) S.on = false;
    S.t += dt; S.k = S.on ? flickT(S.t, 'spot') : Math.max(0, S.k - dt * 5); setVar(el, '--lit', S.k); setVar(el, '--b', 0.1 + 0.9 * Math.min(1, S.k)); } }
// the ink of the nav and the lift's display: dark rooms (and the workshop until its lights are on) want paper; over paper, ink.
const arriveK = (i, s) => smooth(seg(s, [crossS(i) + LIGHTS.on[0], crossS(i) + LIGHTS.on[1] + 0.15]));
function darkAt(y, s) { const w = R.inks.find((r) => scroll + y >= r.top && scroll + y < r.top + r.h); if (!w) return null;
  return { w, dark: THEMES[w.theme].ink === 'light' || (w.fl >= 0 && s > crossS(w.fl) - 0.35 && arriveK(w.fl, s) < 0.5) }; }
// the lift sits low on the left: at the end of a light floor over a dark one it is over the floor itself — the next room's ceiling slab,
// dark like that room. Is the ray through the lift's corner below the floor's top where it would meet the back wall (z = -2.8)?
const inkRay = new THREE.Raycaster(), inkNdc = new THREE.Vector2();
function overDarkFloor(w) { const nx = w.fl >= 0 ? SECTIONS[w.fl + 1] : null, yS = nx ? world.floors[w.fl + 1] : null;
  if (yS == null || THEMES[nx.theme].ink !== 'light') return false;
  inkRay.setFromCamera(inkNdc.set((40 / vw) * 2 - 1, -(((vh - 30) / vh) * 2 - 1)), camera); const o = inkRay.ray.origin, d = inkRay.ray.direction;
  return d.z < -1e-4 && o.y + d.y * ((-2.8 - o.z) / d.z) < yS + 0.15; }
function inkFrame(s, landed) { const top = darkAt(50, s), bottom = darkAt(vh - 30, s), meadowNav = !!top && top.w.top === R.meadow.top;
  const navMode = !top ? '' : landed && meadowNav ? 'split' : top.dark && !landed ? 'light' : '';
  if (navMode !== T.navMode) { T.navMode = navMode; document.documentElement.classList.toggle('nav-light', navMode === 'light'); document.documentElement.classList.toggle('nav-split', navMode === 'split'); }
  liftEl.classList.toggle('light', !!bottom && (bottom.dark || overDarkFloor(bottom.w)));
  navOnPaper(); }
// in a dark room the nav is paper-coloured; where an open panel or the computer's screen (both paper) lies under one of its parts,
// that part goes back to ink (the parts' boxes are measured on resize; the deck's is the one laid over the glass this frame)
const navParts = [...document.querySelectorAll('.nav .brand, .nav .links, .nav .right')];
function navOnPaper() { const pw = panelOpen ? panel.offsetWidth : 0, dk = T.deckOn ? T.deckBox : null;
  navParts.forEach((el, i) => { const r = R.nav?.[i]; const on = !!r && r.w > 0 && (pw > r.x + 4 || (!!dk && dk.y < r.y + r.h && dk.y + dk.h > r.y && dk.x < r.x + r.w && dk.x + dk.w > r.x));
    if (el._paper !== on) { el._paper = on; el.classList.toggle('on-paper', on); } }); }
// B2: the lift's display, bottom left: the floor number rolls like an elevator's (on time, as the camera passes each slab behind the
// title paper), the depth runs with the camera; it fades while an object comes up underneath it and before the archives reach it
const liftEl = $('lift'), liftRoll = $('lift-roll'), liftName = $('lift-name'), liftDepth = $('lift-depth');
function liftFrame(s, camY, under) { const n = SECTIONS.length; let f = -1; for (let i = 0; i < n; i++) if (s >= crossS(i)) f = i;
  const on = ENTRY.phase === 'done' && s >= crossS(0) - 0.5 && scroll + vh - 80 < R.archives.top;
  liftEl.classList.toggle('on', on); liftEl.classList.toggle('under', under); if (!on) return;
  const fi = Math.max(0, f); if (fi !== T.liftF) { T.liftF = fi; liftName.textContent = SECTIONS[fi].title; liftRoll.style.transform = `translate3d(0, ${(-fi * 100 / n).toFixed(3)}%, 0)`; PROG.lastFloor = SECTIONS[fi].id; }
  const mins = Math.floor(PROG.secs / 60); if (mins !== T.liftM) { T.liftM = mins; $('lift-time').textContent = mins >= 1 ? ptl(PL.time, { m: mins }) : ''; }
  const d = `↓ ${Math.max(0, -camY).toFixed(1)} m`; if (d !== T.liftD) { T.liftD = d; liftDepth.textContent = d; } }
const deckSlides = [...document.querySelectorAll('#deck .slide')], deckCrt = $('deck-crt');

// ───────────────────────── Frame ─────────────────────────
let last = performance.now(), shoreMix = 0, vel = 0, lastScroll = 0, saidShore = false, state = '';
function stateNow() { return state; }                          // the scroll state, for code that shadows the name
const tiltEls = [document.querySelector('.hero .words'), document.querySelector('.shore-text'), ...document.querySelectorAll('.value-text')];
const shoreEl = document.querySelector('.shore-text');
const skyTarget = new THREE.Color(SKY.bottom);
function frame(now) {
  const dt = SNAP ? 0.2 : Math.min(0.05, (now - last) / 1000); last = now;
  lenis.raf(now); scroll = lenis.animatedScroll ?? scrollY;
  if (!R.win0) measure();
  const t = now / 1000, s = scroll / vh;
  vel += (((scroll - lastScroll) / Math.max(dt, 1e-3)) - vel) * Math.min(1, dt * 6); lastScroll = scroll;
  if (!SNAP && ENTRY.phase === 'done') { PROG.secs += dt; if ((T.secSave = (T.secSave || 0) + dt) > 10) { T.secSave = 0; progSave(); } }   // G7: time here

  // ── header: Léo's parallax + fade
  const headerP = clamp(scroll / R.header.h, 0, 1);
  const hc = document.querySelector('.header .content');
  hc.style.transform = `translate3d(0, ${(-headerP * MOTION.header.parallax * 0.35).toFixed(1)}px, 0)`;
  hc.style.opacity = 1 - smooth((headerP - MOTION.header.fadeStart) / (MOTION.header.fadeEnd - MOTION.header.fadeStart));

  // ── text reveals by local progress (replay on re-scroll)
  for (const tx of texts) { if (tx.el.id === 'h-statement' || tx.el.id === 'h-scroll') continue; const pr = (scroll + vh - tx.top) / (tx.h + vh * 0.35); if (pr > 0.12) tx.reveal(); else if (pr <= 0) tx.hide(); }
  for (const c of chars) { const pr = (scroll + vh - c.top) / (c.h + vh); if (pr > (c.title ? 0.12 : 0.3)) c.reveal(); else if (pr <= 0) c.hide(); }   // a floor title shows as soon as its block is on screen; a statement waits until it is well in
  if (!heroShown && scroll + vh > R.hero.top + vh * 0.35) { heroShown = true; gsap.to(heroWords.map((w) => w.querySelector('.main')), { yPercent: 0, duration: MOTION.reveal.duration, ease: 'reveal', stagger: MOTION.reveal.heroStagger }); }

  // ── the rail (Léo): camera = linear in scroll, everywhere; clamped when the tiger has landed
  const landed = s >= world.landS; if (landed !== T.landedCls) { T.landedCls = landed; document.documentElement.classList.toggle('landed', landed); }
  if (shoreEl) shoreEl.style.setProperty('--pin', landed ? (scroll - world.landS * vh).toFixed(1) + 'px' : '0px');   // the words land with the tiger and stay put
  const camY = Math.max(camYAt(s), world.camYMin);
  camera.position.set(LAY.camX, camY, CAMERA.z + CAMERA.header.rangeZ * (1 - clamp(s / CAMERA.header.screens, 0, 1)));
  key.position.set(5, camY + 9, 9); key.target.position.set(1, camY - 3, -1); key.target.updateMatrixWorld();
  entryTick(dt);
  if (ENTRY.phase !== 'done') {                               // the opening: a close shot of the tiger on paper that backs out to the rail's first position
    const D = LAY.mobile ? 7.4 : 5.4, cy = TIGER.ledgeY + HS * 0.52;
    camera.position.lerp(_a.set(TIGER.x, cy + D * Math.sin(-CAMERA.pitch), GB.zStand + D * Math.cos(CAMERA.pitch)), 1 - ENTRY.k); }
  { const show = ENTRY.phase === 'enter' || ENTRY.phase === 'done'; for (const o of world.objs) o.visible = show && !o.userData.hidden; }
  camera.updateMatrixWorld();                                   // overlays and the hover ray below use this frame's camera

  // ── which window are we in? (for the sky tint + the cards)
  let inWindow = -1; R.windows.forEach((w, i) => { if (scroll + vh * 0.5 >= w.top && scroll + vh * 0.5 < w.top + w.h) inWindow = i; });
  const mid = scroll + vh * 0.5, inR = (r) => !!r && mid >= r.top && mid < r.top + r.h;
  const inWorld = scroll < R.hero.top - vh * 0.1 || inWindow >= 0 || inR(R.intro) || inR(R.archives) || inR(R.meadow); T.inWorld = inWorld;
  // the intro: the tiger leans off the ladder toward you while the bubble talks
  const ia = R.intro.top / vh - 0.2, ib = (R.intro.top + R.intro.h) / vh - 0.8;               // the hero has gone; out before the first title band
  T.peek = ENTRY.phase === 'done' ? smooth(seg(s, [ia - 0.15, ia + 0.2])) * (1 - smooth(seg(s, [ib - 0.1, ib + 0.25]))) : 0;

  // ── the character state (Laurens): scrubbed by scroll; only the idle bits run on time
  const sl = world.landS; let next;
  if (s < TIGER.idleEnd) next = 'idle'; else if (s < TIGER.turnEnd) next = 'turn'; else if (s < TIGER.edgeEnd) next = 'edge'; else if (s < sl) next = 'climb';
  else if (s < sl + TIGER.landLen) next = 'land'; else if (s < sl + TIGER.landLen + TIGER.turnBackLen) next = 'turnBack'; else next = 'sit';
  if (next !== state) { state = next; if (state === 'climb') saidShore = false; }
  if (!saidShore && s >= sl && ENTRY.phase === 'done') { saidShore = true; say(COPY.shore.tiger, 5); ach('landed', PL.ach.landed); }   // a big jump can skip 'land'
  T.sit += ((state === 'sit' ? 1 : 0) - T.sit) * Math.min(1, dt * 3.5);
  if (state === 'sit' && !T.perf) { T.waveAt -= dt; if (T.waveAt < 0) { T.waveAt = 6 + Math.random() * 5; T.wave = T.waveLen = 1.6; } } else if (state !== 'idle') T.wave = 0;
  if (T.perf) { T.perf.t += dt; if (state !== 'sit' && T.perf.fadeAt == null) T.perf.fadeAt = T.perf.t; }   // scrolled off the meadow spot: the act eases out (0.4 s), no jump
  if (GT.ready && state === 'sit' && T.sit > 0.95 && !T.hinted && !T.perf && !T.menu) { T.hinted = true; if (!(LAY.mobile && trickEl)) say(COPY.talents.hint, 4); }   // on a phone the trick button says it (the quip sat on it)
  if (T.menu && (state !== 'sit' || !inWorld)) talents(false); if (T.wmenu && (state !== 'sit' || !inWorld)) wardrobe(false);
  const canAct = GT.ready && state === 'sit' && T.sit > 0.8; if (trickEl) trickEl.disabled = !canAct; if (wearEl) wearEl.disabled = !canAct;
  T.wave = Math.max(0, T.wave - dt); T.waveK = T.wave > 0 ? smooth(Math.min(1, T.wave / 0.3)) * smooth(Math.min(1, ((T.waveLen || 1.6) - T.wave) / 0.25)) : 0;
  if (GT.ready) glbFrame(s, t);
  else if (state === 'idle') stIdle(t); else if (state === 'turn') stTurn(seg(s, [TIGER.idleEnd, TIGER.turnEnd]), t); else if (state === 'edge') stEdge(seg(s, [TIGER.turnEnd, TIGER.edgeEnd]), s);
  else if (state === 'climb') stClimb(s, t); else if (state === 'land') stLand(seg(s, [sl, sl + TIGER.landLen])); else if (state === 'turnBack') stTurnBack(seg(s, [sl + TIGER.landLen, sl + TIGER.landLen + TIGER.turnBackLen])); else stSit(t, dt);

  // ── cards: alignment a = (card centre − viewport centre) in screens → drift (Laurens), the torches, the tiger's glance at each card
  let nearestA = 9, activeCat = null, underLift = false; REW.cur = null;
  for (const L of world.ledges) { const a = L.s - s;
    if (Math.abs(a) < Math.abs(nearestA)) { nearestA = a; activeCat = PIECES[+L.el.dataset.p].cat; }
    if (!L.slide && Math.abs(a) < 0.75) { const u = clamp(0.5 - a, 0, 1); L.el.style.transform = `translate3d(0, ${(lerp(MOTION.drift.from, MOTION.drift.to, u) * LAY.drift).toFixed(2)}vh, 0)`; }
    if (!L.slide && Math.abs(a) < 1.4) cardFrame(L, a, dt);
    if (!L.slide && a > 0.28 && a < 0.85) underLift = true;                                // an object coming up under the lift's display
    if (Math.abs(a) < 0.3) REW.cur = L;                                                     // the project in the middle (G3)
    if (a < 0.25 && L.aPrev >= 0.25) L.tIn = t; if (a < -0.25 && L.aPrev >= -0.25 && L.tIn != null && t - L.tIn < REWARD.rush && t > REW.autoUntil) REW.rushed = L; L.aPrev = a;
    if (a < 0.14 && a > -0.5 && !L.glanced && state === 'climb') { L.glanced = true; glance(TIGER.glance.yaw, TIGER.glance.pitch); }
    if (a > 0.3 || a < -0.6) L.glanced = false;
    if (!L.flame) continue;
    const k = lampK(L, L.floor, 'torch', s, dt);                                          // the torch clicks on with its floor (B1)
    const flick = 1 + 0.08 * Math.sin(t * 9.3 + L.seed) + 0.05 * Math.sin(t * 17.1 + L.seed * 2); L.light.intensity = L.base * flick * (1 - shoreMix * 0.7) * k; L.flame.visible = k > 0.02; L.flame.scale.setScalar((0.9 + 0.15 * flick) * (0.4 + 0.6 * Math.min(k, 1))); }
  for (const Lp of world.lamps) { const k = lampK(Lp, Lp.floor, Lp.kind, s, dt); if (Lp.light) Lp.light.intensity = Lp.base * k; else Lp.mat.emissiveIntensity = Lp.base * k; }
  rewardFrame(dt, t);
  if (world.grass && mouse.seen && !LAY.mobile && s > world.landS - 1.5) grassFrame(dt);
  glowFrame();
  // C-a: in the dark rooms the viewer's lamp is a torch on the cursor — it lights the wall (or the pier) where you point
  if (!LAY.mobile && mouse.seen && ENTRY.phase === 'done') { ray.setFromCamera(lampNdc.set(mouse.x, -mouse.y), camera); const o = ray.ray.origin, d = ray.ray.direction;
    if (d.z < -1e-4) { let zt = -2.8 + REWARD.light.ahead, tt = (zt - o.z) / d.z; if (o.x + d.x * tt > TIGER.x - TIGER.pier - 0.2) { zt = -0.1 + REWARD.light.ahead; tt = (zt - o.z) / d.z; }
      _a.copy(o).addScaledVector(d, tt); camera.worldToLocal(_a); (T.lampP || (T.lampP = _a.clone())).lerp(_a, Math.min(1, dt * REWARD.light.ease)); camLight.position.copy(T.lampP); } }
  if (Math.abs(nearestA) > 0.5) activeCat = null;

  // ── head layers: glance (Laurens timing) + hover look-back + idle bits
  const hoverLook = (hoverTiger || panelOpen) && state === 'climb' ? 1 : 0; T.hover.y += ((hoverLook ? 1.8 : 0) - T.hover.y) * Math.min(1, dt * 6); T.hover.p += ((hoverLook ? 0.55 : 0) - T.hover.p) * Math.min(1, dt * 6);
  // A3: once the world is open the tiger looks down the ladder twice — this way — and back at you (fades as soon as you scroll)
  T.nod = Math.max(0, T.nod - dt); const nu = T.nod > 0 ? 1 - T.nod / OP.nod : 0, nk = T.nod > 0 ? 1 - seg(s, [0, 0.25]) : 0;
  const nodP = -0.55 * (bump(nu, 0.04, 0.4) + bump(nu, 0.46, 0.82)) * nk, nodY = 0.16 * bump(nu, 0.04, 0.82) * nk;
  // C-b: while it stands or climbs, the tiger's head follows the cursor (over its shoulder when you are beside it)
  let fy = 0, fp = 0; if (GT.ready && mouse.seen && !LAY.mobile && ENTRY.phase === 'done' && ['idle', 'turn', 'edge', 'climb'].includes(state)) { GT.bone.Head.getWorldPosition(v3); v3.project(camera);
    const k = REWARD.cursor, away = state === 'climb' || state === 'edge' || (state === 'turn' && s > 0.5), dx = mouse.hx - v3.x, dy = mouse.hy + v3.y; fy = clamp(dx * k.yaw * (away ? -1 : 1), -k.maxYaw, k.maxYaw); fp = clamp(-dy * k.pitch, -0.5, 0.5); }
  T.fol.y += (fy - T.fol.y) * Math.min(1, dt * 5); T.fol.p += (fp - T.fol.p) * Math.min(1, dt * 5);
  if (GT.ready) { const pk = T.peek, gz = state === 'sit' && !T.perf ? smooth(T.sit) : 0;
    headLook(clamp(T.glance.y + T.hover.y + T.fol.y, -2.2, 2.2) * (1 - pk) + 2.2 * pk + mouse.hx * 0.6 * gz + nodY, clamp(T.glance.p + T.hover.p + T.fol.p, -0.9, 0.9) * (1 - pk) + 0.25 * pk - mouse.hy * 0.3 * gz + nodP, 0.42 * pk + 0.25 * Math.abs(nodP));          // the GLB's breathing lives in its idle clips; it has no blink, ear or tail rig
    GT.bone.Spine2.getWorldPosition(tigerHit.position); tigerHit.scale.set(HS * 0.5 / 1.5, HS * 0.95 / 1.7, HS * 0.45 / 1.5); } else {
  P.headYaw += T.glance.y + T.hover.y + nodY; P.headPitch += T.glance.p + T.hover.p + nodP;
  T.blinkAt -= dt; if (T.blinkAt < 0) { T.blink = !T.blink; T.blinkAt = T.blink ? 0.12 : 2.2 + Math.random() * 3; }
  rig.eyes.scale.y += ((T.blink ? 0.08 : 1) - rig.eyes.scale.y) * Math.min(1, dt * 30);
  T.earAt -= dt; if (T.earAt < 0) { T.ear = 1; T.earAt = 2 + Math.random() * 4; } T.ear = Math.max(0, T.ear - dt * 4);
  rig.ears[0].rotation.x = -0.5 * Math.sin(Math.PI * Math.min(1, T.ear)); rig.ears[1].rotation.x = 0.2 * Math.sin(Math.PI * Math.min(1, T.ear));
  const breathe = 1 + Math.sin(t * 1.6) * 0.014; rig.torso.scale.set(1, breathe, breathe);
  T.tailV += (clamp(Math.abs(vel) / 900, 0, 1) - T.tailV) * Math.min(1, dt * 3);
  rig.tail.forEach((g, i) => { g.rotation.z = P.tailCurl * (1 - i * 0.15); g.rotation.y = Math.sin(t * 2.6 + i * 0.8) * (0.22 + 0.25 * T.tailV) * (P.poleMix > 0.5 ? 1 : 0.6) + (P.poleMix > 0.5 ? 0 : 0.1 * Math.sin(t * 1.3)); });
  rig.apply();
  tigerHit.position.copy(rig.root.position).y += (state === 'climb' || state === 'edge') ? 0.1 : 0.4; }
  if (ENTRY.phase !== 'done') entryBody(); else if (contact.visible) contact.visible = false;   // the opening: the drop onto the paper, its shadow

  // ── the room's skin: blended across each floor slab by scroll (themeAt); the shore flips lighter (800ms)
  const th = themeAt(s);
  const lk = 1 - Math.pow(0.001, dt / (SKY.flipMs / 1000));
  skyTarget.set(landed ? SKY.shore : th.bg); if (!landed && inWindow >= 0 && activeCat && th.ink === 'dark') skyTarget.lerp(tmpC.set(CATS[activeCat].tint), SKY.windowMix);
  shoreMix = lerp(shoreMix, landed ? 1 : 0, lk);
  skyColor.lerp(skyTarget, lk); scene.fog.color.copy(skyColor);
  key.intensity = lerp(key.intensity, landed ? LIGHT.key.intensityShore : th.key, lk); key.color.lerp(tmpC.set(landed ? LIGHT.key.color : th.keyColor), lk);
  hemi.intensity = lerp(hemi.intensity, landed ? LIGHT.hemi.intensityShore : th.hemi, lk); hemi.color.lerp(tmpC.set(landed ? LIGHT.hemi.skyShore : th.hemiSky), lk); hemi.groundColor.lerp(tmpC.set(landed ? LIGHT.hemi.groundShore : th.hemiGround), lk);
  camLight.intensity = lerp(camLight.intensity, landed ? 0 : th.camLight, lk); camLight.color.lerp(tmpC.set(th.camColor), lk);
  scene.fog.near = lerp(scene.fog.near, landed ? 24 : th.fog[0], lk); scene.fog.far = lerp(scene.fog.far, landed ? 110 : th.fog[1], lk);
  if (ENTRY.phase !== 'done') { skyColor.copy(skyTarget); scene.fog.color.copy(skyColor); scene.fog.near = th.fog[0]; scene.fog.far = th.fog[1]; }
  // nav ink flips only while the nav sits inside a dark window (Léo's toggleColor rule)
  liftFrame(s, camY, underLift); inkFrame(s, landed);            // B2 + the ink of the nav and the lift

  // ── the computer's screen: the DOM strip is laid over the projected glass; during the hold, page scroll slides the previews
  if (world.deck) { const D = world.deck, W = R.windows[D.win]; let on = false;
    if (scroll + vh > W.top && scroll < W.top + W.h && !landed) { v3.copy(D.tl).project(camera); const x = (v3.x + 1) / 2 * vw, y = (1 - v3.y) / 2 * vh; v3.copy(D.br).project(camera); const w = (v3.x + 1) / 2 * vw - x, h = (1 - v3.y) / 2 * vh - y;
      on = y < vh && y + h > 0;
      if (on) { deckEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; deckEl.style.width = w.toFixed(1) + 'px'; deckEl.style.height = h.toFixed(1) + 'px'; T.deckBox = { x, y, w, h };
        const u = clamp((s - world.hold.s0) / Math.max(world.hold.len, 1e-3), 0, 1); deckStrip.style.transform = `translate3d(${(-u * (D.n - 1) * 100 / D.n).toFixed(3)}%, 0, 0)`;
        const k = Math.round(u * (D.n - 1)); if (k !== T.deckK) { T.deckK = k; $('deck-n').textContent = `${String(k + 1).padStart(2, '0')} / ${String(D.n).padStart(2, '0')}`; $('deck-bar').style.width = ((k + 1) / D.n * 100).toFixed(1) + '%'; }
          // (the preview's content follows its focus in CSS, --f: no pop from visible to hidden and back)
        deckSlides.forEach((el, j) => { const f = smooth(Math.min(1, Math.abs(u * (D.n - 1) - j))); if (Math.abs((el._f ?? -1) - f) > 0.002) { el._f = f; el.style.setProperty('--f', f.toFixed(3)); } });
        const cx = crossS(D.win), cr = seg(s, [cx + 0.85, cx + 1.3]); setVar(deckCrt, '--c1', seg(cr, [0, 0.4])); setVar(deckCrt, '--c2', smooth(seg(cr, [0.4, 0.8]))); setVar(deckCrt, '--c3', seg(cr, [0.75, 1])); deckCrt.classList.toggle('off', cr >= 1);
        if ((cr >= 0.6) !== deckLive) { deckLive = cr >= 0.6; deckLock(); } }
    if (world.glass) world.glass.color.setHex(0x0D0E10).lerp(tmpC.setHex(0xECEBE4), smooth(seg(s, [crossS(D.win) + 0.85 + 0.18, crossS(D.win) + 1.3]))); }
    if (on !== T.deckOn) { T.deckOn = on; deckEl.classList.toggle('on', on); } }

  // ── quip bubble above the head
  T.quipT -= dt; if (T.quipT <= 0 && T.quip) T.quip = '';
  quipEl.classList.toggle('on', !!T.quip && inWorld);
  if (T.quip) { tigerPoint(v3, true); v3.project(camera); const qw = quipEl.offsetWidth / 2 + 12; quipEl.style.transform = `translate(${clamp((v3.x + 1) / 2 * vw, qw, vw - qw).toFixed(0)}px, ${((1 - v3.y) / 2 * vh - 8).toFixed(0)}px) translate(-50%, -100%)`; }

  // ── the intro bubble; the talent menu beside the tiger
  const np = COPY.intro.pages.length; bubbleFrame(ENTRY.phase === 'done' && T.peek > 0.3 && s < ib + 0.05, Math.min(np - 1, Math.floor(seg(s, [ia, ib]) * np)), dt);
  const menuEl = T.menu ? talentsEl : T.wmenu ? wardrobeEl : null;
  if (menuEl) { const H = headBox(), w = menuEl.offsetWidth, h = menuEl.offsetHeight, side = H.left - w - 18 >= 16;   // beside the head, or above it on a phone
    const L = side ? H.left - w - 18 : clamp(H.x - w / 2, 16, vw - w - 16), Tp = side ? clamp(H.y - h * 0.5, 70, vh - h - 16) : clamp(H.top - h - 14, 70, vh - h - 16);    // placed beside the tiger, and held still (only follows a real move)
    if (!T.menuAt || T.menuEl !== menuEl || Math.abs(T.menuAt[0] - L) + Math.abs(T.menuAt[1] - Tp) > 40) { T.menuAt = [L, Tp]; T.menuEl = menuEl; menuEl.style.left = L.toFixed(0) + 'px'; menuEl.style.top = Tp.toFixed(0) + 'px'; } }
  else T.menuAt = null;

  // ── headline tilt (Laurens) on the DOM statements only; the camera itself never turns (Léo)
  mouse.hx += (mouse.x - mouse.hx) * MOUSE.headline.damping; mouse.hy += (mouse.y - mouse.hy) * MOUSE.headline.damping;
  const tilt = `translate3d(${(mouse.hx * MOUSE.headline.x).toFixed(2)}px, ${(mouse.hy * MOUSE.headline.y).toFixed(2)}px, 0) rotateY(${(mouse.hx * MOUSE.headline.rotY).toFixed(3)}deg) rotateX(${(-mouse.hy * MOUSE.headline.rotX).toFixed(3)}deg)`;
  tiltEls.forEach((el) => { if (el) el.style.transform = (el.classList.contains('shore-text') || el.classList.contains('value-text') ? 'translateY(-50%) ' : '') + tilt; });

  // ── cursor
  const under = document.elementFromPoint(mx.x, mx.y);
  ray.setFromCamera(new THREE.Vector2(mouse.x, -mouse.y), camera); hoverTiger = inWorld && mouse.seen && ray.intersectObject(tigerHit).length > 0; const overCard = !panelOpen && under?.closest?.('.card .in, .slide .in'); const overLink = under?.closest?.('a'); const overClose = under?.closest?.('#panel-close'); const overGrip = PW.drag || under?.closest?.('#panel-grip');
  const hot = !!(overCard || overLink || overClose || overGrip || under?.closest?.('button:not(:disabled), [role="button"]') || (hoverTiger && !panelOpen)); if (hot !== T.pawHot) { T.pawHot = hot; cursor.classList.toggle('hot', hot); }   // the dot grows over anything clickable
  setPill(ENTRY.phase !== 'done' ? (ENTRY.phase === 'void' && hoverTiger ? 'say hi' : '') : overGrip ? COPY.panel.resize : overClose ? COPY.panel.close : hoverTiger && !panelOpen ? (GT.ready && state === 'sit' ? 'talent show' : COPY.cursor.tiger) : overLink ? 'open' : overCard ? COPY.cursor.card : (scroll < vh * 0.4 && booted && !panelOpen ? 'scroll' : ''));

  tigerPoint(v3, false); v3.project(camera);
  window.__dbg = { s: +s.toFixed(3), state, glb: GT.ready, entry: ENTRY.phase, et: +ENTRY.t.toFixed(2), seen: seenN(), rew: T.rew ? T.rew.kind : null, still: +REW.still.toFixed(1), peek: +T.peek.toFixed(2), perf: T.perf ? T.perf.kind : null, walk: GT.walk ? [+GT.walk.y.toFixed(2), GT.walk.k, +GT.walk.score.toFixed(3)] : null, menu: T.menu, landed, aN: +nearestA.toFixed(3), inWindow, tiger: [+v3.x.toFixed(3), +v3.y.toFixed(3)], quipT: +T.quipT.toFixed(2), cam: camera.position.toArray().map((v) => +v.toFixed(2)), hips: rig.root.position.toArray().map((v) => +v.toFixed(2)), c: +cycleAt(rig.root.position.y).toFixed(3) };
  if (ENTRY.phase !== 'done') renderOpening(); else renderer.render(scene, camera);
  if (!document.hidden) requestAnimationFrame(frame);
}
window.addEventListener('resize', measure);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
measure();
// ───────────────────────── The Studio's preview (?studio in an iframe): jump to a section, show the hover text, report where it is ─────────────────────────
if (STUDIO) {
  const post = (m) => parent.postMessage({ studio: 1, ...m }, location.origin);
  const at = (sel) => document.querySelector(sel), top = (el) => el.getBoundingClientRect().top + scrollY;
  const mid = (el) => top(el) + el.getBoundingClientRect().height / 2 - vh / 2;       // the element's centre at the screen's centre
  const place = (target) => {
    const m = /^(title|value)(\d+)$/.exec(target || '');
    if (m) { const k = SECTIONS.findIndex((x) => x.at === +m[2]); if (k < 0) return null;            // a floor the lineup left empty isn't built
      const el = m[1] === 'title' ? at('#title' + k) : at('#value-big' + k)?.parentElement; return el ? mid(el) : null; }
    if (target === 'header') return 0;
    if (target === 'intro') return top(at('#intro')) + vh * 0.5;
    if (target === 'shore') return top(at('#meadow')) + (LAND_AT + 0.2) * vh;
    const el = at({ hero: '#hero', archives: '#archives', footer: '#footer' }[target]); return el ? mid(el) : null;
  };
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data?.studio) return; const m = e.data;
    if (m.type === 'goto') { const y = m.target ? place(m.target) : m.s * vh; if (y != null) lenis.scrollTo(Math.max(0, y), { immediate: true, force: true });
      setTimeout(() => post({ type: 'placed' }), 150); }                                    // timers, not frames: a frame still loading behind may not get frames
    if (m.type === 'hover') { if (m.on) heroShown = true; document.documentElement.classList.toggle('studio-hover', !!m.on);
      heroWords.forEach((w) => w.dispatchEvent(new Event(m.on ? 'mouseenter' : 'mouseleave'))); }
  });
  let lastS = -1; setInterval(() => { const s = scrollY / vh; if (Math.abs(s - lastS) > 0.005) { lastS = s; post({ type: 'scroll', s }); } }, 250);
  (async () => { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); await new Promise((r) => setTimeout(r, 60)); post({ type: 'ready' }); })();
}
progUI();
requestAnimationFrame(frame);
