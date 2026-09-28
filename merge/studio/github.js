// ─────────────────────────────────────────────────────────────
// A small GitHub client for the online Studio (browser and Node 18+): trees, blobs, and multi-file commits through the
// Git Data API, so one save is one commit. `expect` makes a commit refuse to land on top of files that changed meanwhile.
// ─────────────────────────────────────────────────────────────
export const REPOS = { pub: 'KookyTiger/portfolio', priv: 'KookyTiger/portfolio-studio-private', branch: 'main' };

const enc = new TextEncoder(), dec = new TextDecoder();
export const b64ToBytes = (b64) => Uint8Array.from(atob(String(b64).replace(/\s/g, '')), (c) => c.charCodeAt(0));
export function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
// git's blob id: sha1("blob <len>\0" + bytes) — lets the Studio tell whether a file really changed without asking GitHub
export async function blobSha(data) {
  const bytes = typeof data === 'string' ? enc.encode(data) : data;
  const head = enc.encode(`blob ${bytes.length}\0`), all = new Uint8Array(head.length + bytes.length);
  all.set(head); all.set(bytes, head.length);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-1', all))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class Conflict extends Error { constructor(path) { super(`${path} changed on GitHub`); this.status = 409; this.path = path; } }

export class GitHub {
  constructor(token) { this.token = token; }

  async api(path, opt = {}) {
    const r = await fetch(path.startsWith('http') ? path : `https://api.github.com${path}`, {
      ...opt, cache: 'no-store',
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
                 ...(opt.body ? { 'Content-Type': 'application/json' } : {}), ...(opt.headers || {}) },
    });
    if (r.status === 204) return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.message || `${r.status} ${r.statusText}`); e.status = r.status; throw e; }
    return j;
  }

  async user() { return this.api('/user'); }
  async head(repo) { return (await this.api(`/repos/${repo}/git/ref/heads/${REPOS.branch}`)).object.sha; }

  // every file in the repo at `commit` (default: the branch head): { head, tree, files: {path: blobSha} }
  async tree(repo, commit) {
    const head = commit || await this.head(repo);
    const c = await this.api(`/repos/${repo}/git/commits/${head}`);
    const t = await this.api(`/repos/${repo}/git/trees/${c.tree.sha}?recursive=1`);
    if (t.truncated) throw new Error(`${repo} is too big to list in one go`);
    return { head, tree: c.tree.sha, files: Object.fromEntries(t.tree.filter((x) => x.type === 'blob').map((x) => [x.path, x.sha])) };
  }

  async bytes(repo, sha) { return b64ToBytes((await this.api(`/repos/${repo}/git/blobs/${sha}`)).content); }
  async text(repo, sha) { return dec.decode(await this.bytes(repo, sha)); }

  // changes: [{path, text} | {path, bytes} | {path, sha} (an existing blob of this repo) | {path, remove: true}]
  // expect: {path: blobSha | null} — what those files must still be on GitHub (null = must not exist), else Conflict
  async commit(repo, changes, message, expect = null) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = await this.tree(repo);
      if (expect) for (const [p, sha] of Object.entries(expect)) if ((cur.files[p] || null) !== (sha || null)) throw new Conflict(p);
      const entries = [];
      for (const ch of changes) {
        if (ch.remove) { if (cur.files[ch.path]) entries.push({ path: ch.path, mode: '100644', type: 'blob', sha: null }); continue; }
        let sha = ch.sha;
        if (!sha) {
          const body = ch.text != null ? { content: ch.text, encoding: 'utf-8' } : { content: bytesToB64(ch.bytes), encoding: 'base64' };
          sha = (await this.api(`/repos/${repo}/git/blobs`, { method: 'POST', body: JSON.stringify(body) })).sha;
        }
        if (cur.files[ch.path] !== sha) entries.push({ path: ch.path, mode: '100644', type: 'blob', sha });
      }
      if (!entries.length) return { head: cur.head, files: cur.files, changed: false };
      const tree = await this.api(`/repos/${repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: cur.tree, tree: entries }) });
      const commit = await this.api(`/repos/${repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [cur.head] }) });
      try {
        await this.api(`/repos/${repo}/git/refs/heads/${REPOS.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
        const files = { ...cur.files };
        for (const e of entries) { if (e.sha) files[e.path] = e.sha; else delete files[e.path]; }
        return { head: commit.sha, files, changed: true };
      } catch (e) { if (e.status !== 422) throw e; }             // someone committed in between: start over on the new head
    }
    throw new Error('GitHub kept changing under this save — try again in a moment.');
  }
}
