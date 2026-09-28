#!/usr/bin/env python3
"""KookyTiger Studio — the local back office for the write-ups.

    python3 merge/studio/server.py          then open http://localhost:8010/merge/studio/

Serves the repo (the Studio, the site's CSS/fonts/assets share paths) and a small JSON API. The repo is public, so each
project is stored in two halves (see merge/writeups/README.md): merge/writeups/<slug>.json (what the site shows, in git) and
merge/writeups-private/<slug>.json (drafts, notes, questions, sources, log — local only). This server merges them for the
Studio and splits them again on save, keeps a save history, and refuses a save made on top of an older version (409), so Kay's
edits and Claude's edits never silently overwrite each other.

  GET  /api/state                   {studio, projects, hashes}
  GET  /api/hashes                  {slug: hash} — the Studio polls this to notice Claude's edits
  PUT  /api/project/<slug>          {data, base} → saved, {hash}; 409 {data, hash} if the file changed since `base`
  PUT  /api/studio                  {data, base}
  POST /api/upload/<slug>           raw bytes, header X-Filename → a picture (or video) in assets/projects/<slug>/
  POST /api/promote/<slug>          {src} → a Drive candidate copied into assets/projects/<slug>/
  GET  /api/pictures/<slug>         {used, candidates}
"""
import hashlib, http.server, json, pathlib, re, shutil, socketserver, subprocess, sys, time, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[2]            # the repo
PUB = ROOT / 'merge' / 'writeups'
PRIV = ROOT / 'merge' / 'writeups-private'
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
    names = {p.stem for p in PUB.glob('*.json') if not p.stem.startswith('_')}
    names |= {p.stem for p in PRIV.glob('*.json') if not p.stem.startswith('_')}
    return sorted(names)


def project_paths(slug): return PUB / f'{slug}.json', PRIV / f'{slug}.json'
def studio_paths(): return PUB / '_studio.json', PRIV / '_studio.json'


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
    old = sorted(d.glob('*.json'))
    for p in old[:-80]: p.unlink()                                 # keep the last 40 saves (two files each)


def refresh_site():
    """Approving (or un-approving) a write-up changes what the site's panel shows: regenerate merge/writeups.js."""
    try: writeups_export.export(ROOT / 'merge')
    except Exception as e: sys.stderr.write(f'writeups.js not refreshed: {e}\n')


def save_project(slug, data):
    a, b = project_paths(slug)
    data = dict(data); data['slug'] = slug
    ids = [blk.get('id') for blk in data.get('blocks', [])]
    if len(ids) != len(set(ids)) or not all(ids): raise ValueError('every block needs its own id')
    pub, priv = split_project(data)
    keep_history(slug, (a, b))
    a.write_text(dump(pub)); b.write_text(dump(priv))
    refresh_site()
    return file_hash(a, b)


def save_studio(data):
    a, b = studio_paths()
    pub = {k: v for k, v in data.items() if k not in PRIVATE_STUDIO}
    priv = {k: data[k] for k in PRIVATE_STUDIO if k in data}
    keep_history('_studio', (a, b))
    a.write_text(dump(pub)); b.write_text(dump(priv))
    refresh_site()
    return file_hash(a, b)


def clean_name(name):
    stem = re.sub(r'[^a-z0-9]+', '-', pathlib.Path(name).stem.lower()).strip('-')[:48] or 'picture'
    return stem


def unique(path):
    if not path.exists(): return path
    i = 2
    while True:
        p = path.with_name(f'{path.stem}-{i}{path.suffix}')
        if not p.exists(): return p
        i += 1


def web(p): return str(p.relative_to(ROOT))


def store_upload(slug, filename, raw, vision=False):
    """A picture for the page → assets/projects/<slug>/ (public). vision=True: a private reference → assets/src/vision/<slug>/."""
    ext = pathlib.Path(filename).suffix.lower()
    if ext not in PICTURE | VIDEO | {'.gif'}: raise ValueError(f'{ext or "this file"} is not a picture or video')
    src_dir = ASSETS / 'src' / 'uploads' / slug; src_dir.mkdir(parents=True, exist_ok=True)
    orig = unique(src_dir / f'{clean_name(filename)}{ext}'); orig.write_bytes(raw)
    out_dir = ASSETS / ('src/vision' if vision else 'projects') / slug; out_dir.mkdir(parents=True, exist_ok=True)
    if ext == '.gif':                                              # keep animation
        out = unique(out_dir / f'{orig.stem}.gif'); shutil.copy2(orig, out)
    elif ext in VIDEO:                                             # small silent loop for the page
        out = unique(out_dir / f'{orig.stem}.mp4')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(orig), '-an', '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264',
                        '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(out)], check=True)
    else:
        out = unique(out_dir / f'{orig.stem}.webp'); pics.to_webp(orig, out, 1600, 80)
    return {'src': web(out), 'bytes': out.stat().st_size}


def promote(slug, src):
    p = (ROOT / src).resolve()
    cand = (ASSETS / 'src').resolve()
    if cand not in p.parents or not p.exists(): raise ValueError('only pictures under assets/src/ can be promoted')
    if p.name.upper().startswith('PRIVATE'):                       # Claude marks client data that never left the team this way
        raise ValueError('Claude marked this picture PRIVATE (client data that is not in the final deliverable). '
                         'If you are sure it can be public, rename the file without PRIVATE- and pick it again.')
    out_dir = ASSETS / 'projects' / slug; out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f'{clean_name(p.name)}{".gif" if p.suffix.lower() == ".gif" else ".webp"}'
    if out.exists(): return {'src': web(out), 'bytes': out.stat().st_size, 'existed': True}
    if p.suffix.lower() == '.gif': shutil.copy2(p, out)
    else: pics.to_webp(p, out, 1600, 80)
    return {'src': web(out), 'bytes': out.stat().st_size}


def pictures(slug):
    def ls(d):
        if not d.exists(): return []
        return [{'src': web(p), 'name': p.name, 'bytes': p.stat().st_size} for p in sorted(d.iterdir())
                if p.suffix.lower() in {'.webp', '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm'}]
    return {'used': ls(ASSETS / 'projects' / slug), 'candidates': ls(ASSETS / 'src' / 'candidates' / slug)}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.md': 'text/plain; charset=utf-8',
                      '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp'}

    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)

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
                self.send_json({'studio': studio, 'projects': projects, 'hashes': hashes})
            elif r == ['hashes']:
                h = {'_studio': file_hash(*studio_paths())}
                h.update({s: file_hash(*project_paths(s)) for s in slugs()})
                self.send_json(h)
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
            else: self.send_json({'error': 'not found'}, 404)
        self.guard(run)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8010
    for d in (PUB, PRIV, HIST): d.mkdir(parents=True, exist_ok=True)
    print(f'KookyTiger Studio → http://localhost:{port}/merge/studio/   (Ctrl+C to stop)', flush=True)
    Server(('127.0.0.1', port), Handler).serve_forever()
