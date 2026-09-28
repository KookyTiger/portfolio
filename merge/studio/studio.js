// ─────────────────────────────────────────────────────────────
// KookyTiger Studio — Kay edits the write-ups here; Claude reads (and writes) the same files.
// State lives in merge/writeups (public) + merge/writeups-private (drafts, notes, questions); server.py merges/splits them.
// Every edit autosaves; a save made on top of an older version is refused (409) so nobody overwrites anybody.
// ─────────────────────────────────────────────────────────────
import { renderWriteup, renderFloorBand, toolIcon, stagesOf } from '../writeup-view.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const words = (s) => (String(s || '').trim().match(/\S+/g) || []).length;
const today = () => new Date().toISOString().slice(0, 10);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
                set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };

const S = { studio: null, projects: {}, hashes: {}, icons: {}, sel: { type: 'inbox' }, dirty: new Set(), saving: new Set(), timers: {},
            showDraft: new Set(), focusBlock: null, pvMode: store.get('studio.pv', 'panel'), conflicts: {}, pics: {} };
const KINDS = ['sketch', 'photo', 'mockup', 'prototype', 'test', 'cad', 'render', 'screen', 'diagram', 'chart', 'still'];
const FLOOR_NAMES = { engineering: 'Engineering', design: 'Design & Interaction', analytics: 'Analytics & Strategy', backlog: 'Backlog' };
const SVG = (inner) => `<svg viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${inner}</svg>`;
const R = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="currentColor" stroke="none"/>`;
const LAYOUTS = [
  ['text', 'Text', SVG('<path d="M2 3h14M2 7h14M2 11h9"/>')],
  ['text-media', 'Text · picture', SVG('<path d="M2 3h6M2 7h6M2 11h4"/>' + R(10, 2, 6, 10))],
  ['media-text', 'Picture · text', SVG(R(2, 2, 6, 10) + '<path d="M10 3h6M10 7h6M10 11h4"/>')],
  ['gallery', 'Gallery', SVG('<path d="M2 3h14"/>' + R(2, 6, 4, 6) + R(7, 6, 4, 6) + R(12, 6, 4, 6))],
  ['full', 'Full picture', SVG(R(2, 2, 14, 7) + '<path d="M2 12h10"/>')],
  ['quote', 'Quote', SVG('<path d="M3 4h12M3 8h12" stroke-width="2.6"/><path d="M3 12h7"/>')],
  ['facts', 'Table', SVG('<rect x="2" y="2" width="14" height="10"/><path d="M2 6h14M2 9h14M7 2v10"/>')],
];

// ── paths: "blocks.2.media.0.caption" ──
function getPath(o, path) { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
function setPath(o, path, v) {
  const ks = path.split('.'); let a = o;
  ks.slice(0, -1).forEach((k, i) => { if (a[k] == null) a[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[k]; });
  a[ks.at(-1)] = v;
}
const docOf = (key) => (key === '_studio' ? S.studio : S.projects[key]);

function toast(msg, bad = false, ms = 3200) {
  const t = document.createElement('div'); t.className = 't' + (bad ? ' bad' : ''); t.textContent = msg;
  $('toast').append(t); setTimeout(() => t.remove(), ms);
}

// ── load ──
async function api(url, opt = {}) {
  const r = await fetch(url, opt); let j = {};
  try { j = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, j };
}
async function boot() {
  const [st, ic] = await Promise.all([api('/api/state'), api('/merge/vendor/tool-icons.json')]);
  if (!st.ok) { $('edit').innerHTML = `<h1>Studio can't load</h1><p class="lead">${esc(st.j.error || 'Is the server running? python3 merge/studio/server.py')}</p>`; return; }
  S.studio = st.j.studio; S.projects = st.j.projects; S.hashes = st.j.hashes; S.icons = ic.j.icons || {};
  // edits that never reached the server (it was down, the tab closed mid-save)
  for (const key of [...Object.keys(S.projects), '_studio']) {
    const saved = store.get('studio.unsaved.' + key);
    if (saved && JSON.stringify(saved) !== JSON.stringify(docOf(key)))
      S.conflicts[key] = { kind: 'local', data: saved };
    else store.del('studio.unsaved.' + key);
  }
  route(); setSave();
  setInterval(poll, 4000);
}

// ── routing: #p/<slug> #f/<floor> #classes #software #skills #templates #notes #inbox #help ──
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [a, b] = h.split('/');
  if (a === 'p' && S.projects[b]) S.sel = { type: 'project', id: b };
  else if (a === 'f' && (S.studio.floors || []).some((f) => f.id === b)) S.sel = { type: 'floor', id: b };
  else if (['classes', 'software', 'skills', 'templates', 'notes', 'inbox', 'help'].includes(a)) S.sel = { type: a };
  else S.sel = { type: 'inbox' };
  S.focusBlock = null;
  document.body.classList.toggle('wide-edit', !['project', 'floor'].includes(S.sel.type));   // library pages use the full width
  renderSide(); renderEditor(true); renderPreview(true);
}
addEventListener('hashchange', route);

// ── sidebar ──
const onSiteOrder = () => {
  const fo = Object.fromEntries((S.studio.floors || []).map((f, i) => [f.id, i]));
  return Object.values(S.projects).filter((p) => p.onSite).sort((a, b) => (fo[a.floor] ?? 9) - (fo[b.floor] ?? 9) || (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
};
const openQs = (p) => (p.blocks || []).reduce((n, b) => n + (b.questions || []).filter((q) => !String(q.a || '').trim()).length, 0);
function projectsOn(fid) {
  return Object.values(S.projects).filter((p) => (fid === 'backlog' ? !p.onSite || p.floor === 'backlog' : p.onSite && p.floor === fid))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(b.name));
}
function renderSide() {
  const sel = S.sel, on = (t, id) => (sel.type === t && (id == null || sel.id === id) ? 'on' : '');
  const inboxN = Object.values(S.projects).reduce((n, p) => n + openQs(p), 0);
  const pj = (p) => `<a class="pj ${on('project', p.slug)}" href="#p/${esc(p.slug)}"><span class="dot ${esc(p.status || 'draft')}"></span><span class="nm">${esc(p.name || p.slug)}</span>${openQs(p) ? `<span class="badge">${openQs(p)}</span>` : ''}</a>`;
  let h = `<a class="${on('inbox')}" href="#inbox"><span class="nm">Inbox</span>${inboxN ? `<span class="badge">${inboxN}</span>` : ''}</a>`;
  h += `<h4 class="k">Floors</h4>`;
  for (const f of S.studio.floors || []) {
    h += `<a class="fl ${on('floor', f.id)}" href="#f/${f.id}"><span class="num">${esc(f.num)}</span><span class="nm">${esc(FLOOR_NAMES[f.id] || f.title)}</span></a>`;
    h += projectsOn(f.id).map(pj).join('');
  }
  const back = projectsOn('backlog');
  h += `<h4 class="k">Backlog · not on the site</h4>${back.map(pj).join('') || '<p class="empty" style="padding:0 8px">none yet</p>'}`;
  h += `<a href="#" data-act="new-project" class="pj" style="color:var(--ink-3)">＋ New project</a>`;
  h += `<h4 class="k">Library</h4>
    <a class="${on('classes')}" href="#classes"><span class="nm">Classes</span><span class="badge soft">${(S.studio.classes || []).length}</span></a>
    <a class="${on('software')}" href="#software"><span class="nm">Software</span><span class="badge soft">${(S.studio.software || []).length}</span></a>
    <a class="${on('skills')}" href="#skills"><span class="nm">Skills</span></a>
    <a class="${on('templates')}" href="#templates"><span class="nm">Process templates</span></a>
    <h4 class="k">You → Claude</h4>
    <a class="${on('notes')}" href="#notes"><span class="nm">Voice & notes</span></a>
    <a class="${on('help')}" href="#help"><span class="nm">How this works</span></a>`;
  $('side').innerHTML = h;
  $('tb-inbox').textContent = inboxN ? `Inbox · ${inboxN}` : 'Inbox';
}

// ── editor ──
function renderEditor(reset = false) {
  const ed = $('edit'); const keep = reset ? 0 : ed.scrollTop;
  const act = document.activeElement; const focusK = !reset && act?.dataset?.k ? { k: act.dataset.k, doc: act.closest('[data-doc]')?.dataset.doc, s: act.selectionStart, e: act.selectionEnd } : null;
  const t = S.sel.type;
  ed.innerHTML = t === 'project' ? projectEditor(S.projects[S.sel.id]) : t === 'floor' ? floorEditor() : t === 'classes' ? classesEditor()
    : t === 'software' ? softwareEditor() : t === 'skills' ? skillsEditor() : t === 'templates' ? templatesEditor() : t === 'notes' ? notesEditor()
    : t === 'help' ? helpView() : inboxView();
  ed.scrollTop = keep;
  if (focusK) {
    const el = ed.querySelector(`[data-doc="${focusK.doc}"] [data-k="${CSS.escape(focusK.k)}"], [data-doc="${focusK.doc}"][data-k="${CSS.escape(focusK.k)}"]`);
    if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(focusK.s, focusK.e); } catch {} }
  }
  if (S.focusBlock) ed.querySelector(`#blk-${CSS.escape(S.focusBlock)}`)?.classList.add('focus');
}

function conflictBanner(key) {
  const c = S.conflicts[key]; if (!c) return '';
  if (c.kind === 'local') return `<div class="banner"><b>Unsaved edits from last time.</b> They never reached the files (the Studio server was off?).<span class="sp"></span><button class="btn sm dark" data-act="cf-mine" data-key="${key}">Use my edits</button><button class="btn sm" data-act="cf-drop" data-key="${key}">Throw them away</button></div>`;
  return `<div class="banner"><b>Claude changed this while you were editing.</b> Your latest edits are not saved yet.<span class="sp"></span><button class="btn sm" data-act="cf-theirs" data-key="${key}">Load Claude's version</button><button class="btn sm dark" data-act="cf-mine" data-key="${key}">Keep mine (overwrite)</button></div>`;
}

const optionList = (pairs, cur) => pairs.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
const swById = () => Object.fromEntries((S.studio.software || []).map((s) => [s.id, s]));
const clById = () => Object.fromEntries((S.studio.classes || []).map((c) => [c.id, c]));

function projectEditor(p) {
  const lib = S.studio, stages = stagesOf(p, lib), tpl = lib.templates[p.template] || { stages: [] };
  const c = p.context || {}, sw = swById(), cl = clById();
  const floors = [...(lib.floors || []).map((f) => [f.id, `${f.num} ${FLOOR_NAMES[f.id] || f.title}`]), ['backlog', 'Backlog']];
  const blockOpts = (p.blocks || []).map((b) => [b.id, `${stages[b.stage]?.label || b.stage || b.id}${b.title ? ' — ' + b.title.slice(0, 30) : ''}`]);
  const softwareChips = (p.software || []).map((id, j) => sw[id] ? `<span class="chip"><span class="ic">${toolIcon(sw[id], S.icons)}</span>${esc(sw[id].name)}<button class="x" data-act="arr-del" data-k="software" data-j="${j}">×</button></span>` : '').join('');
  const skillChips = (p.skills || []).map((s, j) => `<span class="chip">${esc(s.name)}<select data-k="skills.${j}.evidence" title="Which block shows this skill">${optionList([['', '— shown where? —'], ...blockOpts], s.evidence || '')}</select><button class="x" data-act="arr-del" data-k="skills" data-j="${j}">×</button></span>`).join('');
  const classChips = (p.classes || []).map((id, j) => cl[id] ? `<span class="chip"><code>${esc(cl[id].code)}</code>${esc(cl[id].topic || cl[id].title)}<button class="x" data-act="arr-del" data-k="classes" data-j="${j}">×</button></span>` : '').join('');
  const present = new Set((p.blocks || []).map((b) => b.stage));
  const addBtns = tpl.stages.filter((s) => !present.has(s.key)).map((s) => `<button class="add" data-act="add-block" data-stage="${s.key}">＋ ${esc(s.label)}</button>`).join('');
  const drive = p.drive || {};
  const legacy = p.legacy ? `<details class="more"><summary>Old site copy (written by Claude, never verified — for reference only)</summary><div class="diff" style="white-space:normal">${Object.entries(p.legacy).map(([k, v]) => `<p><b class="k">${esc(k)}</b> ${esc(Array.isArray(v) ? v.join(' · ') : v)}</p>`).join('')}</div></details>` : '';
  return `<div data-doc="${esc(p.slug)}">
    ${conflictBanner(p.slug)}
    <div class="row" style="gap:6px;margin-bottom:6px">
      <select data-k="status" data-side="1" style="width:auto">${optionList([['draft', '○ Draft'], ['review', '◐ Kay reviewing'], ['approved', '● Approved']], p.status || 'draft')}</select>
      <select data-k="floor" data-side="1" data-rerender="1" style="width:auto">${optionList(floors, p.floor || 'backlog')}</select>
      <label class="row" style="gap:5px;font-size:13px"><input type="checkbox" data-k="onSite" data-side="1" ${p.onSite ? 'checked' : ''}> on the site</label>
      <select data-k="template" data-rerender="1" style="width:auto" title="Process template">${optionList(Object.entries(lib.templates).map(([k, t]) => [k, t.name]), p.template)}</select>
      <span class="sp" style="flex:1"></span>
      ${drive.folder ? `<a class="btn sm ghost" href="https://drive.google.com/drive/folders/${esc(drive.folder)}" target="_blank" rel="noopener">Drive folder ↗</a>` : drive.path ? `<span class="hint">Drive: ${esc(drive.path)}</span>` : ''}
      <a class="btn sm ghost" href="/merge/writeups-private/sources/${esc(p.slug)}.md" target="_blank" title="Claude's notes on the Drive sources (private)">Source notes ↗</a>
    </div>
    <input class="name" data-k="name" data-side="1" value="${esc(p.name || '')}" placeholder="Project name">
    <label class="f" style="margin-top:8px"><span>One-liner (under 20 words)</span><textarea data-k="oneLiner" rows="2">${esc(p.oneLiner || '')}</textarea></label>
    <div class="grid2" style="margin-top:10px">
      <label class="f" style="grid-column:1/-1"><span>My role</span><input data-k="context.role" value="${esc(c.role || '')}" placeholder="What I did myself, in one line"></label>
      <label class="f"><span>Team</span><input data-k="context.team" value="${esc(c.team || '')}" placeholder="Team of 4"></label>
      <label class="f"><span>Partner / client</span><input data-k="context.partner" value="${esc(c.partner || '')}"></label>
      <label class="f"><span>Course</span><input data-k="context.course" value="${esc(c.course || '')}"></label>
      <label class="f"><span>When</span><input data-k="context.when" value="${esc(c.when || '')}" placeholder="Spring 2025"></label>
    </div>
    <div class="sec"><span class="k">Software I used</span><div class="chips">${softwareChips}<button class="add" data-act="pick-software">＋ software</button></div></div>
    <div class="sec"><span class="k">Skills this project shows</span><div class="chips">${skillChips}<button class="add" data-act="pick-skills">＋ skill</button></div></div>
    <div class="sec"><span class="k">Classes</span><div class="chips">${classChips}<button class="add" data-act="pick-classes">＋ class</button></div></div>
    <div class="sec"><span class="k">Cover (the cut-out on the site)</span><div class="row"><input data-k="cover" value="${esc(p.cover || '')}" style="max-width:420px">${p.cover ? `<img src="/${esc(p.cover)}" alt="" style="height:44px">` : ''}</div></div>
    ${legacy}
    <div class="sec"><span class="k">The page, block by block — ${esc(tpl.name || p.template)}</span>
      ${(p.blocks || []).map((b, i) => blockCard(p, b, i, stages, tpl)).join('')}
      <div class="addblk">${addBtns}<button class="add" data-act="add-block" data-stage="__quote">＋ Quote</button><button class="add" data-act="add-block" data-stage="">＋ Free block</button></div>
    </div>
    <div class="sec"><span class="k">Vision — show Claude what you imagine for this page (private)</span>
      <textarea data-k="vision.note" rows="3" placeholder="Anything: a mood, a site you like, 'the sketches should feel like a wall of post-its', what to cut…">${esc(p.vision?.note || '')}</textarea>
      <div class="media" data-drop="vision">${(p.vision?.refs || []).map((m, j) => `<div class="m"><div class="th"><img src="/${esc(m.src)}" alt=""><div class="tools"><button data-act="vdel" data-j="${j}" title="Remove">✕</button></div></div><input data-k="vision.refs.${j}.note" value="${esc(m.note || '')}" placeholder="What about it?"></div>`).join('')}
        <div class="drop">Drop reference pictures, screenshots or a photo of a hand-drawn layout</div></div>
    </div>
    <div class="sec"><span class="k">Log — what changed and why</span>
      <div class="log">${(p.log || []).map((e) => `<div class="e ${esc(e.by)}"><span class="who">${esc(e.by)} · ${esc(String(e.at || '').slice(5))}</span><span>${esc(e.text)}</span></div>`).join('') || '<p class="empty">Nothing yet.</p>'}</div>
      <div class="row" style="margin-top:8px;align-items:flex-start"><textarea id="log-new" rows="2" placeholder="Tell Claude something about this project…" style="flex:1"></textarea><button class="btn dark" data-act="log-add">Add</button></div>
    </div>
  </div>`;
}

function blockCard(p, b, i, stages, tpl) {
  const st = stages[b.stage];
  const num = b.layout === 'quote' ? '❝' : st ? String(st.n).padStart(2, '0') : '··';
  const stageOpts = optionList([...tpl.stages.map((s) => [s.key, s.label]), ['', '— free block —']], st ? b.stage : '');
  const layouts = LAYOUTS.map(([key, label, svg]) => `<button data-act="layout" data-i="${i}" data-v="${key}" class="${(b.layout || 'text') === key ? 'on' : ''}" title="${label}">${svg}</button>`).join('');
  const changed = b.draft != null && b.draft !== (b.text || '');
  const qa = (b.questions || []).map((q, j) => `<div class="qa ${String(q.a || '').trim() ? 'done' : ''}"><div class="q"><b>CLAUDE ASKS</b>${esc(q.q)}</div><textarea data-k="blocks.${i}.questions.${j}.a" rows="1" placeholder="Your answer…">${esc(q.a || '')}</textarea></div>`).join('');
  const media = (b.media || []).map((m, j) => mediaTile(i, j, m)).join('');
  const srcs = (b.sources || []).map((s) => s.id ? `<a href="https://drive.google.com/open?id=${esc(s.id)}" target="_blank" rel="noopener" title="${esc(s.file || '')}">${esc(s.label || s.file)}</a>` : `<span title="${esc(s.file || '')}">${esc(s.label || s.file)}</span>`).join('');
  return `<div class="blk ${b.ok ? 'okd' : ''}" data-bi="${i}" id="blk-${esc(b.id)}">
    <div class="bh"><span class="num">${num}</span>
      ${b.layout === 'quote' ? '<span class="k">Quote</span>' : `<select class="stage" data-k="blocks.${i}.stage" data-rerender="1">${stageOpts}</select>`}
      <span class="layouts">${layouts}</span><span class="sp"></span>
      <button class="okbtn ${b.ok ? 'on' : ''}" data-act="ok" data-i="${i}" title="Mark this block as checked by you">${b.ok ? '✓ Approved' : 'Approve'}</button>
      <button class="ib" data-act="up" data-i="${i}" title="Move up">↑</button><button class="ib" data-act="down" data-i="${i}" title="Move down">↓</button><button class="ib" data-act="del" data-i="${i}" title="Delete this block">✕</button>
    </div>
    ${b.layout === 'quote' ? '' : `<input class="title" data-k="blocks.${i}.title" value="${esc(b.title || '')}" placeholder="Headline — the takeaway of this stage, not its name">`}
    <textarea data-k="blocks.${i}.text" rows="4" placeholder="${esc(st?.hint || (b.layout === 'quote' ? 'One sentence that carries the insight.' : ''))}">${esc(b.text || '')}</textarea>
    <div class="meta"><span>${words(b.text)} words</span>${b.layout === 'facts' ? '<span>Table: one row per line · cells split by | · header row starts with !</span>' : ''}${changed ? `<span class="chg">edited by you</span><button data-act="draft" data-i="${i}">${S.showDraft.has(b.id) ? 'hide' : 'compare with'} Claude's draft</button><button data-act="revert" data-i="${i}">restore Claude's draft</button>` : ''}</div>
    ${changed && S.showDraft.has(b.id) ? `<div class="diff">${wordDiff(b.draft, b.text || '')}</div>` : ''}
    ${b.layout === 'quote' ? '' : `<div class="media" data-drop="${i}">${media}<div class="drop">Drop pictures or videos here<br><button class="btn sm" data-act="pick-pics" data-i="${i}">Choose from this project's pictures</button></div></div>`}
    ${qa}
    <div class="note"><textarea data-k="blocks.${i}.note" rows="1" placeholder="Note to Claude — what you want here…">${esc(b.note || '')}</textarea></div>
    ${srcs ? `<div class="srcs"><span>Sources:</span>${srcs}</div>` : ''}
  </div>`;
}

function mediaTile(i, j, m) {
  const video = /\.(mp4|webm|mov)$/i.test(m.src || '');
  return `<div class="m"><div class="th">${video ? `<video src="/${esc(m.src)}" muted></video>` : `<img src="/${esc(m.src)}" alt="" loading="lazy">`}
      <div class="tools"><button data-act="mmove" data-i="${i}" data-j="${j}" data-d="-1" title="Move left">←</button><button data-act="mmove" data-i="${i}" data-j="${j}" data-d="1" title="Move right">→</button><button data-act="mdel" data-i="${i}" data-j="${j}" title="Remove from this block (the file stays)">✕</button></div></div>
    <input data-k="blocks.${i}.media.${j}.caption" value="${esc(m.caption || '')}" placeholder="Caption">
    <select data-k="blocks.${i}.media.${j}.kind">${KINDS.map((k) => `<option ${k === (m.kind || 'photo') ? 'selected' : ''}>${k}</option>`).join('')}</select></div>`;
}

// word-level diff of Claude's draft → Kay's text
function wordDiff(a, b) {
  const A = String(a).split(/(\s+)/), B = String(b).split(/(\s+)/), n = A.length, m = B.length;
  if (n * m > 600000) return esc(b);
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0, out = '';
  while (i < n && j < m) {
    if (A[i] === B[j]) { out += esc(A[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out += `<del>${esc(A[i++])}</del>`;
    else out += `<ins>${esc(B[j++])}</ins>`;
  }
  while (i < n) out += `<del>${esc(A[i++])}</del>`;
  while (j < m) out += `<ins>${esc(B[j++])}</ins>`;
  return out;
}

function floorEditor() {
  const fi = S.studio.floors.findIndex((f) => f.id === S.sel.id), f = S.studio.floors[fi];
  const sw = swById(), cl = clById();
  const tools = (f.software || []).map((id, j) => sw[id] ? `<span class="chip"><span class="ic">${toolIcon(sw[id], S.icons)}</span>${esc(sw[id].name)}<button class="x" data-act="arr-del" data-k="floors.${fi}.software" data-j="${j}">×</button></span>` : '').join('');
  const sugg = (f.suggest || []).map((id, j) => sw[id] ? `<span class="chip ghost" title="Claude's guess — confirm or dismiss"><span class="ic">${toolIcon(sw[id], S.icons)}</span>${esc(sw[id].name)}?<button class="x" data-act="sugg-yes" data-fi="${fi}" data-j="${j}" title="Yes, I use it">✓</button><button class="x" data-act="arr-del" data-k="floors.${fi}.suggest" data-j="${j}" title="No">×</button></span>` : '').join('');
  const classes = (f.classes || []).map((id, j) => cl[id] ? `<span class="chip"><code>${esc(cl[id].code)}</code>${esc(cl[id].topic || cl[id].title)}<button class="x" data-act="arr-move" data-k="floors.${fi}.classes" data-j="${j}" data-d="-1" title="Earlier">↑</button><button class="x" data-act="arr-del" data-k="floors.${fi}.classes" data-j="${j}">×</button></span>` : '').join('');
  return `<div data-doc="_studio">
    ${conflictBanner('_studio')}
    <p class="k">Floor ${esc(f.num)} · the title band before the room</p>
    <h1>${esc(FLOOR_NAMES[f.id] || f.title)}</h1>
    <p class="lead">What this floor's title paper shows besides its name: the software and the classes behind the projects on it. The preview on the right is the band at its real size (1440 × 540, then a phone). The site still takes the title and subtitle from content.js; the toolkit is a proposal until you say yes.</p>
    <div class="grid2"><label class="f"><span>Title</span><input data-k="floors.${fi}.title" value="${esc(f.title)}"></label><label class="f"><span>Subtitle</span><input data-k="floors.${fi}.sub" value="${esc(f.sub || '')}"></label></div>
    <div class="sec"><span class="k">Software on this band</span><div class="chips">${tools}<button class="add" data-act="pick-software" data-target="floors.${fi}.software">＋ software</button></div></div>
    ${sugg ? `<div class="sec"><span class="k">Claude's guesses — do you use these?</span><div class="chips">${sugg}</div></div>` : ''}
    <div class="sec"><span class="k">Classes on this band (in order)</span><div class="chips">${classes}<button class="add" data-act="pick-classes" data-target="floors.${fi}.classes">＋ class</button></div></div>
    <div class="sec"><span class="k">Note to Claude about this floor</span><textarea data-k="floors.${fi}.note" rows="3">${esc(f.note || '')}</textarea></div>
    <div class="sec"><span class="k">Projects on this floor</span><div class="chips">${projectsOn(f.id).map((p) => `<a class="chip" href="#p/${esc(p.slug)}" style="text-decoration:none;padding-right:10px"><span class="dot ${esc(p.status || 'draft')}"></span>${esc(p.name)}</a>`).join('')}</div></div>
  </div>`;
}

function classesEditor() {
  const floors = S.studio.floors || [];
  const used = {}; Object.values(S.projects).forEach((p) => (p.classes || []).forEach((id) => (used[id] = [...(used[id] || []), p.name])));
  let rows = '', term = '';
  (S.studio.classes || []).forEach((c, i) => {
    if (c.term !== term) { term = c.term; rows += `<tr class="term"><td colspan="5">${esc(term)}</td></tr>`; }
    rows += `<tr><td style="white-space:nowrap;font-family:var(--mono);font-size:11.5px">${esc(c.code)}</td>
      <td><input data-k="classes.${i}.title" value="${esc(c.title)}">${c.topic != null ? `<input data-k="classes.${i}.topic" value="${esc(c.topic || '')}" placeholder="topic" style="margin-top:4px">` : ''}</td>
      <td><select data-k="classes.${i}.group">${optionList([['engineering', 'Engineering'], ['design', 'Design'], ['analytics', 'Analytics'], ['foundations', 'Foundations']], c.group)}</select></td>
      <td style="white-space:nowrap">${floors.map((f, fi) => `<button class="btn sm ${f.classes?.includes(c.id) ? 'dark' : 'ghost'}" data-act="feat" data-arr="floors.${fi}.classes" data-id="${esc(c.id)}" title="Show on the ${esc(FLOOR_NAMES[f.id])} band">${esc(f.num)}</button>`).join(' ')}</td>
      <td class="hint">${esc((used[c.id] || []).join(', '))}${c.status === 'now' ? ' <b style="color:var(--tiger)">now</b>' : ''}</td></tr>`;
  });
  return `<div data-doc="_studio">${conflictBanner('_studio')}
    <h1>Classes</h1><p class="lead">From your transcript — codes, titles and terms only (no grades, nothing else from it is stored). Click 01 / 02 / 03 to feature a class on that floor's title band. Fix any title the transcript abbreviated; add the two DIS course titles.</p>
    <table class="lib"><tr><th>Code</th><th>Title</th><th>Group</th><th>On band</th><th>Used in</th></tr>${rows}</table></div>`;
}

function softwareEditor() {
  const floors = S.studio.floors || [];
  const used = {}; Object.values(S.projects).forEach((p) => (p.software || []).forEach((id) => (used[id] = (used[id] || 0) + 1)));
  const groups = S.studio.softwareGroups || {};
  const cards = (g) => (S.studio.software || []).map((s, i) => [s, i]).filter(([s]) => s.group === g).map(([s, i]) => `<div class="sw"><span class="ic">${toolIcon(s, S.icons)}</span>
      <span class="nm">${esc(s.name)}</span>
      <span class="row" style="gap:6px"><span class="fl">${floors.map((f, fi) => `<button class="${f.software?.includes(s.id) ? 'on' : ''}" data-act="feat" data-arr="floors.${fi}.software" data-id="${esc(s.id)}" title="On the ${esc(FLOOR_NAMES[f.id])} band">${esc(f.num)}</button>`).join('')}</span><span class="use">${used[s.id] ? `${used[s.id]} project${used[s.id] > 1 ? 's' : ''}` : ''}</span></span></div>`).join('');
  return `<div data-doc="_studio">${conflictBanner('_studio')}
    <h1>Software</h1><p class="lead">The toolkit. Logos come from Simple Icons where the brand allows it; the rest (Adobe, Microsoft, SOLIDWORKS, MATLAB…) show a two-letter mark. Click 01 / 02 / 03 to feature a tool on a floor band.</p>
    ${Object.entries(groups).map(([g, name]) => `<div class="sec"><span class="k">${esc(name)}</span><div class="swgrid">${cards(g)}</div></div>`).join('')}
    <div class="sec"><span class="k">Add a tool that's missing</span><div class="row"><input id="sw-name" placeholder="Name, e.g. Rhino 8" style="max-width:220px"><input id="sw-abbr" placeholder="Mark, e.g. Rh" style="max-width:110px"><select id="sw-group" style="max-width:160px">${optionList(Object.entries(groups), 'make')}</select><button class="btn dark" data-act="sw-add">Add</button></div></div></div>`;
}

function skillsEditor() {
  const used = {}; Object.values(S.projects).forEach((p) => (p.skills || []).forEach((s) => (used[s.name] = [...(used[s.name] || []), p.name])));
  return `<div data-doc="_studio">${conflictBanner('_studio')}
    <h1>Skills</h1><p class="lead">One shared vocabulary so the same skill reads the same everywhere. Each project picks 4–8 and points each one at the block that proves it.</p>
    ${Object.entries(S.studio.skills || {}).map(([cat, list]) => `<div class="sec"><span class="k">${esc(cat)}</span><div class="chips">${list.map((s, j) => `<span class="chip" title="${esc((used[s] || []).join(', '))}">${esc(s)}${used[s] ? ` <code>${used[s].length}</code>` : ''}<button class="x" data-act="arr-del" data-k="skills.${esc(cat)}" data-j="${j}">×</button></span>`).join('')}<input data-act-enter="skill-add" data-cat="${esc(cat)}" placeholder="＋ add, Enter" style="width:150px;border-radius:999px;padding:4px 10px;font-size:12.5px"></div></div>`).join('')}</div>`;
}

function templatesEditor() {
  return `<div data-doc="_studio">${conflictBanner('_studio')}
    <h1>Process templates</h1><p class="lead">The stages a write-up walks through. The engineering one is yours; design and analytics are Claude's proposals — rename, reorder, rewrite the hints, add or remove stages. (A stage's key never changes, so blocks keep their place.)</p>
    ${Object.entries(S.studio.templates).map(([tk, t]) => `<div class="sec"><span class="k">${esc(tk)}</span><input data-k="templates.${tk}.name" value="${esc(t.name)}" style="max-width:420px;margin-bottom:8px">
      ${t.stages.map((s, j) => `<div class="row" style="align-items:flex-start;margin:6px 0"><span class="k" style="width:22px;padding-top:9px">${String(j + 1).padStart(2, '0')}</span><input data-k="templates.${tk}.stages.${j}.label" value="${esc(s.label)}" style="max-width:220px"><textarea data-k="templates.${tk}.stages.${j}.hint" rows="1" style="flex:1">${esc(s.hint)}</textarea><button class="ib" data-act="arr-move" data-k="templates.${tk}.stages" data-j="${j}" data-d="-1">↑</button><button class="ib" data-act="arr-del" data-k="templates.${tk}.stages" data-j="${j}" data-confirm="Remove this stage from the template? Blocks that use it become free blocks.">✕</button></div>`).join('')}
      <button class="add" data-act="stage-add" data-t="${esc(tk)}">＋ stage</button></div>`).join('')}</div>`;
}

function notesEditor() {
  return `<div data-doc="_studio">${conflictBanner('_studio')}
    <h1>Voice & notes</h1><p class="lead">How Claude writes for you, and anything you want Claude to know across all projects. Private — never on the site.</p>
    <label class="f sec"><span>Voice rules Claude follows when drafting</span><textarea data-k="voice" rows="9">${esc(S.studio.voice || '')}</textarea></label>
    <label class="f sec"><span>Your notes to Claude</span><textarea data-k="notes" rows="8" placeholder="e.g. 'Never say “passionate”.' · 'Recruiters I'm targeting: medical devices + consulting.' · 'Credit teammates by first name.'">${esc(S.studio.notes || '')}</textarea></label></div>`;
}

function inboxView() {
  const asks = [], answered = [], notes = [];
  for (const p of onSiteOrder().concat(projectsOn('backlog'))) {
    const stages = stagesOf(p, S.studio);
    (p.blocks || []).forEach((b, i) => {
      const where = `<p class="where"><a href="#p/${esc(p.slug)}" data-goto="${esc(b.id)}">${esc(p.name)}</a> · ${esc(stages[b.stage]?.label || b.layout || 'block')}${b.title ? ' · ' + esc(b.title) : ''}</p>`;
      (b.questions || []).forEach((q, j) => {
        const item = `<div class="it" data-doc="${esc(p.slug)}">${where}<div class="qa ${String(q.a || '').trim() ? 'done' : ''}"><div class="q"><b>CLAUDE ASKS</b>${esc(q.q)}</div><textarea data-k="blocks.${i}.questions.${j}.a" rows="1" placeholder="Your answer…">${esc(q.a || '')}</textarea></div></div>`;
        (String(q.a || '').trim() ? answered : asks).push(item);
      });
      if (String(b.note || '').trim()) notes.push(`<div class="it" data-doc="${esc(p.slug)}">${where}<div class="note"><textarea data-k="blocks.${i}.note" rows="1">${esc(b.note)}</textarea></div></div>`);
    });
  }
  return `<h1>Inbox</h1><p class="lead">What Claude needs from you, and what you've told Claude. Answer here or inside each project — it's the same field. When you're done, just tell Claude in chat: “studio updated”.</p>
    <div class="sec"><span class="k">Claude is asking · ${asks.length}</span><div class="ibx">${asks.join('') || '<p class="empty">Nothing open.</p>'}</div></div>
    <div class="sec"><span class="k">Your notes to Claude · ${notes.length}</span><div class="ibx">${notes.join('') || '<p class="empty">No notes yet. Every block has a “Note to Claude” field.</p>'}</div></div>
    <div class="sec"><span class="k">Answered — Claude will fold these in · ${answered.length}</span><div class="ibx">${answered.join('') || '<p class="empty">None yet.</p>'}</div></div>`;
}

function helpView() {
  return `<h1>How this works</h1><div class="lead" style="max-width:74ch">
    <p><b>Claude drafts, you edit, the site shows.</b> Claude reads your Drive (KAY-PORTFOLIO and the course folders it links to) and drafts each project here, block by block, following your process: problem → research → needs → brainstorming → prototyping → final → next. Every fact is cited (the “Sources” under a block open the Drive file). Anything Claude couldn't verify is a <b>question</b> in orange — answer it in the block or in the Inbox.</p>
    <p><b>Edit anything.</b> Rewrite the words, swap the headline, change a block's layout with the little icons, drop pictures from Finder onto a block (HEIC, PDF, video are fine — they're converted), or pick from the pictures Claude pulled out of the Drive. “Approve” marks a block as checked by you. Everything saves by itself.</p>
    <p><b>Talk to Claude inside the page.</b> Each block has a “Note to Claude”; each project has a Log and a Vision box where you can drop screenshots or a photo of a layout you drew. Then say “studio updated” in chat: Claude sees exactly what you changed (your edits vs its drafts) and learns your voice from it.</p>
    <p><b>Private vs public.</b> The words, pictures and toolkit go to <code>merge/writeups/</code> (in git, on the site). Claude's drafts, your notes, questions, sources and the Vision box stay in <code>merge/writeups-private/</code> — only on this Mac. The repo is public, so that split matters.</p>
    <p><b>Floors.</b> Each floor's title band can carry its software icons and classes — pick them on the floor's page; the preview shows the band at real size. The site doesn't use any of this yet: when you like the preview, tell Claude to wire it in.</p>
    <p><b>Start it:</b> <code>python3 merge/studio/server.py</code> → http://localhost:8010 (or ask Claude to open the Studio).</p></div>`;
}

// ── preview ──
let pvTimer = 0;
const schedulePreview = () => { clearTimeout(pvTimer); pvTimer = setTimeout(() => renderPreview(), 140); };
function renderPreview(reset = false) {
  const pv = $('pv'), keep = reset ? 0 : pv.scrollTop, mode = S.pvMode;
  document.querySelectorAll('#pv-mode button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  const avail = Math.max(200, pv.clientWidth - 36);
  if (S.sel.type === 'project') {
    const p = S.projects[S.sel.id], order = onSiteOrder(), idx = order.indexOf(p);
    const W = mode === 'wide' ? 1200 : mode === 'phone' ? 390 : 860;
    $('pv-title').textContent = `${p.name} · ${mode === 'wide' ? 'wide panel 1200' : mode === 'phone' ? 'phone 390' : 'site panel 860'}`;
    pv.innerHTML = `<div class="pv-frame ${mode === 'phone' ? 'phone' : 'panel'}" style="width:${W}px;zoom:${Math.min(1, avail / W)}">${renderWriteup(p, S.studio, S.icons, { index: idx >= 0 ? idx + 1 : null, total: order.length, showEmpty: true, base: '/' })}</div>`;
  } else if (S.sel.type === 'floor') {
    const f = S.studio.floors.find((x) => x.id === S.sel.id), n = projectsOn(f.id).length, total = S.studio.floors.length;
    $('pv-title').textContent = `${f.title} · title band`;
    const z1 = Math.min(1, avail / 1440), z2 = Math.min(1, avail / 390);
    pv.innerHTML = `<p class="pv-cap" style="width:${1440 * z1}px">Desktop 1440 × 540 (0.6 of a screen, as on the site)</p><div class="pv-band" style="width:1440px;height:540px;zoom:${z1}">${renderFloorBand(f, S.studio, S.icons, { total, count: n })}</div>
      <p class="pv-cap" style="width:${390 * z2}px">Phone 390 × 700</p><div class="pv-band" style="width:390px;height:700px;zoom:${z2}">${renderFloorBand(f, S.studio, S.icons, { total, count: n })}</div>`;
  } else {
    $('pv-title').textContent = 'Preview';
    pv.innerHTML = `<p class="empty" style="padding:20px">Open a project or a floor to see it as the site would.</p>`;
  }
  pv.scrollTop = keep;
  if (S.focusBlock) pv.querySelector(`[data-block="${CSS.escape(S.focusBlock)}"]`)?.classList.add('hl');
}
$('pv-mode').addEventListener('click', (e) => { const m = e.target.closest('button')?.dataset.m; if (!m) return; S.pvMode = m; store.set('studio.pv', m); renderPreview(true); });
$('pv').addEventListener('click', (e) => {
  const a = e.target.closest('a'); if (a) e.preventDefault();
  const id = (a?.getAttribute('href') || '').startsWith('#wu-') ? a.getAttribute('href').slice(4) : e.target.closest('[data-block]')?.dataset.block;
  if (!id || S.sel.type !== 'project') return;
  const card = $('edit').querySelector(`#blk-${CSS.escape(id)}`); if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' }); focusBlock(id);
  setTimeout(() => card.querySelector('textarea')?.focus({ preventScroll: true }), 350);
});
$('tb-pv').addEventListener('click', () => {
  if (matchMedia('(max-width: 1180px)').matches) document.body.classList.toggle('pv-over');
  else document.body.classList.toggle('no-pv');
  renderPreview();
});
addEventListener('resize', () => schedulePreview());
function focusBlock(id) {
  if (S.focusBlock === id) return;
  S.focusBlock = id;
  $('edit').querySelectorAll('.blk.focus').forEach((x) => x.classList.remove('focus'));
  $('edit').querySelector(`#blk-${CSS.escape(id)}`)?.classList.add('focus');
  const pv = $('pv'); pv.querySelectorAll('.hl').forEach((x) => x.classList.remove('hl'));
  const t = pv.querySelector(`[data-block="${CSS.escape(id)}"]`);
  if (t) { t.classList.add('hl'); const fr = t.getBoundingClientRect(), pr = pv.getBoundingClientRect(); if (fr.top < pr.top || fr.bottom > pr.bottom) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
$('edit').addEventListener('focusin', (e) => { const card = e.target.closest('.blk'); if (card && S.sel.type === 'project') focusBlock(card.id.slice(4)); });

// ── edits ──
function markDirty(key) {
  S.dirty.add(key); setSave();
  store.set('studio.unsaved.' + key, docOf(key));
  clearTimeout(S.timers[key]); S.timers[key] = setTimeout(() => save(key), 700);
}
function setSave() {
  const el = $('save'), n = S.dirty.size + S.saving.size;
  el.classList.toggle('bad', Object.keys(S.conflicts).length > 0);
  el.textContent = Object.keys(S.conflicts).length ? 'needs your decision ↓' : n ? 'saving…' : 'all saved';
}
async function save(key) {
  if (S.conflicts[key]) return;
  if (S.saving.has(key)) { S.timers[key] = setTimeout(() => save(key), 300); return; }
  S.saving.add(key); S.dirty.delete(key); setSave();
  const url = key === '_studio' ? '/api/studio' : `/api/project/${key}`;
  const r = await api(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: docOf(key), base: S.hashes[key] }) }).catch(() => ({ ok: false, j: { error: 'The Studio server is not answering.' } }));
  S.saving.delete(key);
  if (r.status === 409) { S.conflicts[key] = { kind: 'remote', data: r.j.data, hash: r.j.hash }; renderEditor(); }
  else if (!r.ok) { S.dirty.add(key); toast(r.j.error || 'Save failed', true); S.timers[key] = setTimeout(() => save(key), 5000); }
  else { S.hashes[key] = r.j.hash; if (!S.dirty.has(key)) store.del('studio.unsaved.' + key); }
  setSave();
}
async function poll() {
  const r = await api('/api/hashes').catch(() => null); if (!r?.ok) { $('save').textContent = 'server not answering'; $('save').classList.add('bad'); return; }
  let redraw = false;
  for (const [key, h] of Object.entries(r.j)) {
    if (h === S.hashes[key] || S.saving.has(key)) continue;
    if (S.dirty.has(key)) continue;                                   // our save will get the 409 and ask
    const d = await api(key === '_studio' ? '/api/state' : `/api/project/${key}`);
    if (!d.ok) continue;
    if (key === '_studio') { S.studio = d.j.studio; S.hashes._studio = d.j.hashes._studio; }
    else { const isNew = !S.projects[key]; S.projects[key] = d.j.data; S.hashes[key] = d.j.hash; toast(isNew ? `New project: ${d.j.data.name}` : `Claude updated ${d.j.data.name}`); }
    redraw = true;
  }
  for (const key of Object.keys(S.projects)) if (!(key in r.j)) { delete S.projects[key]; redraw = true; }
  if (redraw) { renderSide(); renderEditor(); renderPreview(); }
}
addEventListener('beforeunload', (e) => { if (S.dirty.size || S.saving.size) { e.preventDefault(); e.returnValue = ''; } });
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); [...S.dirty].forEach((k) => { clearTimeout(S.timers[k]); save(k); }); toast('Saved'); }
  if (e.key === 'Escape') document.querySelector('.modal')?.remove();
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-k]'); if (!el || el.closest('.modal')) return;
  const key = el.closest('[data-doc]')?.dataset.doc; if (!key || !docOf(key)) return;
  setPath(docOf(key), el.dataset.k, el.type === 'checkbox' ? el.checked : el.value);
  markDirty(key);
  if (el.dataset.side) renderSide();
  if (el.dataset.rerender) renderEditor();
  if (S.sel.type === 'inbox' && el.dataset.k.includes('.questions.')) renderSide();
  schedulePreview();
});

function arr(doc, path) { let a = getPath(doc, path); if (!Array.isArray(a)) { a = []; setPath(doc, path, a); } return a; }
function newBlockId(p, stage) {
  const ids = new Set((p.blocks || []).map((b) => b.id));
  let base = stage || 'block', id = base, n = 2;
  while (ids.has(id)) id = `${base}-${n++}`;
  return id;
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b || b.closest('.modal')) return;
  const act = b.dataset.act, key = b.closest('[data-doc]')?.dataset.doc || (S.sel.type === 'project' ? S.sel.id : '_studio');
  const doc = docOf(key), p = S.sel.type === 'project' ? S.projects[S.sel.id] : null, i = +b.dataset.i, j = +b.dataset.j;
  const done = (full = true) => { markDirty(key); if (full) renderEditor(); renderSide(); schedulePreview(); };
  switch (act) {
    case 'layout': p.blocks[i].layout = b.dataset.v; return done();
    case 'ok': p.blocks[i].ok = !p.blocks[i].ok; return done();
    case 'up': case 'down': { const k = act === 'up' ? i - 1 : i + 1; if (k < 0 || k >= p.blocks.length) return; [p.blocks[i], p.blocks[k]] = [p.blocks[k], p.blocks[i]]; return done(); }
    case 'del': if (!confirm('Delete this block? (Claude keeps its draft in the save history.)')) return; p.blocks.splice(i, 1); return done();
    case 'draft': { const id = p.blocks[i].id; S.showDraft.has(id) ? S.showDraft.delete(id) : S.showDraft.add(id); return renderEditor(); }
    case 'revert': if (!confirm("Put Claude's draft back? Your version of this block is replaced.")) return; p.blocks[i].text = p.blocks[i].draft; return done();
    case 'mdel': p.blocks[i].media.splice(j, 1); return done();
    case 'mmove': { const m = p.blocks[i].media, k = j + +b.dataset.d; if (k < 0 || k >= m.length) return; [m[j], m[k]] = [m[k], m[j]]; return done(); }
    case 'vdel': p.vision.refs.splice(j, 1); return done();
    case 'add-block': {
      const stage = b.dataset.stage, tpl = S.studio.templates[p.template], order = tpl.stages.map((s) => s.key);
      const nb = stage === '__quote' ? { id: newBlockId(p, 'quote'), stage: '', title: '', text: '', layout: 'quote', media: [] }
        : { id: newBlockId(p, stage), stage, title: '', text: '', layout: 'text', media: [] };
      let at = p.blocks.length;
      if (stage && stage !== '__quote') { const want = order.indexOf(stage); at = p.blocks.findIndex((x) => order.indexOf(x.stage) > want); if (at < 0) at = p.blocks.length; }
      p.blocks.splice(at, 0, nb); done();
      setTimeout(() => { const c = $('edit').querySelector(`#blk-${CSS.escape(nb.id)}`); c?.scrollIntoView({ behavior: 'smooth', block: 'center' }); c?.querySelector('textarea')?.focus({ preventScroll: true }); }, 50);
      return;
    }
    case 'arr-del': { if (b.dataset.confirm && !confirm(b.dataset.confirm)) return; arr(doc, b.dataset.k).splice(j, 1); return done(); }
    case 'arr-move': { const a = arr(doc, b.dataset.k), k = j + +b.dataset.d; if (k < 0 || k >= a.length) return; [a[j], a[k]] = [a[k], a[j]]; return done(); }
    case 'sugg-yes': { const f = S.studio.floors[+b.dataset.fi], id = f.suggest[j]; f.suggest.splice(j, 1); if (!(f.software ||= []).includes(id)) f.software.push(id); return done(); }
    case 'feat': { const a = arr(S.studio, b.dataset.arr), id = b.dataset.id, k = a.indexOf(id); k >= 0 ? a.splice(k, 1) : a.push(id); markDirty('_studio'); renderEditor(); return; }
    case 'sw-add': {
      const name = $('sw-name').value.trim(); if (!name) return;
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
      if (S.studio.software.some((s) => s.id === id)) return toast('Already in the list', true);
      S.studio.software.push({ id, name, group: $('sw-group').value, abbr: $('sw-abbr').value.trim() || name.slice(0, 2) }); markDirty('_studio'); renderEditor(); return;
    }
    case 'stage-add': {
      const t = S.studio.templates[b.dataset.t], label = prompt('Stage name'); if (!label) return;
      let k = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'stage'; while (t.stages.some((s) => s.key === k)) k += '-2';
      t.stages.push({ key: k, label, hint: '' }); markDirty('_studio'); renderEditor(); return;
    }
    case 'log-add': { const v = $('log-new').value.trim(); if (!v) return; (p.log ||= []).push({ by: 'kay', at: today(), text: v }); return done(); }
    case 'pick-software': return pickIds('software', b.dataset.target ? [S.studio, b.dataset.target, '_studio'] : [p, 'software', p.slug]);
    case 'pick-classes': return pickIds('classes', b.dataset.target ? [S.studio, b.dataset.target, '_studio'] : [p, 'classes', p.slug]);
    case 'pick-skills': return pickSkills(p);
    case 'pick-pics': return pickPictures(p, i);
    case 'new-project': e.preventDefault(); return newProject();
    case 'cf-theirs': { const c = S.conflicts[b.dataset.key]; delete S.conflicts[b.dataset.key]; if (b.dataset.key === '_studio') { const st = await api('/api/state'); S.studio = st.j.studio; S.hashes._studio = st.j.hashes._studio; } else { S.projects[b.dataset.key] = c.data; S.hashes[b.dataset.key] = c.hash; } store.del('studio.unsaved.' + b.dataset.key); renderSide(); renderEditor(); renderPreview(); setSave(); return; }
    case 'cf-mine': { const k = b.dataset.key, c = S.conflicts[k]; delete S.conflicts[k]; if (c.kind === 'local') { if (k === '_studio') S.studio = c.data; else S.projects[k] = c.data; } else S.hashes[k] = c.hash; markDirty(k); renderEditor(); renderPreview(); return; }
    case 'cf-drop': { delete S.conflicts[b.dataset.key]; store.del('studio.unsaved.' + b.dataset.key); renderEditor(); setSave(); return; }
  }
});
document.addEventListener('keydown', (e) => {
  const el = e.target.closest?.('[data-act-enter]'); if (!el || e.key !== 'Enter') return;
  const v = el.value.trim(); if (!v) return;
  if (el.dataset.actEnter === 'skill-add') { (S.studio.skills[el.dataset.cat] ||= []).push(v); markDirty('_studio'); renderEditor(); }
});
document.addEventListener('click', (e) => {                               // Inbox links jump to the block
  const a = e.target.closest('[data-goto]'); if (!a) return;
  const id = a.dataset.goto; setTimeout(() => { const c = $('edit').querySelector(`#blk-${CSS.escape(id)}`); c?.scrollIntoView({ block: 'center' }); if (c) focusBlock(id); }, 60);
});

// ── pictures: drop from Finder, or pick ──
function dropZone(e) { return e.target.closest?.('.media[data-drop]'); }
document.addEventListener('dragover', (e) => { const z = dropZone(e); if (!z) return; e.preventDefault(); z.classList.add('drag'); });
document.addEventListener('dragleave', (e) => { const z = dropZone(e); if (z && !z.contains(e.relatedTarget)) z.classList.remove('drag'); });
document.addEventListener('drop', async (e) => {
  const z = dropZone(e); if (!z) return; e.preventDefault(); z.classList.remove('drag');
  const p = S.projects[S.sel.id]; if (!p) return;
  const files = [...(e.dataTransfer?.files || [])]; if (!files.length) return;
  const vision = z.dataset.drop === 'vision', i = +z.dataset.drop;
  for (const f of files) {
    toast(`Adding ${f.name}…`, false, 1800);
    const r = await api(`/api/upload/${p.slug}${vision ? '?to=vision' : ''}`, { method: 'POST', headers: { 'X-Filename': encodeURIComponent(f.name) }, body: f });
    if (!r.ok) { toast(`${f.name}: ${r.j.error || 'upload failed'}`, true); continue; }
    if (vision) ((p.vision ||= {}).refs ||= []).push({ src: r.j.src, note: '' });
    else (p.blocks[i].media ||= []).push({ src: r.j.src, caption: '', kind: /sketch|draw/i.test(f.name) ? 'sketch' : /\.(mp4|mov|m4v|webm)$/i.test(f.name) ? 'still' : 'photo' });
  }
  delete S.pics[p.slug]; markDirty(p.slug); renderEditor(); schedulePreview();
});

function modal(title, bodyFn, { tools = '', foot = '' } = {}) {
  document.querySelector('.modal')?.remove();
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box"><div class="mh"><h3>${esc(title)}</h3><button class="ib" data-close>✕</button></div><div class="mt">${tools}</div><div class="mb"></div><div class="mf">${foot}<button class="btn dark" data-close>Done</button></div></div>`;
  const draw = () => { m.querySelector('.mb').innerHTML = bodyFn(m.querySelector('.mt input')?.value || ''); };
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
  m.addEventListener('input', (e) => { if (e.target.closest('.mt')) draw(); });
  document.body.append(m); draw(); m.querySelector('.mt input')?.focus();
  return { m, draw };
}

function pickIds(kind, [doc, path, key]) {
  const list = arr(doc, path);
  const body = (q) => {
    q = q.toLowerCase();
    if (kind === 'software') {
      return Object.entries(S.studio.softwareGroups).map(([g, name]) => {
        const items = S.studio.software.filter((s) => s.group === g && (!q || s.name.toLowerCase().includes(q)));
        return items.length ? `<p class="k grp">${esc(name)}</p><div class="pick">${items.map((s) => `<button data-id="${esc(s.id)}" class="${list.includes(s.id) ? 'on' : ''}"><span class="ic">${toolIcon(s, S.icons)}</span>${esc(s.name)}</button>`).join('')}</div>` : '';
      }).join('');
    }
    let term = '', h = '';
    for (const c of S.studio.classes) {
      if (q && !`${c.code} ${c.title} ${c.topic || ''}`.toLowerCase().includes(q)) continue;
      if (c.term !== term) { h += `${term ? '</div>' : ''}<p class="k grp">${esc(c.term)}</p><div class="pick">`; term = c.term; }
      h += `<button data-id="${esc(c.id)}" class="${list.includes(c.id) ? 'on' : ''}"><small>${esc(c.code)}</small>${esc(c.topic || c.title)}</button>`;
    }
    return h + (term ? '</div>' : '');
  };
  const { m, draw } = modal(kind === 'software' ? 'Software' : 'Classes', body, { tools: '<input placeholder="Filter…">' });
  m.querySelector('.mb').addEventListener('click', (e) => {
    const id = e.target.closest('[data-id]')?.dataset.id; if (!id) return;
    const k = list.indexOf(id); k >= 0 ? list.splice(k, 1) : list.push(id);
    markDirty(key); draw(); renderEditor(); schedulePreview();
  });
}

function pickSkills(p) {
  const list = (p.skills ||= []);
  const body = (q) => Object.entries(S.studio.skills).map(([cat, names]) => {
    const items = names.filter((n) => !q || n.toLowerCase().includes(q.toLowerCase()));
    return items.length ? `<p class="k grp">${esc(cat)}</p><div class="pick">${items.map((n) => `<button data-n="${esc(n)}" class="${list.some((s) => s.name === n) ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>` : '';
  }).join('');
  const { m, draw } = modal('Skills', body, { tools: '<input placeholder="Filter…">', foot: '<span class="hint" style="margin-right:auto">Missing one? Add it in Library → Skills.</span>' });
  m.querySelector('.mb').addEventListener('click', (e) => {
    const n = e.target.closest('[data-n]')?.dataset.n; if (!n) return;
    const k = list.findIndex((s) => s.name === n); k >= 0 ? list.splice(k, 1) : list.push({ name: n, evidence: '' });
    markDirty(p.slug); draw(); renderEditor(); schedulePreview();
  });
}

async function pickPictures(p, i) {
  const block = p.blocks[i]; block.media ||= [];
  if (!S.pics[p.slug]) { const r = await api(`/api/pictures/${p.slug}`); S.pics[p.slug] = r.ok ? r.j : { used: [], candidates: [] }; }
  const tile = (x, cand) => { const on = block.media.some((m) => m.src === x.src); const v = /\.(mp4|webm)$/i.test(x.src);
    return `<button class="p ${on ? 'on' : ''}" data-src="${esc(x.src)}" data-cand="${cand ? 1 : ''}"><div class="th">${v ? `<video src="/${esc(x.src)}" muted></video>` : `<img src="/${esc(x.src)}" alt="" loading="lazy">`}</div><span>${/^private/i.test(x.name) ? '<b style="color:var(--ask)">PRIVATE · client data</b> ' : ''}${esc(x.name)}</span></button>`; };
  const body = () => { const P = S.pics[p.slug];
    return `<p class="k grp">On the site already · assets/projects/${esc(p.slug)}/</p>${P.used.length ? `<div class="pgrid">${P.used.map((x) => tile(x, false)).join('')}</div>` : '<p class="empty">None yet.</p>'}
      <p class="k grp">Pulled from your Drive by Claude · not on the site until you pick them</p>${P.candidates.length ? `<div class="pgrid">${P.candidates.map((x) => tile(x, true)).join('')}</div>` : '<p class="empty">None.</p>'}`; };
  const { m, draw } = modal(`Pictures for “${block.title || stagesOf(p, S.studio)[block.stage]?.label || 'this block'}”`, body, { foot: '<span class="hint" style="margin-right:auto">Click to add or remove. You can also drop files from Finder straight onto a block.</span>' });
  m.querySelector('.mb').addEventListener('click', async (e) => {
    const t = e.target.closest('[data-src]'); if (!t) return;
    let src = t.dataset.src;
    const k = block.media.findIndex((x) => x.src === src);
    if (k >= 0) block.media.splice(k, 1);
    else {
      if (t.dataset.cand) { const r = await api(`/api/promote/${p.slug}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ src }) }); if (!r.ok) return toast(r.j.error, true); src = r.j.src; delete S.pics[p.slug]; S.pics[p.slug] = (await api(`/api/pictures/${p.slug}`)).j; }
      if (!block.media.some((x) => x.src === src)) block.media.push({ src, caption: '', kind: /sketch/i.test(src) ? 'sketch' : 'photo' });
    }
    markDirty(p.slug); draw(); renderEditor(); schedulePreview();
  });
}

async function newProject() {
  const name = prompt('Project name'); if (!name) return;
  let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'project';
  while (S.projects[slug]) slug += '-2';
  const tpl = S.studio.templates.engineering;
  S.projects[slug] = { slug, name, floor: 'backlog', onSite: false, template: 'engineering', status: 'draft', oneLiner: '', context: {}, software: [], skills: [], classes: [], cover: '',
    blocks: tpl.stages.map((s) => ({ id: s.key, stage: s.key, title: '', text: '', layout: 'text', media: [] })), log: [{ by: 'kay', at: today(), text: 'New project.' }] };
  S.hashes[slug] = null; markDirty(slug); location.hash = `#p/${slug}`;
}

boot();
