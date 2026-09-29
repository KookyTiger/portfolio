// ─────────────────────────────────────────────────────────────
// Write-up view: renders one project case study (and a floor's title band) from merge/writeups/*.json.
// Used by the Studio's live preview now; the site's detail panel will use the same functions once Kay approves the layout.
// Pure functions → HTML strings. Styles: writeup-view.css (everything scoped under .wu / .fb).
// ─────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Kay's text → HTML: blank line = new paragraph, "- " lines = a list, **bold**, single newlines kept.
export function mdLite(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  return String(text || '').trim().split(/\n\s*\n/).filter(Boolean).map((para) => {
    const lines = para.split('\n');
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
    return `<p>${inline(para)}</p>`;
  }).join('');
}

// "facts" layout: `A | B | C` rows, `!` = header row, other lines = paragraphs.
function factsHTML(text) {
  const out = []; let rows = [];
  const flush = () => { if (!rows.length) return;
    out.push(`<table class="wu-table">${rows.map((r) => `<tr>${r.cells.map((c, i) => r.head ? `<th>${esc(c)}</th>` : i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`); rows = []; };
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.includes('|')) { const head = line.startsWith('!'); rows.push({ head, cells: line.replace(/^!/, '').split('|').map((c) => c.trim()) }); }
    else { flush(); out.push(mdLite(line)); }
  }
  flush();
  return out.join('');
}

export function toolIcon(sw, icons) {
  const si = sw.si && icons?.[sw.si];
  if (si) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${si.path}"/></svg>`;
  const abbr = esc(sw.abbr || sw.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2));
  return `<b class="${abbr.length > 2 ? 'sm' : ''}">${abbr}</b>`;
}

function toolsHTML(ids, lib, icons) {
  const byId = Object.fromEntries((lib.software || []).map((s) => [s.id, s]));
  const list = (ids || []).map((id) => byId[id]).filter(Boolean);
  if (!list.length) return '';
  return `<div class="wu-tools">${list.map((s) => `<div class="wu-tool" title="${esc(s.name)}"><span class="ic">${toolIcon(s, icons)}</span><span class="nm">${esc(s.name)}</span></div>`).join('')}</div>`;
}

function classesHTML(ids, lib) {
  const byId = Object.fromEntries((lib.classes || []).map((c) => [c.id, c]));
  const list = (ids || []).map((id) => byId[id]).filter(Boolean);
  if (!list.length) return '';
  return `<ul class="wu-classes">${list.map((c) => `<li><b>${esc(c.code)}</b><span>${esc(c.topic || c.title)}${c.status === 'now' ? ' <i>· now</i>' : ''}</span></li>`).join('')}</ul>`;
}

let BASE = '', RESOLVE = null;                                     // RESOLVE: the online Studio turns private picture paths into blob URLs
const url = (src) => (RESOLVE ? RESOLVE(src) : /^(https?:|data:|blob:|\/)/.test(src) ? src : BASE + src);

function figHTML(m, cls = '') {
  if (!m?.src) return '';
  const cap = m.caption ? `<figcaption>${m.kind ? `<span class="kd">${esc(m.kind)}</span>` : ''}${esc(m.caption)}</figcaption>`
                        : m.kind ? `<figcaption><span class="kd">${esc(m.kind)}</span></figcaption>` : '';
  const isVideo = /\.(mp4|webm|mov)$/i.test(m.src);
  const media = isVideo ? `<video src="${esc(url(m.src))}" muted loop autoplay playsinline></video>`
                        : `<img src="${esc(url(m.src))}" alt="${esc(m.caption || m.kind || '')}" loading="lazy">`;
  return `<figure class="wu-fig k-${esc(m.kind || 'photo')} ${cls}"><div class="fr">${media}</div>${cap}</figure>`;
}

export function stagesOf(p, lib) {
  const t = lib.templates?.[p.template] || { stages: [] };
  return Object.fromEntries(t.stages.map((s, i) => [s.key, { ...s, n: i + 1 }]));
}

function blockHTML(b, stage, num, opts = {}) {
  const empty = !(b.text && b.text.trim()) && !(b.media || []).some((m) => m.src);
  if (empty && opts.showEmpty) return `<section class="wu-block wu-empty" data-block="${esc(b.id)}" id="wu-${esc(b.id)}">${stage ? `<p class="wu-stage wu-k"><span class="n">${String(num).padStart(2, '0')}</span><span>${esc(stage.label)}</span></p>` : ''}<p class="wu-hint">${esc(stage?.hint || 'Empty block')}</p></section>`;
  const title = b.title ? `<h3>${esc(b.title)}</h3>` : '';
  const eyebrow = stage ? `<p class="wu-stage wu-k"><span class="n">${String(num).padStart(2, '0')}</span><span>${esc(stage.label)}</span></p>` : '';
  const media = (b.media || []).filter((m) => m.src);
  const text = b.layout === 'facts' ? factsHTML(b.text) : mdLite(b.text);
  let body;
  switch (b.layout) {
    case 'quote':
      body = `<blockquote class="wu-quote">${esc(String(b.text || '').trim())}</blockquote>${media.length ? `<div class="wu-gallery">${media.map((m) => figHTML(m)).join('')}</div>` : ''}`; break;
    case 'text-media': case 'media-text':
      body = media.length ? `<div class="wu-split ${b.layout === 'media-text' ? 'rev' : ''}"><div class="wu-text">${title}${text}</div><div class="wu-stack">${media.map((m) => figHTML(m)).join('')}</div></div>`
                          : `<div class="wu-text">${title}${text}</div>`;
      return `<section class="wu-block l-${b.layout}" data-block="${esc(b.id)}" id="wu-${esc(b.id)}">${eyebrow}${body}</section>`;
    case 'gallery':
      body = `<div class="wu-text">${text}</div>${media.length ? `<div class="wu-gallery n${Math.min(media.length, 4)}">${media.map((m) => figHTML(m)).join('')}</div>` : ''}`; break;
    case 'full':
      body = `${media.length ? `<div class="wu-full">${media.map((m) => figHTML(m, 'big')).join('')}</div>` : ''}<div class="wu-text">${text}</div>`; break;
    default:
      body = `<div class="wu-text">${text}</div>${media.length ? `<div class="wu-gallery n${Math.min(media.length, 4)}">${media.map((m) => figHTML(m)).join('')}</div>` : ''}`;
  }
  return `<section class="wu-block l-${esc(b.layout || 'text')}" data-block="${esc(b.id)}" id="wu-${esc(b.id)}">${eyebrow}${b.layout === 'quote' ? '' : title}${body}</section>`;
}

// p = a project (public fields are enough), lib = _studio.json, icons = vendor/tool-icons.json → icons
// opts: { index, total, email, showEmpty (dashed placeholders for empty stages), base (prefix for relative picture paths), resolve (src → url) }
export function renderWriteup(p, lib, icons, opts = {}) {
  BASE = opts.base || ''; RESOLVE = opts.resolve || null;
  const stages = stagesOf(p, lib);
  const floor = (lib.floors || []).find((f) => f.id === p.floor);
  const c = p.context || {};
  const eyebrow = [opts.index != null ? `<span class="n">${String(opts.index).padStart(2, '0')}${opts.total ? ` / ${String(opts.total).padStart(2, '0')}` : ''}</span>` : '',
    floor ? `<span>${esc(floor.title)}</span>` : '', c.when ? `<span>${esc(c.when)}</span>` : ''].filter(Boolean).join('');
  const meta = [['Role', c.role], ['Team', c.team], ['Partner', c.partner], ['Course', c.course]].filter(([, v]) => v)
    .map(([k, v]) => `<div><span class="wu-k">${k}</span><p>${esc(v)}</p></div>`).join('');
  const tools = toolsHTML(p.software, lib, icons);
  const skills = (p.skills || []).filter((s) => s.name);
  const classes = classesHTML(p.classes, lib);
  const kit = [tools && ['Tools', tools], skills.length && ['Skills', `<div class="wu-chips">${skills.map((s) => `<a class="wu-chip" href="#wu-${esc(s.evidence || '')}">${esc(s.name)}</a>`).join('')}</div>`], classes && ['Classes', classes]]
    .filter(Boolean).map(([k, v]) => `<span class="wu-k">${k}</span><div>${v}</div>`).join('');
  const blocks = (p.blocks || []).filter((b) => opts.showEmpty || (b.text && b.text.trim()) || (b.media || []).some((m) => m.src));
  let n = 0;                                                           // numbered by position, so deleting a block never leaves a gap
  const numbered = blocks.map((b) => { const st = b.layout !== 'quote' ? stages[b.stage] : null; return { b, st, num: st ? ++n : null }; });
  const steps = numbered.filter((x) => x.st);
  const seen = new Set();
  const stepsHTML = steps.length > 2 ? `<nav class="wu-steps" aria-label="Process">${steps.filter((x) => !seen.has(x.b.stage) && seen.add(x.b.stage)).map((x) => `<a href="#wu-${esc(x.b.id)}"><span class="n">${String(x.num).padStart(2, '0')}</span>${esc(x.st.label)}</a>`).join('')}</nav>` : '';
  const email = opts.email || 'kaytu2027@u.northwestern.edu';
  return `<article class="wu">
    ${eyebrow ? `<p class="wu-eyebrow wu-k">${eyebrow}</p>` : ''}
    <h2 class="wu-title">${esc(p.name)}</h2>
    ${p.oneLiner ? `<p class="wu-lede">${esc(p.oneLiner)}</p>` : ''}
    ${p.cover ? `<figure class="wu-cover"><img src="${esc(url(p.cover))}" alt="${esc(p.name)}"></figure>` : ''}
    ${meta ? `<div class="wu-meta">${meta}</div>` : ''}
    ${kit ? `<div class="wu-kit">${kit}</div>` : ''}
    ${stepsHTML}
    ${numbered.map((x) => blockHTML(x.b, x.st, x.num, opts)).join('')}
    <a class="wu-ask" href="mailto:${esc(email)}?subject=${encodeURIComponent(p.name || '')}">Ask me for the full report ↗</a>
  </article>`;
}

// The floor's title band with its toolkit (a proposal for the site's section papers).
export function renderFloorBand(f, lib, icons, opts = {}) {
  const lines = String(f.title || '').split(' & ');
  const title = lines.map((l, i) => `<span class="line">${esc(l)}${i < lines.length - 1 ? ' &amp;' : ''}</span>`).join('');
  const tools = toolsHTML(f.software, lib, icons);
  const classes = classesHTML(f.classes, lib);
  return `<section class="fb">
    <div class="fb-l">
      <p class="fb-k">${esc(f.num)} / ${String(opts.total || 3).padStart(2, '0')}${opts.count != null ? ` · ${opts.count} projects` : ''}</p>
      <div class="fb-big">${title}</div>
      ${f.sub ? `<p class="fb-sub">${esc(f.sub)}</p>` : ''}
    </div>
    <div class="fb-r">
      ${tools ? `<div class="fb-row"><span class="fb-k">Tools</span>${tools}</div>` : ''}
      ${classes ? `<div class="fb-row"><span class="fb-k">Classes</span>${classes}</div>` : ''}
    </div>
  </section>`;
}
