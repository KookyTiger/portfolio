// ─────────────────────────────────────────────────────────────
// KookyTiger Studio — Kay edits the write-ups here; Claude reads (and writes) the same data.
// Two homes (backend.js): on this Mac the Python server (server.py); anywhere else GitHub, signed in with Kay's token.
// Every edit autosaves; a save made on top of an older version is refused (409) so nobody overwrites anybody.
// Approving a write-up publishes it to the site.
// ─────────────────────────────────────────────────────────────
import { renderWriteup, renderFloorBand, toolIcon, stagesOf, wuView } from '../writeup-view.js';
import { LocalBackend, GitHubBackend } from './backend.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const words = (s) => (String(s || '').trim().match(/\S+/g) || []).length;
const today = () => new Date().toISOString().slice(0, 10);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
                set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };

const S = { studio: null, projects: {}, hashes: {}, icons: {}, sel: { type: 'inbox' }, dirty: new Set(), saving: new Set(), timers: {},
            showDraft: new Set(), focusBlock: null, pvMode: store.get('studio.pv', 'panel'), pvView: 'brief', conflicts: {}, pics: {},
            siteDirty: false, pvSite: { dev: 'desktop', hover: false, s: 0, ...store.get('studio.pvsite', {}) } };
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
const docOf = (key) => (key === '_studio' ? S.studio : key === '_site' ? S.site : S.projects[key]);
let B = null;                                                          // the backend: LocalBackend | GitHubBackend
const pic = (src) => (B ? B.picURL(src) : '');
let redrawTimer = 0;
const redrawSoon = () => { clearTimeout(redrawTimer); redrawTimer = setTimeout(() => { renderEditor(); renderPreview(); }, 250); };

function toast(msg, bad = false, ms = 3200) {
  const t = document.createElement('div'); t.className = 't' + (bad ? ' bad' : ''); t.textContent = msg;
  $('toast').append(t); setTimeout(() => t.remove(), ms);
}

// ── load ──
async function boot() {
  if (await LocalBackend.detect()) B = new LocalBackend();
  else {
    const token = store.get('studio.gh', null);
    if (!token) return loginView();
    B = new GitHubBackend(token, redrawSoon);
  }
  document.body.dataset.mode = B.mode;
  $('save').textContent = B.mode === 'github' ? 'loading from GitHub…' : 'loading…';
  let st;
  try { st = await B.load(); }
  catch (e) {
    if (B.mode === 'github' && [401, 403, 404].includes(e.status)) { store.del('studio.gh'); return loginView('GitHub refused that token (' + e.message + '). Make a new one below.'); }
    $('edit').innerHTML = `<h1>Studio can't load</h1><p class="lead">${esc(e.message)}</p>`; return;
  }
  const ic = await fetch('../vendor/tool-icons.json').then((r) => r.json()).catch(() => ({}));
  S.studio = st.studio; S.projects = st.projects; S.site = st.site || {}; S.hashes = st.hashes; S.icons = ic.icons || {};
  if (B.mode === 'github') GitHubBackend.checkWrite(B.gh).catch((e) => {       // a read-only token would lose every save: say so now
    S.writeProblem = e.message; renderEditor(); setSave();
  });
  $('tb-site').href = B.siteURL();
  $('tb-publish').hidden = B.mode !== 'github';
  $('tb-out').hidden = B.mode !== 'github';
  // edits that never reached the server (it was down, the tab closed mid-save)
  for (const key of [...Object.keys(S.projects), '_studio', '_site']) {
    const saved = store.get('studio.unsaved.' + key);
    if (saved && JSON.stringify(saved) !== JSON.stringify(docOf(key))) {
      if (key === '_site') { S.site = saved; S.siteDirty = true; }      // site text waits for Publish: pick up where she left off
      else S.conflicts[key] = { kind: 'local', data: saved };
    } else store.del('studio.unsaved.' + key);
  }
  route(); setSave();
  setInterval(poll, B.mode === 'github' ? 20000 : 4000);
}

// the online Studio signs in with a GitHub token that stays in this browser
function loginView(msg = '') {
  document.body.classList.add('login');
  $('save').textContent = '';
  $('edit').innerHTML = `<div class="login-box">
    <h1>Connect to GitHub</h1>
    <p class="lead">The online Studio saves straight to your GitHub: drafts and notes to the private repo <code>portfolio-studio-private</code>, approved write-ups to <code>portfolio</code> (the site rebuilds itself). It needs a token from you, once per browser. The token stays in this browser — nothing else ever sees it.</p>
    ${msg ? `<div class="banner">${esc(msg)}</div>` : ''}
    <ol class="lead">
      <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Settings → Fine-grained tokens → Generate new token</a>.</li>
      <li>Name it <b>KookyTiger Studio</b>; pick an expiration (up to a year).</li>
      <li>Repository access → <b>Only select repositories</b> → <code>portfolio</code> and <code>portfolio-studio-private</code>.</li>
      <li>Permissions → Repository permissions → <b>Contents: Read and write</b>. Nothing else.</li>
      <li>Generate, copy it, paste it here.</li>
    </ol>
    <div class="row"><input id="gh-token" type="password" autocomplete="off" placeholder="github_pat_…" style="max-width:460px"><button class="btn dark" id="gh-go">Connect</button></div>
    <p class="hint" style="margin-top:10px">On your Mac you can also double-click <code>merge/studio/Open Studio.command</code> — the local Studio needs no token.</p>
  </div>`;
  $('gh-go').onclick = async () => {
    const t = $('gh-token').value.trim(); if (!t) return;
    $('gh-go').disabled = true; $('gh-go').textContent = 'Checking…';
    try { const who = await GitHubBackend.connect(t); store.set('studio.gh', t); toast(`Connected as ${who}`); setTimeout(() => location.reload(), 500); }
    catch (e) { $('gh-go').disabled = false; $('gh-go').textContent = 'Connect'; toast(`GitHub said: ${e.message}. Check the repositories and the Contents permission.`, true, 6000); }
  };
}


// ── routing: #p/<slug> #f/<floor> #classes #software #skills #templates #notes #inbox #help ──
function route() {
  if (!S.studio) return;                                               // still signing in
  const h = decodeURIComponent(location.hash.slice(1));
  const [a, b] = h.split('/');
  if (a === 'p' && S.projects[b]) S.sel = { type: 'project', id: b };
  else if (a === 'f' && (S.studio.floors || []).some((f) => f.id === b)) S.sel = { type: 'floor', id: b };
  else if (['site', 'classes', 'software', 'skills', 'templates', 'notes', 'inbox', 'help'].includes(a)) S.sel = { type: a };
  else S.sel = { type: 'inbox' };
  S.focusBlock = null;
  document.body.classList.toggle('wide-edit', !['project', 'floor', 'site'].includes(S.sel.type));   // library pages use the full width
  renderSide(); renderEditor(true); renderPreview(true);
}
addEventListener('hashchange', route);

// ── sidebar ──
const onSiteOrder = () => {
  const fo = Object.fromEntries((S.studio.floors || []).map((f, i) => [f.id, i]));
  return Object.values(S.projects).filter((p) => p.onSite).sort((a, b) => (fo[a.floor] ?? 9) - (fo[b.floor] ?? 9) || (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
};
// what the site shows (app.js → applyLineup): ● Approved + on the site, by floor, then `order`, then name
const siteLineup = () => {
  const fo = Object.fromEntries((S.studio.floors || []).map((f, i) => [f.id, i]));
  return Object.values(S.projects).filter((p) => p.status === 'approved' && p.onSite && p.floor in fo)
    .sort((a, b) => fo[a.floor] - fo[b.floor] || (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name)));
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
  h += `<h4 class="k">The site</h4><a class="${on('site')}" href="#site"><span class="nm">Site text · cards, floors, about me</span></a>`;
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
    : t === 'help' ? helpView() : t === 'site' ? siteEditor() : inboxView();
  ed.scrollTop = keep;
  if (focusK) {
    const el = ed.querySelector(`[data-doc="${focusK.doc}"] [data-k="${CSS.escape(focusK.k)}"], [data-doc="${focusK.doc}"][data-k="${CSS.escape(focusK.k)}"]`);
    if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(focusK.s, focusK.e); } catch {} }
  }
  if (S.focusBlock) ed.querySelector(`#blk-${CSS.escape(S.focusBlock)}`)?.classList.add('focus');
}

function conflictBanner(key) {
  const w = S.writeProblem ? `<div class="banner"><b>Your edits are NOT reaching GitHub.</b> ${esc(S.writeProblem)} They're kept in this browser and will save once the token works.<span class="sp"></span><a class="btn sm" href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">Edit the token ↗</a><button class="btn sm dark" data-act="reconnect">Reconnect</button></div>` : '';
  const c = S.conflicts[key]; if (!c) return w;
  if (c.kind === 'local') return w + `<div class="banner"><b>Unsaved edits from last time.</b> They never reached the files (the Studio server was off?).<span class="sp"></span><button class="btn sm dark" data-act="cf-mine" data-key="${key}">Use my edits</button><button class="btn sm" data-act="cf-drop" data-key="${key}">Throw them away</button></div>`;
  return w + `<div class="banner"><b>Claude changed this while you were editing.</b> Your latest edits are not saved yet.<span class="sp"></span><button class="btn sm" data-act="cf-theirs" data-key="${key}">Load Claude's version</button><button class="btn sm dark" data-act="cf-mine" data-key="${key}">Keep mine (overwrite)</button></div>`;
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
      ${p.onSite && p.floor && p.floor !== 'backlog' ? `<span class="row" style="gap:0" title="Move it earlier or later on its floor (the site follows)"><button class="ib" data-act="ord" data-d="-1" aria-label="Earlier on its floor">↑</button><button class="ib" data-act="ord" data-d="1" aria-label="Later on its floor">↓</button></span>` : ''}
      <label class="row" style="gap:5px;font-size:13px"><input type="checkbox" data-k="onSite" data-side="1" data-rerender="1" ${p.onSite ? 'checked' : ''}> on the site</label>
      <select data-k="template" data-rerender="1" style="width:auto" title="Process template">${optionList(Object.entries(lib.templates).map(([k, t]) => [k, t.name]), p.template)}</select>
      <span class="sp" style="flex:1"></span>
      ${drive.folder ? `<a class="btn sm ghost" href="https://drive.google.com/drive/folders/${esc(drive.folder)}" target="_blank" rel="noopener">Drive folder ↗</a>` : drive.path ? `<span class="hint">Drive: ${esc(drive.path)}</span>` : ''}
      <a class="btn sm ghost" href="${esc(B.sourcesURL(p.slug))}" target="_blank" rel="noopener" title="Claude's notes on the Drive sources (private)">Source notes ↗</a>
    </div>
    <input class="name" data-k="name" data-side="1" value="${esc(p.name || '')}" placeholder="Project name">
    ${cardEditor(p)}
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
    <div class="sec"><span class="k">Cover (the cut-out on the site)</span><div class="row"><input data-k="cover" value="${esc(p.cover || '')}" style="max-width:420px">${p.cover ? `<img src="${esc(pic(p.cover))}" alt="" style="height:44px">` : ''}</div></div>
    <div class="sec brief-ed"><span class="k">The short version — what the panel opens on (about 30 seconds); a tab leads to the whole process below</span>
      <div class="grid3">
        <label class="f"><span>Problem</span><textarea data-k="brief.problem" rows="4" placeholder="What was wrong, for whom — one or two sentences.">${esc(p.brief?.problem || '')}</textarea></label>
        <label class="f"><span>Solution</span><textarea data-k="brief.solution" rows="4" placeholder="What you made and how it answers the problem.">${esc(p.brief?.solution || '')}</textarea></label>
        <label class="f"><span>Impact</span><textarea data-k="brief.impact" rows="4" placeholder="What it did: the numbers, the test, what changed.">${esc(p.brief?.impact || '')}</textarea></label>
      </div>
      <p class="hint" style="margin:6px 0 0">The tools shown with it are “Software I used” above. Nothing new goes here: the short version only repeats what the blocks say. Empty = the panel opens straight on the whole process.</p>
    </div>
    ${legacy}
    <div class="sec"><span class="k">The page, block by block — ${esc(tpl.name || p.template)}</span>
      ${(() => { let n = 0; return (p.blocks || []).map((b, i) => blockCard(p, b, i, stages, tpl, b.layout !== 'quote' && stages[b.stage] ? ++n : null)).join(''); })()}
      <div class="addblk">${addBtns}<button class="add" data-act="add-block" data-stage="__quote">＋ Quote</button><button class="add" data-act="add-block" data-stage="">＋ Free block</button></div>
    </div>
    <div class="sec"><span class="k">Vision — show Claude what you imagine for this page (private)</span>
      <textarea data-k="vision.note" rows="3" placeholder="Anything: a mood, a site you like, 'the sketches should feel like a wall of post-its', what to cut…">${esc(p.vision?.note || '')}</textarea>
      <div class="media" data-drop="vision">${(p.vision?.refs || []).map((m, j) => `<div class="m"><div class="th"><img src="${esc(pic(m.src))}" alt=""><div class="tools"><button data-act="vdel" data-j="${j}" title="Remove">✕</button></div></div><input data-k="vision.refs.${j}.note" value="${esc(m.note || '')}" placeholder="What about it?"></div>`).join('')}
        <div class="drop">Drop reference pictures, screenshots or a photo of a hand-drawn layout</div></div>
    </div>
    <div class="sec"><span class="k">Log — what changed and why</span>
      <div class="log">${(p.log || []).map((e) => `<div class="e ${esc(e.by)}"><span class="who">${esc(e.by)} · ${esc(String(e.at || '').slice(5))}</span><span>${esc(e.text)}</span></div>`).join('') || '<p class="empty">Nothing yet.</p>'}</div>
      <div class="row" style="margin-top:8px;align-items:flex-start"><textarea id="log-new" rows="2" placeholder="Tell Claude something about this project…" style="flex:1"></textarea><button class="btn dark" data-act="log-add">Add</button></div>
    </div>
  </div>`;
}

function blockCard(p, b, i, stages, tpl, seq) {
  const st = stages[b.stage];
  const num = b.layout === 'quote' ? '❝' : seq ? String(seq).padStart(2, '0') : '··';   // same numbers as the page: by position
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
  return `<div class="m"><div class="th">${video ? `<video src="${esc(pic(m.src))}" muted></video>` : `<img src="${esc(pic(m.src))}" alt="" loading="lazy">`}
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

const lines = (v) => esc(Array.isArray(v) ? v.join('\n') : v || '');
const pages = (v) => esc((v || []).map((pg) => pg.join('\n')).join('\n\n'));
const liveNote = () => 'Nothing here goes live until you press Publish site text in the top bar; the Site text page shows it in the real site first.';

// the card: what a project shows on the site before it's opened
const cardOf = (p) => ({ name: p.name || '', category: '', year: (String(p.context?.when || '').match(/\d{4}/) || [''])[0], desc: p.oneLiner || '', take: '', tags: '', ...(S.site?.cards?.[p.slug] || {}) });
function cardPv(p, c) {
  const L = siteLineup(), i = L.indexOf(p);
  return `<p class="k"><span>${i >= 0 ? String(i + 1).padStart(2, '0') : '—'} / ${L.length}</span> ${esc(c.category)} ${esc(c.year)}</p><b>${esc(c.name)}</b><p>${esc(c.desc)}</p><p class="tk">${esc(c.take)}</p><p class="k">Open ↗</p>`;
}
function cardEditor(p) {
  if (!S.site?.cards?.[p.slug] && !p.onSite) return '';
  const c = cardOf(p), live = siteLineup().includes(p);
  const note = live ? '' : `<p class="hint" style="margin:6px 0 0">Not on the site yet: a project stands on its floor once it is ● Approved and ticked “on the site”.</p>`;
  const k = (f) => `cards.${p.slug}.${f}`;
  return `<div class="sec card-ed" data-doc="_site"><span class="k">The card — what the site shows before it's opened · ${liveNote()}</span>${note}
    <div class="card-pv">${cardPv(p, c)}</div>
    <div class="grid3"><label class="f"><span>Name on the card</span><input data-k="${k('name')}" value="${esc(c.name)}"></label>
      <label class="f"><span>Category</span><input data-k="${k('category')}" value="${esc(c.category)}"></label>
      <label class="f"><span>Year</span><input data-k="${k('year')}" value="${esc(c.year)}"></label></div>
    <label class="f" style="margin-top:8px"><span>Line 1 — what it is</span><textarea data-k="${k('desc')}" rows="2">${esc(c.desc)}</textarea></label>
    <label class="f" style="margin-top:8px"><span>Line 2 — the take (grey, shorter)</span><textarea data-k="${k('take')}" rows="2">${esc(c.take)}</textarea></label>
    <label class="f" style="margin-top:8px"><span>Tags (in the panel header), separated by ·</span><input data-k="${k('tags')}" value="${esc(c.tags)}"></label></div>`;
}

const SITE_FIELDS = [
  ['About me — the dialogue box', [['copy.intro.name', 'Name on the box'], ['copy.intro.sub', 'Line under the name'], ['copy.intro.who', 'Label on your lines'], ['copy.intro.you', 'Label on the visitor\'s lines'], ['copy.intro.photo', 'Portrait (a path under assets/)'],
    ['copy.intro.script', 'The dialogue. "# id" starts a node; its lines are what you say (a blank line = a new paragraph; "@ Say hi ↗" = the email link). "> question -> id" is a choice. ">? 58 | [SKILL — Medium] question -> id | what the skill says when the dice fail" is a dice check (the number = the chance). "* hub" adds the start questions not asked yet (a node with no choices gets them). Keep "start"; "> Start over -> start" wipes the log.', 'text', 28]]],
  ['Opening & header', [['copy.entry.dark', 'Opening: the line in the dark after the tiger\'s hello'], ['copy.header.statement', 'Header statement, one line per line', 'lines', 2], ['copy.header.scroll', 'Scroll hint']]],
  ['Hero', [['copy.hero.words', 'The big words, one per line', 'lines', 3], ['copy.hero.reveal', 'What each big word turns into on hover, one per line (long lines shrink to fit)', 'lines', 3], ['copy.hero.indication', 'Small line under them'], ['copy.hero.left', 'Top-left corner, one line per line', 'lines', 2], ['copy.hero.right', 'Top-right corner, one line per line', 'lines', 2]]],
  ['Top bar', [['copy.nav.name', 'Name'], ['copy.nav.sub', 'Under the name'], ['copy.nav.tagline', 'Tagline'], ['copy.nav.links', 'Links (Work / About / Archives), one per line', 'lines', 3]]],
  ['The landing — the other shore', [['copy.shore.words', 'Big words, one per line', 'lines', 2], ['copy.shore.sub', 'Under them'], ['copy.shore.sayhi', 'Link'], ['copy.shore.tiger', 'What the tiger says'], ['copy.talents.hint', 'Talent-show hint'], ['copy.talents.trigger', 'Talent-show button'], ['copy.talents.title', 'Talent-show title']]],
  ['Archives & footer', [['copy.archives.title', 'Archives title'], ['copy.archives.note', 'Archives note'], ['copy.footer.words', 'Footer big words, one per line', 'lines', 3], ['copy.footer.sayhi', 'Footer link'], ['copy.footer.email', 'Email'], ['copy.footer.bottom', 'Bottom line, one part per line', 'lines', 3]]],
  ['Small labels', [['copy.cursor.tiger', 'Cursor over the tiger'], ['copy.cursor.card', 'Cursor over a project'], ['copy.panel.ask', 'Link at the end of a project'], ['copy.panel.brief', 'Project tab: the short version'], ['copy.panel.full', 'Project tab: the whole process'], ['copy.panel.more', 'Link under the short version'], ['copy.panel.problem', 'Short version: label 1'], ['copy.panel.solution', 'Short version: label 2'], ['copy.panel.impact', 'Short version: label 3'], ['copy.panel.tools', 'Short version: label 4'], ['copy.panel.resize', 'Cursor on the panel’s edge'], ['copy.section.projects', 'Word after the project count on a floor title']]],
];
// Type: the five kinds of big display words on the site (app.js → applyType turns these into CSS variables)
const TYPE = [['hero', 'Hero words (KAY / ZISHU / TU)', 'hero'], ['titles', 'Floor titles', 'title0'], ['values', 'Floor statements (the quotes)', 'value0'], ['shore', 'The other shore', 'shore'], ['footer', 'Footer words', 'footer']];
const WEIGHTS = [[400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold']];
function typeEditor(t) {
  const st = t.style || {};
  const row = ([g, label, to]) => { const v = st[g] || {}, size = v.size ?? 100, w = +(v.weight ?? 800);
    return `<tr data-goto="${to}"><td>${esc(label)}</td>
      <td class="sz"><input type="range" min="50" max="130" step="5" data-k="style.${g}.size" data-fmt="num" value="${size}"><span class="n">${size}%</span></td>
      <td><select data-k="style.${g}.weight" data-fmt="num">${WEIGHTS.map(([x, l]) => `<option value="${x}" ${x === w ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><select data-k="style.${g}.case">${optionList([['upper', 'CAPITALS'], ['none', 'As typed']], v.case || 'upper')}</select></td>
      <td style="width:34px"><button class="ib" data-act="type-reset" data-g="${g}" title="Back to the original look">↺</button></td></tr>`; };
  return `<div class="sec"><span class="k">Type — how big, how bold, capitals or not</span>
    <p class="hint">"As typed" shows the words exactly as you type them, so retype a line in lower case to see it that way. ↺ puts a row back to how the site looks today.</p>
    <table class="lib type"><tr><th>Words</th><th>Size</th><th>Weight</th><th>Case</th><th></th></tr>${TYPE.map(row).join('')}</table></div>`;
}
function siteBar() {
  if (!S.siteDirty) return `<div class="banner calm">You're looking at what's on the site. Change anything and try it in the preview on the right — it goes live only when you press <b>Publish site text</b>.</div>`;
  return `<div class="banner try"><b>Trying things out.</b> Only you see this, in the preview. Nothing is on the site yet.<span class="sp"></span><button class="btn sm" data-act="site-discard">Discard my changes</button><button class="btn sm dark" data-act="site-publish">Publish site text</button></div>`;
}
function siteEditor() {
  const t = S.site || {}, get = (path) => path.split('.').reduce((a, k) => a?.[k], t);
  const field = ([path, label, fmt, rows]) => fmt ? `<label class="f"><span>${esc(label)}</span><textarea data-k="${path}" data-fmt="${fmt}" rows="${rows || 3}">${fmt === 'pages' ? pages(get(path)) : lines(get(path))}</textarea></label>`
    : `<label class="f"><span>${esc(label)}</span><input data-k="${path}" value="${esc(get(path) ?? '')}"></label>`;
  const floors = (t.sections || []).map((s, i) => `<div class="blk"><div class="bh"><span class="num">${esc(s.num)}</span><span class="k">Floor title band + its statement</span></div>
      <div class="grid2"><label class="f"><span>Title (" & " breaks the line)</span><input data-k="sections.${i}.title" value="${esc(s.title)}"></label><label class="f"><span>Subtitle</span><input data-k="sections.${i}.sub" value="${esc(s.sub)}"></label></div>
      <label class="f" style="margin-top:8px"><span>The big statement over the room (the "quote"), one line per line</span><textarea data-k="sections.${i}.value" data-fmt="lines" rows="4">${lines(s.value)}</textarea></label></div>`).join('');
  const arch = (t.archive || []).map((r, j) => `<tr><td><input data-k="archive.${j}.name" value="${esc(r.name)}"></td><td><input data-k="archive.${j}.line" value="${esc(r.line)}"></td><td><input data-k="archive.${j}.course" value="${esc(r.course)}"></td><td style="width:80px"><input data-k="archive.${j}.year" value="${esc(r.year)}"></td><td style="width:34px"><button class="ib" data-act="arr-del" data-k="archive" data-j="${j}" title="Remove">✕</button></td></tr>`).join('');
  return `<div data-doc="_site">${conflictBanner('_site')}
    <h1>Site text</h1><p class="lead">Every word on the site outside the write-ups. Each project's card is on its own page (top of the project). <code>{N}</code>, <code>{N_UP}</code>, <code>{N_CAP}</code> become the number of projects. Click into a field and the preview jumps to where it is on the site.</p>
    <div id="site-bar">${siteBar()}</div>
    ${typeEditor(t)}
    ${SITE_FIELDS.map(([title, fs]) => `<div class="sec"><span class="k">${esc(title)}</span><div class="grid2">${fs.map((f) => `<div style="${f[2] ? 'grid-column:1/-1' : ''}">${field(f)}</div>`).join('')}</div></div>`).join('')}
    <div class="sec"><span class="k">The three floors</span>${floors}</div>
    <div class="sec"><span class="k">Archives — small projects listed near the end</span><table class="lib"><tr><th>Name</th><th>Line</th><th>Course / where</th><th>Year</th><th></th></tr>${arch}</table><button class="add" data-act="arch-add" style="margin-top:8px">＋ row</button></div>
  </div>`;
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
    <p><b>Private vs public.</b> Everything you're working on — drafts, pictures, your notes, Claude's questions and sources — lives in the private repo <code>portfolio-studio-private</code>. Only what you approve reaches the public repo (and the site).</p>
    <p><b>Floors.</b> Each floor's title band can carry its software icons and classes — pick them on the floor's page; the preview shows the band at real size. The site doesn't use any of this yet: when you like the preview, tell Claude to wire it in.</p>
    <p><b>Two ways in.</b> Online at <code>kookytiger.github.io/portfolio/merge/studio/</code> from any computer or phone (sign in once per browser with your GitHub token; everything saves to GitHub). On your Mac, double-click <code>merge/studio/Open Studio.command</code> — the local Studio saves to the same private repo a few seconds later, so both always show the same drafts.</p>
    <p><b>Going live.</b> Set a project to <b>● Approved</b>: online, it's published right away (the write-up and its pictures go to the public repo and the site rebuilds in a minute or two); on your Mac, click <b>Publish</b> in the top bar. Set it back to Draft, or untick “on the site”, and it comes off the site.</p>
    <p><b>The lineup is yours.</b> The site shows exactly the projects that are ● Approved and ticked “on the site”, each on the floor you picked, in the order of the sidebar — move one with ↑ ↓ next to its floor. Its card (name, lines, year) is the one at the top of the project; until you edit it, the site builds it from the write-up. The floating object is its cut-out when Claude has made one, otherwise the cover.</p></div>`;
}

// ── preview ──
let pvTimer = 0;
const schedulePreview = () => { clearTimeout(pvTimer); pvTimer = setTimeout(() => renderPreview(), 140); };
function renderPreview(reset = false) {
  if (S.sel.type === 'site') return sitePreview();
  $('pv-mode').hidden = false;
  const pv = $('pv'), keep = reset ? 0 : pv.scrollTop, mode = S.pvMode;
  document.querySelectorAll('#pv-mode button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  const avail = Math.max(200, pv.clientWidth - 36);
  if (S.sel.type === 'project') {
    const p = S.projects[S.sel.id], order = siteLineup(), idx = order.indexOf(p);
    const W = mode === 'wide' ? 1200 : mode === 'phone' ? 390 : 860;
    $('pv-title').textContent = `${p.name} · ${mode === 'wide' ? 'wide panel 1200' : mode === 'phone' ? 'phone 390' : 'site panel 860'}`;
    pv.innerHTML = `<div class="pv-frame ${mode === 'phone' ? 'phone' : 'panel'}" style="width:${W}px;zoom:${Math.min(1, avail / W)}">${renderWriteup(p, S.studio, S.icons, { index: idx >= 0 ? idx + 1 : null, total: order.length, showEmpty: true, resolve: pic, view: S.pvView, labels: S.site?.copy?.panel })}</div>`;
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
// ── the site preview (Site text page): the real site in a frame, reading the text Kay is trying from this browser ──
// Every change reloads it into a second frame behind the first; the new one takes over once it has scrolled to the same place.
const SITE_DEV = { desktop: [1440, 900], phone: [390, 844] };
const siteTargets = () => [['header', 'Header'], ['hero', 'Hero'], ['intro', 'About me (the dialogue box)'],
  ...(S.site?.sections || []).flatMap((x, i) => [[`title${i}`, `${x.num} ${x.title} · title`], [`value${i}`, `${x.num} · its statement`]]),
  ['archives', 'Archives'], ['shore', 'The other shore'], ['footer', 'Footer']];
const siteTarget = (k) => { const m = /^sections\.(\d+)\.(\w+)/.exec(k || ''); if (m) return (m[2] === 'value' ? 'value' : 'title') + m[1];
  if (/^style\./.test(k)) return TYPE.find(([g]) => g === k.split('.')[1])?.[2];
  const c = /^copy\.(\w+)/.exec(k || '')?.[1];
  return c === 'intro' ? 'intro' : ['entry', 'header'].includes(c) ? 'header' : c === 'hero' ? 'hero' : ['shore', 'talents'].includes(c) ? 'shore'
    : c === 'footer' ? 'footer' : c === 'archives' || /^archive\./.test(k || '') ? 'archives' : null; };
const spFrames = () => [...document.querySelectorAll('#pv .sp-frame')];
const spPost = (f, m) => f?.contentWindow?.postMessage({ studio: 1, ...m }, location.origin);
function sitePreview() {
  const pv = $('pv'); $('pv-mode').hidden = true; $('pv-title').textContent = 'The site · your text';
  if (!pv.querySelector('.sp-wrap')) {
    pv.innerHTML = `<div class="sp-bar"><div class="seg" id="sp-dev"><button data-dev="desktop">Desktop</button><button data-dev="phone">Phone</button></div>
      <select id="sp-go" title="Jump to"><option value="">Jump to…</option></select>
      <label class="chk" title="Show the words that appear on hover (hero, project cards)"><input type="checkbox" id="sp-hover"> hover text</label>
      <button class="btn sm" id="sp-reload" title="Reload">↻</button><span class="sp-state" id="sp-state"></span></div>
      <div class="sp-wrap"><div class="sp-stage"></div></div>
      <p class="hint" style="margin-top:10px">Scroll inside it like the real site. It shows your unpublished text and type — only in this browser.</p>`;
    $('sp-dev').onclick = (e) => { const d = e.target.closest('button')?.dataset.dev; if (!d || d === S.pvSite.dev) return; S.pvSite.dev = d; store.set('studio.pvsite', S.pvSite); sitePreview(); loadSiteFrame(); };
    $('sp-go').onchange = (e) => { const t = e.target.value; e.target.value = ''; if (t) siteGoto(t); };
    $('sp-hover').onchange = (e) => { S.pvSite.hover = e.target.checked; store.set('studio.pvsite', S.pvSite); spFrames().forEach((f) => spPost(f, { type: 'hover', on: S.pvSite.hover })); };
    $('sp-reload').onclick = () => loadSiteFrame();
  }
  $('sp-go').innerHTML = `<option value="">Jump to…</option>${siteTargets().map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}`;
  $('sp-hover').checked = !!S.pvSite.hover;
  pv.querySelectorAll('#sp-dev button').forEach((b) => b.classList.toggle('on', b.dataset.dev === S.pvSite.dev));
  const [W, H] = SITE_DEV[S.pvSite.dev] || SITE_DEV.desktop, z = Math.min(1, Math.max(0.2, (pv.clientWidth - 36) / W));
  const wrap = pv.querySelector('.sp-wrap'), stage = pv.querySelector('.sp-stage');
  wrap.style.width = `${W * z}px`; wrap.style.height = `${H * z}px`;
  stage.style.width = `${W}px`; stage.style.height = `${H}px`; stage.style.transform = `scale(${z})`;
  if (!spFrames().length) loadSiteFrame();
}
function writeSiteDraft() { try { localStorage.setItem('studio.siteDraft', JSON.stringify({ site: S.site, at: Date.now() })); } catch {} }
function loadSiteFrame() {
  const stage = $('pv').querySelector('.sp-stage'); if (!stage || !B) return;
  writeSiteDraft();
  spFrames().filter((f) => f.classList.contains('loading')).forEach((f) => f.remove());   // a newer edit replaces a frame still loading
  const f = document.createElement('iframe'); f.className = 'sp-frame loading'; f.title = 'The site, with your text'; f.src = B.previewURL();
  stage.append(f); $('sp-state').textContent = 'updating…';
}
let siteDraftTimer = 0;
const siteDraftSoon = () => { clearTimeout(siteDraftTimer); siteDraftTimer = setTimeout(() => { writeSiteDraft(); if (S.sel.type === 'site') loadSiteFrame(); }, 900); };
function siteGoto(target) {
  if (!target) return; S.spGoto = target;
  const live = spFrames().filter((f) => !f.classList.contains('loading')).pop(); if (live) spPost(live, { type: 'goto', target });
}
addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data?.studio) return;
  const m = e.data, f = spFrames().find((x) => x.contentWindow === e.source); if (!f) return;
  if (m.type === 'ready') { spPost(f, S.spGoto ? { type: 'goto', target: S.spGoto } : { type: 'goto', s: S.pvSite.s || 0 }); if (S.pvSite.hover) spPost(f, { type: 'hover', on: true }); }
  if (m.type === 'placed') { f.classList.remove('loading'); spFrames().forEach((x) => { if (x !== f && !x.classList.contains('loading')) x.remove(); }); if ($('sp-state')) $('sp-state').textContent = ''; }
  if (m.type === 'scroll' && !f.classList.contains('loading')) { S.pvSite.s = m.s; S.spGoto = null; store.set('studio.pvsite', S.pvSite); }
});
$('edit').addEventListener('focusin', (e) => { if (S.sel.type !== 'site') return; const el = e.target.closest('[data-k], tr[data-goto]');
  const t = el?.closest('tr[data-goto]')?.dataset.goto || siteTarget(el?.dataset?.k); if (t) siteGoto(t); });
async function publishSite() {
  if (!S.siteDirty) return;
  S.siteDirty = false; S.dirty.add('_site'); setSave(); await save('_site');
  if (S.conflicts._site || S.dirty.has('_site')) S.siteDirty = true; else store.del('studio.unsaved._site');
  setSave();
}
$('tb-sitepub').addEventListener('click', publishSite);
$('pv-mode').addEventListener('click', (e) => { const m = e.target.closest('button')?.dataset.m; if (!m) return; S.pvMode = m; store.set('studio.pv', m); renderPreview(true); });
$('pv').addEventListener('click', (e) => {
  const v = e.target.closest('[data-view]'); if (v) { S.pvView = v.dataset.view; wuView($('pv').querySelector('.wu'), S.pvView); return; }   // the write-up's two versions
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
  if (t && t.closest('.wu-process') && S.pvView !== 'full') { S.pvView = 'full'; wuView(t.closest('.wu'), 'full'); }   // a block lives in the whole process
  if (t) { t.classList.add('hl'); const fr = t.getBoundingClientRect(), pr = pv.getBoundingClientRect(); if (fr.top < pr.top || fr.bottom > pr.bottom) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
$('edit').addEventListener('focusin', (e) => { const card = e.target.closest('.blk'); if (card && S.sel.type === 'project') focusBlock(card.id.slice(4)); });

// ── edits ──
function markDirty(key) {
  if (key === '_site') { S.siteDirty = true; store.set('studio.unsaved._site', S.site); setSave(); siteDraftSoon(); return; }
  S.dirty.add(key); setSave();
  store.set('studio.unsaved.' + key, docOf(key));
  clearTimeout(S.timers[key]); S.timers[key] = setTimeout(() => save(key), B.mode !== 'github' ? 700 : key === '_site' ? 6000 : 2500);   // online: one commit per pause, not per keystroke
}
function setSave() {
  const el = $('save'), n = S.dirty.size + S.saving.size, where = B?.mode === 'github' ? ' to GitHub' : '';
  const sync = S.sync && !S.sync.ok;
  el.classList.toggle('bad', Object.keys(S.conflicts).length > 0 || sync);
  el.title = sync ? `Syncing with GitHub failed: ${S.sync.error}` : '';
  if (S.writeProblem) { el.classList.add('bad'); el.textContent = 'NOT saving — token can’t write ↓'; return; }
  el.textContent = Object.keys(S.conflicts).length ? 'needs your decision ↓' : n ? `saving${where}…` : sync ? 'saved here · GitHub sync problem (hover)' : `all saved${where}`;
  $('tb-sitepub').hidden = !S.siteDirty;
  const sb = $('site-bar'); if (sb && sb.dataset.dirty !== String(S.siteDirty)) { sb.dataset.dirty = String(S.siteDirty); sb.innerHTML = siteBar(); }
  const pb = $('tb-publish');
  if (B?.mode === 'local') { pb.hidden = !S.publishPending; pb.textContent = `Publish · ${S.publishPending}`; }
}
async function save(key) {
  if (S.conflicts[key]) return;
  if (S.saving.has(key)) { S.timers[key] = setTimeout(() => save(key), 400); return; }
  S.saving.add(key); S.dirty.delete(key); setSave();
  let r;
  try { r = key === '_studio' ? await B.saveStudio(docOf(key), S.hashes[key]) : key === '_site' ? await B.saveSite(docOf(key), S.hashes[key]) : await B.saveProject(key, docOf(key), S.hashes[key]); }
  catch (e) {
    S.saving.delete(key); S.dirty.add(key);
    if (e.status === 403 || e.status === 401) { S.writeProblem = `GitHub refused the save: ${e.message}. Most likely the token's Contents permission is "Read-only" — it must be "Read and write", for both repos.`; renderEditor(); }
    else toast(e.message || 'Save failed', true);
    S.timers[key] = setTimeout(() => save(key), 8000); setSave(); return;
  }
  S.saving.delete(key);
  if (r.conflict) { S.conflicts[key] = { kind: 'remote', data: r.data, hash: r.hash }; renderEditor(); }
  else {
    S.hashes[key] = r.hash; if (!S.dirty.has(key)) store.del('studio.unsaved.' + key);
    if (key === '_site') toast(B.mode === 'github' ? 'Site text published — live on the site in a minute or two.' : 'Site text saved on this Mac — Publish in the top bar puts it live.', false, 5000);
    else if (r.published) toast(`${docOf(key)?.status === 'approved' ? 'Published' : 'Taken off the site'}: ${docOf(key)?.name}. The site updates in a minute or two.`, false, 5000);
  }
  setSave();
}
async function poll() {
  let r;
  try { r = await B.poll(); } catch { $('save').textContent = B.mode === 'github' ? 'offline — edits wait here' : 'server not answering'; $('save').classList.add('bad'); return; }
  S.sync = r.sync; S.publishPending = r.publish?.pending || 0;
  let redraw = false;
  for (const [key, h] of Object.entries(r.hashes)) {
    if (h === S.hashes[key] || S.saving.has(key)) continue;
    if (S.dirty.has(key) || (key === '_site' && S.siteDirty)) continue;   // our save will get the 409 and ask
    let d; try { d = key === '_studio' ? await B.getStudio() : key === '_site' ? await B.getSite() : await B.getProject(key); } catch { continue; }
    if (key === '_studio') { S.studio = d.data; S.hashes._studio = d.hash; }
    else if (key === '_site') { S.site = d.data; S.hashes._site = d.hash; }
    else { const isNew = !S.projects[key]; S.projects[key] = d.data; S.hashes[key] = d.hash; toast(isNew ? `New project: ${d.data.name}` : `${d.data.name} changed elsewhere (Claude or your other device) — loaded`); }
    redraw = true;
  }
  for (const key of Object.keys(S.projects)) if (!(key in r.hashes) && !S.dirty.has(key) && !S.saving.has(key) && S.hashes[key]) { delete S.projects[key]; redraw = true; }
  if (redraw) { renderSide(); renderEditor(); renderPreview(); }
  setSave();
}
$('tb-publish').addEventListener('click', async () => {
  const b = $('tb-publish'); b.disabled = true;
  try { toast((await B.publish()).message, false, 5000); } catch (e) { toast(e.message, true, 8000); }
  b.disabled = false; poll();
});
$('tb-out').addEventListener('click', () => { if (confirm('Sign out of GitHub in this browser? (Unsaved edits are kept here.)')) { store.del('studio.gh'); location.reload(); } });
addEventListener('beforeunload', (e) => { if (S.dirty.size || S.saving.size) { e.preventDefault(); e.returnValue = ''; } });
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); [...S.dirty].forEach((k) => { clearTimeout(S.timers[k]); save(k); }); toast('Saved'); }
  if (e.key === 'Escape') document.querySelector('.modal')?.remove();
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-k]'); if (!el || el.closest('.modal')) return;
  const key = el.closest('[data-doc]')?.dataset.doc; if (!key || !docOf(key)) return;
  const fmt = el.dataset.fmt, raw = el.type === 'checkbox' ? el.checked : el.value;   // lines = one item per line; pages = pages split by a blank line
  setPath(docOf(key), el.dataset.k, fmt === 'lines' ? raw.split('\n') : fmt === 'pages' ? raw.split(/\n\s*\n/).map((pg) => pg.split('\n').filter((l) => l.trim())).filter((pg) => pg.length) : fmt === 'num' ? +raw : raw);
  if (el.type === 'range') el.nextElementSibling && (el.nextElementSibling.textContent = raw + '%');
  markDirty(key);
  if (key === '_site' && el.closest('.card-ed')) {                    // keep the little card preview in step while typing
    const pj = S.projects[S.sel.id], pv = el.closest('.card-ed').querySelector('.card-pv');
    if (pj && pv) pv.innerHTML = cardPv(pj, cardOf(pj));
  }
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
    case 'ord': {                                                   // move this project on its floor; every project there gets an explicit order
      const list = projectsOn(p.floor), k = list.indexOf(p), to = k + +b.dataset.d; if (k < 0 || to < 0 || to >= list.length) return;
      [list[k], list[to]] = [list[to], list[k]];
      list.forEach((x, n) => { if (x.order !== n) { x.order = n; markDirty(x.slug); } });
      renderSide(); renderEditor(); schedulePreview(); return; }
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
    case 'site-publish': return publishSite();
    case 'site-discard': { if (!confirm('Throw away what you are trying and go back to the text that is on the site?')) return;
      try { const d = await B.getSite(); S.site = d.data; S.hashes._site = d.hash; } catch (err) { toast(err.message, true); return; }
      S.siteDirty = false; store.del('studio.unsaved._site'); renderEditor(); setSave(); siteDraftSoon(); return; }
    case 'type-reset': { if (S.site.style) delete S.site.style[b.dataset.g]; markDirty('_site'); renderEditor(); siteGoto(TYPE.find(([g]) => g === b.dataset.g)?.[2]); return; }
    case 'arch-add': (S.site.archive ||= []).push({ name: '', line: '', course: '', year: '' }); markDirty('_site'); renderEditor(); return;
    case 'reconnect': store.del('studio.gh'); location.reload(); return;   // unsaved edits stay in this browser and come back after signing in
    case 'cf-theirs': { const c = S.conflicts[b.dataset.key]; delete S.conflicts[b.dataset.key]; if (b.dataset.key === '_studio') { const st = await B.getStudio(); S.studio = st.data; S.hashes._studio = st.hash; } else if (b.dataset.key === '_site') { S.site = c.data; S.hashes._site = c.hash; } else { S.projects[b.dataset.key] = c.data; S.hashes[b.dataset.key] = c.hash; } store.del('studio.unsaved.' + b.dataset.key); renderSide(); renderEditor(); renderPreview(); setSave(); return; }
    case 'cf-mine': { const k = b.dataset.key, c = S.conflicts[k]; delete S.conflicts[k]; if (c.kind === 'local') { if (k === '_studio') S.studio = c.data; else if (k === '_site') S.site = c.data; else S.projects[k] = c.data; } else S.hashes[k] = c.hash; markDirty(k); renderEditor(); renderPreview(); return; }
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
    let r; try { r = await B.upload(p.slug, f, vision); } catch (e) { toast(`${f.name}: ${e.message || 'upload failed'}`, true, 6000); continue; }
    if (vision) ((p.vision ||= {}).refs ||= []).push({ src: r.src, note: '' });
    else (p.blocks[i].media ||= []).push({ src: r.src, caption: '', kind: /sketch|draw/i.test(f.name) ? 'sketch' : /\.(mp4|mov|m4v|webm)$/i.test(f.name) ? 'still' : 'photo' });
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
  if (!S.pics[p.slug]) S.pics[p.slug] = await B.pictures(p.slug).catch(() => ({ used: [], candidates: [] }));
  const tile = (x, cand) => { const on = block.media.some((m) => m.src === x.src); const v = /\.(mp4|webm)$/i.test(x.src);
    return `<button class="p ${on ? 'on' : ''}" data-src="${esc(x.src)}" data-cand="${cand ? 1 : ''}"><div class="th">${v ? `<video src="${esc(pic(x.src))}" muted></video>` : `<img src="${esc(pic(x.src))}" alt="" loading="lazy">`}</div><span>${/^private/i.test(x.name) ? '<b style="color:var(--ask)">PRIVATE · client data</b> ' : ''}${esc(x.name)}</span></button>`; };
  const body = () => { const P = S.pics[p.slug];
    return `<p class="k grp">This project's pictures (they go on the site with the write-up once you approve it)</p>${P.used.length ? `<div class="pgrid">${P.used.map((x) => tile(x, false)).join('')}</div>` : '<p class="empty">None yet.</p>'}
      <p class="k grp">Pulled from your Drive by Claude · not on the site until you pick them</p>${P.candidates.length ? `<div class="pgrid">${P.candidates.map((x) => tile(x, true)).join('')}</div>` : '<p class="empty">None.</p>'}`; };
  const { m, draw } = modal(`Pictures for “${block.title || stagesOf(p, S.studio)[block.stage]?.label || 'this block'}”`, body, { foot: '<span class="hint" style="margin-right:auto">Click to add or remove. You can also drop files from Finder straight onto a block.</span>' });
  m.querySelector('.mb').addEventListener('click', async (e) => {
    const t = e.target.closest('[data-src]'); if (!t) return;
    let src = t.dataset.src;
    const k = block.media.findIndex((x) => x.src === src);
    if (k >= 0) block.media.splice(k, 1);
    else {
      if (t.dataset.cand) {
        try { src = (await B.promote(p.slug, src)).src; } catch (err) { return toast(err.message, true, 6000); }
        S.pics[p.slug] = await B.pictures(p.slug).catch(() => S.pics[p.slug]);
      }
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
