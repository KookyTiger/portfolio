// ─────────────────────────────────────────────────────────────
// Where the Studio keeps its data. Same interface, two homes:
//   LocalBackend  — the Python server on this Mac (merge/studio/server.py), files in merge/writeups-private/
//   GitHubBackend — the online Studio: the private repo through the GitHub API, publishing approved write-ups
//                   into the public repo (a GitHub Action then rebuilds the site)
// ─────────────────────────────────────────────────────────────
import { GitHub, REPOS, Conflict } from './github.js';

// ── the public / private split (mirrors server.py) ──
const PRIVATE_BLOCK = ['draft', 'sources', 'questions', 'note', 'ok'];
const PRIVATE_PROJECT = ['log', 'drive', 'vision', 'legacy', 'notes'];
const PRIVATE_STUDIO = ['voice', 'notes'];
const ORDER_PROJECT = ['slug', 'name', 'floor', 'onSite', 'order', 'template', 'status', 'oneLiner', 'context', 'software', 'skills', 'classes', 'cover', 'blocks'];
const ORDER_BLOCK = ['id', 'stage', 'title', 'text', 'layout', 'media'];
const ordered = (d, order) => { const o = {}; order.forEach((k) => { if (k in d) o[k] = d[k]; }); Object.keys(d).forEach((k) => { if (!(k in o)) o[k] = d[k]; }); return o; };
export function splitProject(d) {
  const pub = {}, priv = {}, pb = {};
  Object.entries(d).forEach(([k, v]) => { if (k === 'blocks') return; (PRIVATE_PROJECT.includes(k) ? priv : pub)[k] = v; });
  pub.blocks = (d.blocks || []).map((b) => {
    const keep = {}, hide = {};
    Object.entries(b).forEach(([k, v]) => { (PRIVATE_BLOCK.includes(k) ? hide : keep)[k] = v; });
    if (Object.keys(hide).length) pb[b.id] = hide;
    return ordered(keep, ORDER_BLOCK);
  });
  priv.blocks = pb;
  return [ordered(pub, ORDER_PROJECT), priv];
}
export function mergeProject(pub, priv) {
  const d = { ...pub };
  Object.entries(priv || {}).forEach(([k, v]) => { if (k !== 'blocks') d[k] = v; });
  const pb = (priv || {}).blocks || {};
  d.blocks = (pub.blocks || []).map((b) => ({ ...b, ...(pb[b.id] || {}) }));
  return d;
}
const dump = (o) => JSON.stringify(o, null, 2) + '\n';
const picturesOf = (slug, pub) => [...new Set([...(pub.blocks || []).flatMap((b) => (b.media || []).map((m) => m.src || '')), pub.cover || '']
  .filter((s) => s.startsWith(`assets/projects/${slug}/`)))];
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

// ── this Mac ──
export class LocalBackend {
  mode = 'local';
  async call(url, opt = {}) {
    const r = await fetch(url, opt).catch(() => null);
    if (!r) throw new Error('The Studio server is not answering. Double-click merge/studio/Open Studio.command.');
    let j = {}; try { j = await r.json(); } catch {}
    if (r.status === 409) return { conflict: true, ...j };
    if (!r.ok) throw new Error(j.error || `${r.status}`);
    return j;
  }
  static async detect() { try { const r = await fetch('/api/hashes', { cache: 'no-store' }); return r.ok; } catch { return false; } }
  load() { return this.call('/api/state'); }
  saveProject(slug, data, base) { return this.call(`/api/project/${slug}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, base }) }); }
  saveStudio(data, base) { return this.call('/api/studio', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, base }) }); }
  poll() { return this.call('/api/hashes'); }
  getProject(slug) { return this.call(`/api/project/${slug}`); }
  async getStudio() { const s = await this.load(); return { data: s.studio, hash: s.hashes._studio }; }
  getSite() { return this.call('/api/site'); }
  saveSite(data, base) { return this.call('/api/site', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, base }) }); }
  upload(slug, file, vision) { return this.call(`/api/upload/${slug}${vision ? '?to=vision' : ''}`, { method: 'POST', headers: { 'X-Filename': encodeURIComponent(file.name) }, body: file }); }
  promote(slug, src) { return this.call(`/api/promote/${slug}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ src }) }); }
  pictures(slug) { return this.call(`/api/pictures/${slug}`); }
  publish() { return this.call('/api/publish', { method: 'POST' }); }
  picURL(src) {
    if (!src) return '';
    if (/^(https?:|data:|blob:|\/)/.test(src)) return src;
    if (/^(candidates|vision)\//.test(src)) return `/merge/writeups-private/${src}`;
    return '/' + src.replace(/^assets\/src\/candidates\//, 'merge/writeups-private/candidates/');
  }
  sourcesURL(slug) { return `/merge/writeups-private/sources/${slug}.md`; }
  siteURL() { return 'http://localhost:8000/preview.html?drafts'; }
}

// ── GitHub (the online Studio) ──
export class GitHubBackend {
  mode = 'github';
  constructor(token, onPicture) { this.gh = new GitHub(token); this.onPicture = onPicture || (() => {}); this.pics = new Map(); this.priv = null; this.pub = null; }

  static async connect(token) {                                  // check the token can read AND write both repos before keeping it
    const gh = new GitHub(token);
    const me = await gh.user();
    await GitHubBackend.checkWrite(gh);
    return me.login;
  }
  // a throwaway blob (never committed) proves write access; GitHub's own error ("Resource not accessible…") doesn't say what's missing
  static async checkWrite(gh) {
    for (const repo of [REPOS.priv, REPOS.pub]) {
      try { await gh.api(`/repos/${repo}`); }
      catch (e) { throw new Error(`the token can't see ${repo}. Edit the token → Repository access → select both portfolio and portfolio-studio-private.`); }
      try { await gh.api(`/repos/${repo}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: 'studio write check', encoding: 'utf-8' }) }); }
      catch (e) { throw new Error(`the token can read ${repo} but not write to it. Edit the token → Permissions → Repository permissions → Contents → change "Read-only" to "Read and write".`); }
    }
  }

  hashOf(slug, files = this.priv.files) { return `${files[`public/${slug}.json`] || '-'}:${files[`${slug}.json`] || '-'}`; }
  studioHash() { return `${this.pub.files['merge/writeups/_studio.json'] || '-'}:${this.priv.files['_studio.json'] || '-'}`; }
  slugs(files = this.priv.files) {
    const s = new Set();
    Object.keys(files).forEach((p) => { const m = p.match(/^(?:public\/)?([a-z0-9][a-z0-9-]*)\.json$/); if (m) s.add(m[1]); });
    return [...s].sort();
  }
  async json(repo, sha) { return sha ? JSON.parse(await this.gh.text(repo, sha)) : null; }

  async readProject(slug) {
    const f = this.priv.files;
    const [pub, priv] = await Promise.all([this.json(REPOS.priv, f[`public/${slug}.json`]), this.json(REPOS.priv, f[`${slug}.json`])]);
    return mergeProject(pub || { slug, blocks: [] }, priv || {});
  }
  async readStudio() {
    const [a, b] = await Promise.all([this.json(REPOS.pub, this.pub.files['merge/writeups/_studio.json']), this.json(REPOS.priv, this.priv.files['_studio.json'])]);
    return { ...(a || {}), ...(b || {}) };
  }

  async load() {
    [this.priv, this.pub] = await Promise.all([this.gh.tree(REPOS.priv), this.gh.tree(REPOS.pub)]);
    const projects = {}, hashes = { _studio: this.studioHash() };
    const list = this.slugs();
    for (let i = 0; i < list.length; i += 6) {                  // a few at a time, gently
      await Promise.all(list.slice(i, i + 6).map(async (s) => { projects[s] = await this.readProject(s); hashes[s] = this.hashOf(s); }));
    }
    hashes._site = this.pub.files['merge/writeups/_site.json'] || '-';
    return { studio: await this.readStudio(), projects, site: await this.json(REPOS.pub, this.pub.files['merge/writeups/_site.json']) || {}, hashes, mode: 'github' };
  }

  async saveProject(slug, data, base) {
    data = { ...data, slug };
    const [pub, priv] = splitProject(data);
    const pubText = dump(pub), privText = dump(priv);
    const [expPub, expPriv] = (base || '-:-').split(':');
    try {
      const r = await this.gh.commit(REPOS.priv, [{ path: `public/${slug}.json`, text: pubText }, { path: `${slug}.json`, text: privText }],
        `Studio: ${data.name || slug}`, base ? { [`public/${slug}.json`]: expPub === '-' ? null : expPub, [`${slug}.json`]: expPriv === '-' ? null : expPriv } : null);
      this.priv = { ...this.priv, head: r.head, files: r.files };
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
      this.priv = await this.gh.tree(REPOS.priv);
      return { conflict: true, data: await this.readProject(slug), hash: this.hashOf(slug) };
    }
    let published = false;
    try { published = await this.publishProject(slug, pub, pubText); }
    catch (e) { throw new Error(`Saved, but publishing to the site failed: ${e.message}`); }
    return { hash: this.hashOf(slug), published };
  }

  // approved + on the site → the public repo gets the write-up and its pictures; otherwise it is taken off the site
  async publishProject(slug, pub, pubText = dump(pub)) {
    this.pub = await this.gh.tree(REPOS.pub);
    const live = `merge/writeups/${slug}.json`, dir = `assets/projects/${slug}/`;
    const changes = [];
    if (pub.status === 'approved' && pub.onSite) {
      changes.push({ path: live, text: pubText });
      const want = picturesOf(slug, pub);
      for (const src of want) {
        const sha = this.priv.files[`pictures/${slug}/${src.slice(dir.length)}`];
        if (sha && this.pub.files[src] !== sha) changes.push({ path: src, bytes: await this.gh.bytes(REPOS.priv, sha) });
      }
      Object.keys(this.pub.files).filter((p) => p.startsWith(dir) && !want.includes(p)).forEach((p) => changes.push({ path: p, remove: true }));
    } else if (this.pub.files[live]) {
      changes.push({ path: live, remove: true });
      Object.keys(this.pub.files).filter((p) => p.startsWith(dir)).forEach((p) => changes.push({ path: p, remove: true }));
    }
    if (!changes.length) return false;
    const r = await this.gh.commit(REPOS.pub, changes, `${pub.status === 'approved' ? 'Publish' : 'Unpublish'} ${pub.name || slug} from the Studio`);
    this.pub = { ...this.pub, head: r.head, files: r.files };
    return r.changed;
  }

  async saveStudio(data, base) {
    const pub = {}, priv = {};
    Object.entries(data).forEach(([k, v]) => { (PRIVATE_STUDIO.includes(k) ? priv : pub)[k] = v; });
    const [expPub, expPriv] = (base || '-:-').split(':');
    try {
      const a = await this.gh.commit(REPOS.pub, [{ path: 'merge/writeups/_studio.json', text: dump(pub) }], 'Studio: library (floors, classes, software, templates)',
        base ? { 'merge/writeups/_studio.json': expPub === '-' ? null : expPub } : null);
      this.pub = { ...this.pub, head: a.head, files: a.files };
      const b = await this.gh.commit(REPOS.priv, [{ path: '_studio.json', text: dump(priv) }], 'Studio: voice & notes',
        base ? { '_studio.json': expPriv === '-' ? null : expPriv } : null);
      this.priv = { ...this.priv, head: b.head, files: b.files };
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
      [this.priv, this.pub] = await Promise.all([this.gh.tree(REPOS.priv), this.gh.tree(REPOS.pub)]);
      return { conflict: true, data: await this.readStudio(), hash: this.studioHash() };
    }
    return { hash: this.studioHash() };
  }

  async poll() {
    const [ph, uh] = await Promise.all([this.gh.head(REPOS.priv), this.gh.head(REPOS.pub)]);
    if (ph !== this.priv.head) this.priv = await this.gh.tree(REPOS.priv, ph);
    if (uh !== this.pub.head) this.pub = await this.gh.tree(REPOS.pub, uh);
    const hashes = { _studio: this.studioHash(), _site: this.pub.files['merge/writeups/_site.json'] || '-' };
    this.slugs().forEach((s) => { hashes[s] = this.hashOf(s); });
    return { hashes, sync: null, publish: null };
  }
  async getProject(slug) { return { data: await this.readProject(slug), hash: this.hashOf(slug) }; }
  async getStudio() { return { data: await this.readStudio(), hash: this.studioHash() }; }
  async getSite() { return { data: await this.json(REPOS.pub, this.pub.files['merge/writeups/_site.json']) || {}, hash: this.pub.files['merge/writeups/_site.json'] || '-' }; }
  // the site's text goes straight to the public repo: the site rebuilds itself a minute or two later
  async saveSite(data, base) {
    try {
      const r = await this.gh.commit(REPOS.pub, [{ path: 'merge/writeups/_site.json', text: dump(data) }], 'Studio: site text',
        base ? { 'merge/writeups/_site.json': base === '-' ? null : base } : null);
      this.pub = { ...this.pub, head: r.head, files: r.files };
      return { hash: this.pub.files['merge/writeups/_site.json'], published: r.changed };
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
      this.pub = await this.gh.tree(REPOS.pub);
      return { conflict: true, ...(await this.getSite()) };
    }
  }

  async upload(slug, file, vision) {
    let bytes, ext;
    if (/\.(gif|mp4|webm)$/i.test(file.name)) {
      if (file.size > 20e6) throw new Error(`${file.name} is over 20 MB — trim it first.`);
      bytes = new Uint8Array(await file.arrayBuffer()); ext = file.name.split('.').pop().toLowerCase();
    } else {
      bytes = await toWebp(file); ext = 'webp';
    }
    const stem = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'picture';
    const dir = `${vision ? 'vision' : 'pictures'}/${slug}/`;
    let name = `${stem}.${ext}`, n = 2;
    while (this.priv.files[dir + name]) name = `${stem}-${n++}.${ext}`;
    const r = await this.gh.commit(REPOS.priv, [{ path: dir + name, bytes }], `Studio: picture for ${slug}`);
    this.priv = { ...this.priv, head: r.head, files: r.files };
    const src = `${vision ? 'vision' : 'assets/projects'}/${slug}/${name}`;
    this.pics.set(src, URL.createObjectURL(new Blob([bytes], { type: mime(name) })));
    return { src };
  }

  async promote(slug, src) {
    const name = src.split('/').pop();
    if (/^private/i.test(name)) throw new Error('Claude marked this picture PRIVATE (client data that is not in the final deliverable). Rename it without PRIVATE- if you are sure it can be public.');
    const sha = this.priv.files[src];
    if (!sha) throw new Error(`${src} is not in the private repo`);
    const r = await this.gh.commit(REPOS.priv, [{ path: `pictures/${slug}/${name}`, sha }], `Studio: use ${name} in ${slug}`);
    this.priv = { ...this.priv, head: r.head, files: r.files };
    return { src: `assets/projects/${slug}/${name}` };
  }

  async pictures(slug) {
    const ls = (prefix, as) => Object.keys(this.priv.files).filter((p) => p.startsWith(prefix) && /\.(webp|jpe?g|png|gif|mp4|webm)$/i.test(p))
      .sort().map((p) => ({ src: as + p.slice(prefix.length), name: p.slice(prefix.length) }));
    return { used: ls(`pictures/${slug}/`, `assets/projects/${slug}/`), candidates: ls(`candidates/${slug}/`, `candidates/${slug}/`) };
  }

  async publish() {                                              // re-publish every approved write-up (the Publish button)
    this.priv = await this.gh.tree(REPOS.priv);
    let n = 0;
    for (const s of this.slugs()) {
      const sha = this.priv.files[`public/${s}.json`]; if (!sha) continue;
      const pub = await this.json(REPOS.priv, sha);
      if (await this.publishProject(s, pub)) n++;
    }
    return { message: n ? `Published ${n} change${n > 1 ? 's' : ''}. The site rebuilds in a minute or two.` : 'The site already has everything you approved.' };
  }

  // pictures live in the private repo: fetch once, show as blob URLs (published covers come straight from the site)
  picURL(src) {
    if (!src) return '';
    if (/^(https?:|data:|blob:)/.test(src)) return src;
    if (this.pics.has(src)) return this.pics.get(src) || PIXEL;
    const m = src.match(/^assets\/projects\/([a-z0-9-]+)\/(.+)$/);
    const path = m ? `pictures/${m[1]}/${m[2]}` : /^(candidates|vision)\//.test(src) ? src : null;
    const sha = path && this.priv?.files[path];
    if (!sha) return `../../${src}`;                              // a published file (e.g. the cut-out covers)
    this.pics.set(src, '');
    this.gh.bytes(REPOS.priv, sha).then((b) => { this.pics.set(src, URL.createObjectURL(new Blob([b], { type: mime(src) }))); this.onPicture(src); })
      .catch(() => this.pics.set(src, `../../${src}`));
    return PIXEL;
  }
  sourcesURL(slug) { return `https://github.com/${REPOS.priv}/blob/${REPOS.branch}/sources/${slug}.md`; }
  siteURL() { return 'https://kookytiger.github.io/portfolio/'; }
}

const mime = (n) => ({ webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm' }[n.split('.').pop().toLowerCase()] || 'application/octet-stream');

// any picture the browser can open → webp, longest side ≤ 1600 (HEIC opens in Safari; in Chrome save it as JPG first)
async function toWebp(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error(`This browser can't open ${file.name}. ${/\.hei[cf]$/i.test(file.name) ? 'Open the Studio in Safari, or export it as JPG first.' : 'Try a JPG or PNG.'}`); }
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.8));
  return new Uint8Array(await blob.arrayBuffer());
}
