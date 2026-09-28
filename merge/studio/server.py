#!/usr/bin/env python3
"""KookyTiger Studio — the local back office for the write-ups.

    python3 merge/studio/server.py          then open http://localhost:8010/merge/studio/
    (or double-click merge/studio/Open Studio.command)

The Studio's working data lives in merge/writeups-private/, a clone of the private repo KookyTiger/portfolio-studio-private
(the online Studio at kookytiger.github.io/portfolio/merge/studio/ edits the same repo through the GitHub API):
    public/<slug>.json      the public half of a write-up (what the site would show)
    <slug>.json             the private half (Claude's drafts, Kay's notes, questions, sources, log)
    pictures/<slug>/        the project's pictures; candidates/<slug>/ Drive pictures not chosen yet; vision/<slug>/
The public repo only receives what Kay approved: merge/writeups/<slug>.json and assets/projects/<slug>/ (plus the library,
merge/writeups/_studio.json). Pictures are named by their published path (assets/projects/<slug>/x.webp) everywhere.

This server merges the halves for the Studio and splits them on save, refuses a save made on top of an older version (409),
keeps a local save history, commits + pushes the private clone a few seconds after each save and pulls every 45 s, and
publishes approved write-ups into the public working tree; POST /api/publish commits and pushes them.

  GET  /api/state                   {studio, projects, hashes}
  GET  /api/hashes                  {hashes, sync, publish}
  PUT  /api/project/<slug>          {data, base} → {hash}; 409 {data, hash} if the files changed since `base`
  PUT  /api/studio                  {data, base}
  POST /api/upload/<slug>[?to=vision]  raw bytes, header X-Filename → a picture (or video) in pictures/<slug>/
  POST /api/promote/<slug>          {src: candidates/<slug>/x} → copied into pictures/<slug>/
  GET  /api/pictures/<slug>         {used, candidates}
  POST /api/publish                 commit + push the approved write-ups (public repo)
"""
import hashlib, http.server, json, pathlib, re, shutil, socketserver, subprocess, sys, threading, time, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[2]            # the public repo
LIVE = ROOT / 'merge' / 'writeups'                             # published: approved write-ups + the library (public repo)
PRIV = ROOT / 'merge' / 'writeups-private'                     # the private repo clone
WORK = PRIV / 'public'                                         # public halves while they are being written
PICS, CANDS, VISION = PRIV / 'pictures', PRIV / 'candidates', PRIV / 'vision'
HIST = PRIV / 'history'
ASSETS = ROOT / 'assets'
sys.path.insert(0, str(ROOT / 'merge' / 'tools'))
import pics                                                      # noqa: E402  (merge/tools/pics.py)
sys.path.insert(0, str(ROOT / 'merge'))
import writeups_export                                           # noqa: E402  (approved write-ups → merge/writeups.js for the site)

PRIVATE_BLOCK = ('draft', 'sources', 'questions', 'note', 'ok')
PRIVATE_PROJECT = ('log', 'drive', 'vision', 'legacy', 'notes')
PRIVATE_STUDIO = ('voice', 'notes')
ORDER_PROJECT = ('slug', 'name', 'floor', 'onSite', 'order', 'template', 'status', 'oneLiner', 'context', 'software', 'skills',
                 'classes', 'cover', 'blocks')
ORDER_BLOCK = ('id', 'stage', 'title', 'text', 'layout', 'media')
SLUG = re.compile(r'^[a-z0-9][a-z0-9-]{0,40}$')
PICTURE = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff', '.bmp', '.pdf'}
VIDEO = {'.mp4', '.mov', '.m4v', '.webm'}
SHOWN = {'.webp', '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm'}


def ordered(d, order):
    out = {k: d[k] for k in order if k in d}
    out.update({k: v for k, v in d.items() if k not in out})
    return out


def split_project(d):
    pub = {k: v for k, v in d.items() if k not in PRIVATE_PROJECT and k != 'blocks'}
    priv = {k: d[k] for k in PRIVATE_PROJECT if k in d}
    pub_blocks, priv_blocks = [], {}
    for b in d.get('blocks', []):
        pub_blocks.append(ordered({k: v for k, v in b.items() if k not in PRIVATE_BLOCK}, ORDER_BLOCK))
        pb = {k: b[k] for k in PRIVATE_BLOCK if k in b}
        if pb: priv_blocks[b['id']] = pb
    pub['blocks'] = pub_blocks
    priv['blocks'] = priv_blocks
    return ordered(pub, ORDER_PROJECT), priv


def merge_project(pub, priv):
    d = dict(pub)
    d.update({k: v for k, v in priv.items() if k != 'blocks'})
    pb = priv.get('blocks', {})
    d['blocks'] = [{**b, **pb.get(b.get('id'), {})} for b in pub.get('blocks', [])]
    return d


def read_json(p, default=None):
    try: return json.loads(p.read_text())
    except FileNotFoundError: return default
    except json.JSONDecodeError as e: raise ValueError(f'{p.relative_to(ROOT)} is not valid JSON: {e}')


def dump(d):
    return json.dumps(d, ensure_ascii=False, indent=2) + '\n'


def file_hash(*paths):
    h = hashlib.sha1()
    for p in paths: h.update(p.read_bytes() if p.exists() else b'-')
    return h.hexdigest()[:12]


def slugs():
    names = {p.stem for p in WORK.glob('*.json')} | {p.stem for p in PRIV.glob('*.json')}
    return sorted(n for n in names if not n.startswith('_') and SLUG.match(n))


def project_paths(slug): return WORK / f'{slug}.json', PRIV / f'{slug}.json'
def studio_paths(): return LIVE / '_studio.json', PRIV / '_studio.json'


def load_project(slug):
    a, b = project_paths(slug)
    return merge_project(read_json(a, {'slug': slug, 'blocks': []}), read_json(b, {})), file_hash(a, b)


def load_studio():
    a, b = studio_paths()
    return {**read_json(a, {}), **read_json(b, {})}, file_hash(a, b)


def keep_history(name, paths):
    stamp = time.strftime('%Y%m%d-%H%M%S')
    d = HIST / name; d.mkdir(parents=True, exist_ok=True)
    for p in paths:
        if p.exists(): shutil.copy2(p, d / f'{stamp}-{p.parent.name}.json')
    for p in sorted(d.glob('*.json'))[:-80]: p.unlink()           # the last 40 saves (two files each)


# ── publishing: an approved write-up (and the pictures it uses) is copied into the public working tree ──
def pictures_of(slug, pub):
    """Published paths of the pictures a write-up shows: assets/projects/<slug>/<file>."""
    srcs = [m.get('src', '') for b in pub.get('blocks', []) for m in b.get('media', [])] + [pub.get('cover', '')]
    return sorted({s for s in srcs if s.startswith(f'assets/projects/{slug}/')})


def publish_local(slug, pub):
    live = LIVE / f'{slug}.json'
    if pub.get('status') == 'approved' and pub.get('onSite'):
        for src in pictures_of(slug, pub):
            dst, work = ROOT / src, PICS / slug / pathlib.Path(src).name
            if work.exists() and (not dst.exists() or dst.read_bytes() != work.read_bytes()):
                dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(work, dst)
        if not live.exists() or live.read_text() != dump(pub): live.write_text(dump(pub))
    elif live.exists():                                            # un-approved: off the site, pictures too
        live.unlink()
        shutil.rmtree(ASSETS / 'projects' / slug, ignore_errors=True)
    try: writeups_export.export(ROOT / 'merge')
    except Exception as e: sys.stderr.write(f'writeups.js not refreshed: {e}\n')


def git(repo, *a, timeout=90):
    return subprocess.run(['git', '-C', str(repo), *a], capture_output=True, text=True, timeout=timeout)


def publish_paths():
    paths = ['merge/writeups', 'merge/writeups.js']
    tracked = git(ROOT, 'ls-files', 'assets/projects').stdout.split('\n')
    dirs = {'/'.join(p.split('/')[:3]) for p in tracked if p.count('/') >= 3}
    dirs |= {f'assets/projects/{d.name}' for d in (ASSETS / 'projects').iterdir() if d.is_dir() and SLUG.match(d.name)}
    return paths + sorted(dirs)


def publish_pending():
    out = git(ROOT, 'status', '--porcelain', '--', *publish_paths()).stdout.strip()
    return len(out.split('\n')) if out else 0


def publish_push():
    paths = publish_paths()
    git(ROOT, 'add', '-A', '--', *paths)
    if git(ROOT, 'diff', '--cached', '--quiet', '--', *paths).returncode == 0: return {'ok': True, 'message': 'Nothing to publish.'}
    names = sorted({pathlib.Path(p).stem for p in git(ROOT, 'diff', '--cached', '--name-only', '--', 'merge/writeups').stdout.split()})
    msg = f'Publish from the Studio: {", ".join(n for n in names if not n.startswith("_")) or "library"}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
    r = git(ROOT, 'commit', '-m', msg, '--', *paths)
    if r.returncode: raise ValueError(f'git commit failed: {r.stderr.strip() or r.stdout.strip()}')
    r = git(ROOT, 'pull', '--rebase', '--autostash')
    if r.returncode: raise ValueError(f'git pull failed (tell Claude): {r.stderr.strip()[-300:]}')
    r = git(ROOT, 'push', 'origin', 'HEAD')
    if r.returncode: raise ValueError(f'git push failed (tell Claude): {r.stderr.strip()[-300:]}')
    return {'ok': True, 'message': 'Published. GitHub rebuilds the site in a minute or two.'}


# ── the private clone follows GitHub: commit + push after saves, pull every 45 s ──
class Sync:
    def __init__(self):
        self.lock, self.timer, self.state = threading.Lock(), None, {'ok': True, 'error': '', 'at': ''}

    def enabled(self): return (PRIV / '.git').exists()

    def touch(self):
        if not self.enabled(): return
        if self.timer: self.timer.cancel()
        self.timer = threading.Timer(4, self.push); self.timer.daemon = True; self.timer.start()

    def _set(self, ok, error=''):
        self.state = {'ok': ok, 'error': error[-400:], 'at': time.strftime('%H:%M:%S')}
        if error: sys.stderr.write(f'sync: {error}\n')

    def push(self):
        with self.lock:
            try:
                git(PRIV, 'add', '-A')
                if git(PRIV, 'diff', '--cached', '--quiet').returncode:
                    changed = sorted({pathlib.Path(p).stem for p in git(PRIV, 'diff', '--cached', '--name-only').stdout.split()})
                    git(PRIV, 'commit', '-m', 'Studio (local): ' + ', '.join(changed[:8]))
                r = git(PRIV, 'pull', '--rebase', '--autostash')
                if r.returncode: git(PRIV, 'rebase', '--abort'); return self._set(False, 'pull: ' + r.stderr.strip())
                r = git(PRIV, 'push', '-q', 'origin', 'main')
                self._set(r.returncode == 0, '' if r.returncode == 0 else 'push: ' + r.stderr.strip())
            except Exception as e: self._set(False, str(e))

    def pull(self):
        if not self.enabled() or (self.timer and self.timer.is_alive()): return
        with self.lock:
            try:
                if git(PRIV, 'status', '--porcelain').stdout.strip(): return self.touch()   # local edits go up first
                r = git(PRIV, 'pull', '-q', '--rebase')
                if r.returncode: git(PRIV, 'rebase', '--abort')
                self._set(r.returncode == 0, '' if r.returncode == 0 else 'pull: ' + r.stderr.strip())
            except Exception as e: self._set(False, str(e))

    def loop(self):
        while True:
            self.pull(); time.sleep(45)


SYNC = Sync()


def save_project(slug, data):
    a, b = project_paths(slug)
    data = dict(data); data['slug'] = slug
    ids = [blk.get('id') for blk in data.get('blocks', [])]
    if len(ids) != len(set(ids)) or not all(ids): raise ValueError('every block needs its own id')
    pub, priv = split_project(data)
    keep_history(slug, (a, b))
    a.parent.mkdir(parents=True, exist_ok=True)
    a.write_text(dump(pub)); b.write_text(dump(priv))
    publish_local(slug, pub)
    SYNC.touch()
    return file_hash(a, b)


def save_studio(data):
    a, b = studio_paths()
    pub = {k: v for k, v in data.items() if k not in PRIVATE_STUDIO}
    priv = {k: data[k] for k in PRIVATE_STUDIO if k in data}
    keep_history('_studio', (a, b))
    a.write_text(dump(pub)); b.write_text(dump(priv))
    try: writeups_export.export(ROOT / 'merge')
    except Exception as e: sys.stderr.write(f'writeups.js not refreshed: {e}\n')
    SYNC.touch()
    return file_hash(a, b)


def clean_name(name):
    return re.sub(r'[^a-z0-9]+', '-', pathlib.Path(name).stem.lower()).strip('-')[:48] or 'picture'


def unique(path):
    if not path.exists(): return path
    i = 2
    while True:
        p = path.with_name(f'{path.stem}-{i}{path.suffix}')
        if not p.exists(): return p
        i += 1


def store_upload(slug, filename, raw, vision=False):
    """A picture for the page → pictures/<slug>/ (src assets/projects/<slug>/…); vision=True → vision/<slug>/ (src vision/<slug>/…)."""
    ext = pathlib.Path(filename).suffix.lower()
    if ext not in PICTURE | VIDEO | {'.gif'}: raise ValueError(f'{ext or "this file"} is not a picture or video')
    src_dir = ASSETS / 'src' / 'uploads' / slug; src_dir.mkdir(parents=True, exist_ok=True)
    orig = unique(src_dir / f'{clean_name(filename)}{ext}'); orig.write_bytes(raw)
    out_dir = (VISION if vision else PICS) / slug; out_dir.mkdir(parents=True, exist_ok=True)
    if ext == '.gif':
        out = unique(out_dir / f'{orig.stem}.gif'); shutil.copy2(orig, out)
    elif ext in VIDEO:
        out = unique(out_dir / f'{orig.stem}.mp4')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(orig), '-an', '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264',
                        '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(out)], check=True)
    else:
        out = unique(out_dir / f'{orig.stem}.webp'); pics.to_webp(orig, out, 1600, 80)
    SYNC.touch()
    return {'src': f'{"vision" if vision else "assets/projects"}/{slug}/{out.name}', 'bytes': out.stat().st_size}


def promote(slug, src):
    src = re.sub(r'^assets/src/candidates/', 'candidates/', src)
    p = (PRIV / src).resolve()
    if CANDS.resolve() not in p.parents or not p.exists(): raise ValueError('only Drive candidates can be promoted')
    if p.name.upper().startswith('PRIVATE'):                       # Claude marks client data that never left the team this way
        raise ValueError('Claude marked this picture PRIVATE (client data that is not in the final deliverable). '
                         'If you are sure it can be public, rename the file without PRIVATE- and pick it again.')
    out = PICS / slug / p.name
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(p, out); SYNC.touch()
    return {'src': f'assets/projects/{slug}/{out.name}', 'bytes': out.stat().st_size}


def pictures(slug):
    def ls(d, prefix):
        if not d.exists(): return []
        return [{'src': f'{prefix}/{p.name}', 'name': p.name, 'bytes': p.stat().st_size} for p in sorted(d.iterdir()) if p.suffix.lower() in SHOWN]
    return {'used': ls(PICS / slug, f'assets/projects/{slug}'), 'candidates': ls(CANDS / slug, f'candidates/{slug}')}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.md': 'text/plain; charset=utf-8',
                      '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp'}

    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)

    def translate_path(self, path):
        p = super().translate_path(path)                         # a picture not published yet is served from the private clone
        m = re.match(r'^/assets/projects/([a-z0-9-]+)/([^/?#]+)', urllib.parse.unquote(path))
        if m and not pathlib.Path(p).exists():
            alt = PICS / m.group(1) / m.group(2)
            if alt.exists(): return str(alt)
        return p

    def log_message(self, fmt, *args):
        if '/api/hashes' not in (args[0] if args else ''): sys.stderr.write('%s\n' % (fmt % args))

    def end_headers(self):
        if self.path.startswith('/api/') or self.path.endswith(('.json', '.js', '.css', '.html')) or '/merge/' in self.path:
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return self.rfile.read(n) if n else b''

    def route(self):
        u = urllib.parse.urlparse(self.path); parts = [urllib.parse.unquote(x) for x in u.path.strip('/').split('/')]
        return parts[1:] if parts[:1] == ['api'] else None

    def guard(self, fn):
        try: fn()
        except ValueError as e: self.send_json({'error': str(e)}, 400)
        except Exception as e:                                     # keep the server up; tell the Studio what broke
            self.send_json({'error': f'{type(e).__name__}: {e}'}, 500)

    def do_GET(self):
        r = self.route()
        if r is None:
            if self.path in ('/', '/studio', '/studio/'): self.send_response(302); self.send_header('Location', '/merge/studio/'); self.end_headers(); return
            return super().do_GET()
        def run():
            if r == ['state']:
                studio, sh = load_studio(); projects, hashes = {}, {'_studio': sh}
                for s in slugs(): projects[s], hashes[s] = load_project(s)
                self.send_json({'studio': studio, 'projects': projects, 'hashes': hashes, 'mode': 'local'})
            elif r == ['hashes']:
                h = {'_studio': file_hash(*studio_paths())}
                h.update({s: file_hash(*project_paths(s)) for s in slugs()})
                self.send_json({'hashes': h, 'sync': SYNC.state if SYNC.enabled() else None, 'publish': {'pending': publish_pending()}})
            elif len(r) == 2 and r[0] == 'project' and SLUG.match(r[1]):
                d, h = load_project(r[1]); self.send_json({'data': d, 'hash': h})
            elif len(r) == 2 and r[0] == 'pictures' and SLUG.match(r[1]):
                self.send_json(pictures(r[1]))
            else: self.send_json({'error': 'not found'}, 404)
        self.guard(run)

    def do_PUT(self):
        r = self.route()
        def run():
            msg = json.loads(self.body() or b'{}')
            if r == ['studio']:
                cur = file_hash(*studio_paths())
                if msg.get('base') and msg['base'] != cur:
                    d, h = load_studio(); return self.send_json({'conflict': True, 'data': d, 'hash': h}, 409)
                self.send_json({'hash': save_studio(msg['data'])})
            elif r and len(r) == 2 and r[0] == 'project' and SLUG.match(r[1]):
                cur = file_hash(*project_paths(r[1]))
                if msg.get('base') and msg['base'] != cur:
                    d, h = load_project(r[1]); return self.send_json({'conflict': True, 'data': d, 'hash': h}, 409)
                self.send_json({'hash': save_project(r[1], msg['data'])})
            else: self.send_json({'error': 'not found'}, 404)
        self.guard(run)

    def do_POST(self):
        r = self.route()
        def run():
            if r and len(r) == 2 and r[0] == 'upload' and SLUG.match(r[1]):
                name = urllib.parse.unquote(self.headers.get('X-Filename') or 'picture.jpg')
                vision = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('to') == ['vision']
                self.send_json(store_upload(r[1], name, self.body(), vision))
            elif r and len(r) == 2 and r[0] == 'promote' and SLUG.match(r[1]):
                self.send_json(promote(r[1], json.loads(self.body() or b'{}').get('src', '')))
            elif r == ['publish']:
                self.send_json(publish_push())
            else: self.send_json({'error': 'not found'}, 404)
        self.guard(run)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8010
    for d in (LIVE, PRIV, WORK, HIST): d.mkdir(parents=True, exist_ok=True)
    if SYNC.enabled(): threading.Thread(target=SYNC.loop, daemon=True).start()
    print(f'KookyTiger Studio → http://localhost:{port}/merge/studio/   (Ctrl+C to stop)', flush=True)
    Server(('127.0.0.1', port), Handler).serve_forever()
