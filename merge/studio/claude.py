#!/usr/bin/env python3
"""Claude's side of the Studio — run from the repo root.

  python3 merge/studio/claude.py changes          what Kay changed since Claude last looked (text diffs, answers, notes, pictures)
  python3 merge/studio/claude.py mark             Claude has read everything: remember this state as "seen"
  python3 merge/studio/claude.py import SLUG…     bring research drafts (writeups-private/drafts/<slug>.json) into the Studio
                                                  (refuses to replace blocks Kay has edited unless --force)
  python3 merge/studio/claude.py check            missing pictures, unknown software/class ids, duplicate block ids, empty stages
  python3 merge/studio/claude.py seed-legacy      one-off: create a Studio project for every PIECE in content.js (old copy kept as `legacy`)
"""
import difflib, json, pathlib, subprocess, sys, tempfile, textwrap
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import server as S                                              # split/merge/load/save live there

ROOT, PRIV = S.ROOT, S.PRIV
SEEN = PRIV / 'seen'
DRAFTS = PRIV / 'drafts'

# The Drive folder of each project (KAY-PORTFOLIO), for the Studio's "Drive folder ↗" button. Private: folder names name partners.
DRIVE = {k: tuple(v) for k, v in (S.read_json(PRIV / '_drive-map.json', {}) or {}).items()}
SLUG_OF = ['levelup', 'notipclip', 'slidemaster', 'gamejam', 'giftme', 'plu', 'neighbors', 'scenic', 'onebirth', 'austin', 'alv', 'yello', 'amg']


def projects():
    return {s: S.load_project(s)[0] for s in S.slugs()}


def studio():
    return S.load_studio()[0]


def wrap(s, pre='      '):
    return textwrap.indent(textwrap.fill(s, 110), pre)


def word_diff(a, b):
    A, B = a.split(), b.split(); out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, A, B).get_opcodes():
        if op == 'equal': out.append(' '.join(A[i1:i2]) if i2 - i1 < 8 else f'{" ".join(A[i1:i1 + 3])} … {" ".join(A[i2 - 3:i2])}')
        if op in ('delete', 'replace'): out.append('[-' + ' '.join(A[i1:i2]) + '-]')
        if op in ('insert', 'replace'): out.append('{+' + ' '.join(B[j1:j2]) + '+}')
    return ' '.join(out)


def cmd_changes():
    cur, lines = projects(), []
    for slug, p in cur.items():
        old = S.read_json(SEEN / f'{slug}.json')
        if old is None: lines.append(f'\n■ {p.get("name", slug)} — new since last look'); old = {'blocks': []}
        head = []
        for k in ('name', 'status', 'floor', 'onSite', 'template', 'oneLiner', 'context', 'software', 'skills', 'classes', 'cover'):
            if old.get(k) != p.get(k): head.append(f'   {k}: {json.dumps(old.get(k), ensure_ascii=False)} → {json.dumps(p.get(k), ensure_ascii=False)}')
        ob = {b['id']: b for b in old.get('blocks', [])}; nb = {b['id']: b for b in p.get('blocks', [])}
        body = []
        if [b['id'] for b in old.get('blocks', [])] != [b['id'] for b in p.get('blocks', [])]:
            body.append(f'   block order: {[b["id"] for b in old.get("blocks", [])]} → {[b["id"] for b in p.get("blocks", [])]}')
        for bid, b in nb.items():
            o = ob.get(bid, {}); ch = []
            for k in ('stage', 'layout', 'ok'):
                if o.get(k) != b.get(k): ch.append(f'{k}: {o.get(k)} → {b.get(k)}')
            if o.get('title') != b.get('title'): ch.append(f'title: “{o.get("title", "")}” → “{b.get("title", "")}”')
            if (o.get('text') or '') != (b.get('text') or ''): ch.append('text: ' + word_diff(o.get('text') or '', b.get('text') or ''))
            if [m.get('src') for m in o.get('media', [])] != [m.get('src') for m in b.get('media', [])]: ch.append(f'pictures: {[m.get("src") for m in b.get("media", [])]}')
            elif [(m.get('caption'), m.get('kind')) for m in o.get('media', [])] != [(m.get('caption'), m.get('kind')) for m in b.get('media', [])]: ch.append('captions/kinds edited')
            if (o.get('note') or '') != (b.get('note') or '') and (b.get('note') or '').strip(): ch.append(f'NOTE FROM KAY: {b["note"]}')
            oq = {q.get('q'): q.get('a', '') for q in o.get('questions', [])}
            for q in b.get('questions', []):
                if (q.get('a') or '').strip() and (q.get('a') or '') != oq.get(q.get('q'), ''): ch.append(f'ANSWER — {q["q"]}\n        → {q["a"]}')
            if ch: body.append(f'   [{bid}]\n' + '\n'.join(wrap(c) for c in ch))
        for bid in ob.keys() - nb.keys(): body.append(f'   [{bid}] deleted')
        ol = len(old.get('log', [])); newlog = [e for e in p.get('log', [])[ol:] if e.get('by') == 'kay']
        body += [f'   LOG FROM KAY: {e["text"]}' for e in newlog]
        if (old.get('vision') or {}) != (p.get('vision') or {}): body.append(f'   vision: {json.dumps(p.get("vision"), ensure_ascii=False)}')
        if head or body: lines.append(f'\n■ {p.get("name", slug)} ({slug})'); lines += head + body
    st, ost = studio(), S.read_json(SEEN / '_studio.json', {})
    for k in ('voice', 'notes', 'floors', 'templates', 'software', 'classes', 'skills'):
        if ost.get(k) != st.get(k):
            lines.append(f'\n■ Studio: {k} changed')
            if k in ('voice', 'notes'): lines.append(wrap(word_diff(ost.get(k) or '', st.get(k) or '')))
    print('\n'.join(lines) if lines else 'Nothing changed since the last `mark`.')


def cmd_mark():
    SEEN.mkdir(parents=True, exist_ok=True)
    for slug, p in projects().items(): (SEEN / f'{slug}.json').write_text(S.dump(p))
    (SEEN / '_studio.json').write_text(S.dump(studio()))
    print('Marked as seen.')


def kay_touched(p):
    return any((b.get('draft') is not None and b.get('draft') != b.get('text')) or b.get('ok') or (b.get('note') or '').strip()
               or any((q.get('a') or '').strip() for q in b.get('questions', [])) for b in p.get('blocks', [])) \
        or any(e.get('by') == 'kay' for e in p.get('log', []))


def cmd_import(slugs, force=False):
    for slug in slugs:
        src = DRAFTS / f'{slug}.json'
        if not src.exists(): print(f'{slug}: no draft at {src.relative_to(ROOT)}'); continue
        d = json.loads(src.read_text()); cur = S.load_project(slug)[0] if slug in S.slugs() else {}
        if cur and kay_touched(cur) and not force: print(f'{slug}: Kay has edited it — not replacing (use --force, or merge by hand)'); continue
        for k in ('legacy', 'order', 'cover', 'name'):             # keep what the seed knew
            if cur.get(k) not in (None, '') and not d.get(k): d[k] = cur[k]
        if slug in DRIVE: d['drive'] = {**d.get('drive', {}), 'path': DRIVE[slug][0], 'folder': DRIVE[slug][1]}
        for b in d.get('blocks', []):
            b.setdefault('draft', b.get('text', '')); b.setdefault('questions', []); b.setdefault('media', [])
            for m in b['media']:                                   # a block may only show public pictures
                if str(m.get('src', '')).startswith(('assets/src/', 'candidates/')): m['src'] = S.promote(slug, m['src'])['src']
        d['slug'] = slug
        S.save_project(slug, d)
        print(f'{slug}: imported ({len(d.get("blocks", []))} blocks)')


def cmd_check():
    st = studio(); sw = {s['id'] for s in st.get('software', [])}; cl = {c['id'] for c in st.get('classes', [])}
    problems = 0
    for slug, p in projects().items():
        out = []
        ids = [b.get('id') for b in p.get('blocks', [])]
        if len(ids) != len(set(ids)): out.append('duplicate block ids')
        out += [f'unknown software id {x}' for x in p.get('software', []) if x not in sw]
        out += [f'unknown class id {x}' for x in p.get('classes', []) if x not in cl]
        for b in p.get('blocks', []):
            for m in b.get('media', []):
                src = m.get('src', '')
                found = (ROOT / src).exists() or (S.PICS / slug / pathlib.Path(src).name).exists()
                if src and not found: out.append(f'[{b["id"]}] missing picture {src}')
                if src.startswith(('assets/src/', 'candidates/')): out.append(f'[{b["id"]}] {src} is a candidate — promote it into pictures/{slug}/')
        cov = p.get('cover') or ''
        if cov and not ((ROOT / cov).exists() or (S.PICS / slug / pathlib.Path(cov).name).exists()): out.append(f'missing cover {cov}')
        for s in p.get('skills', []):
            if s.get('evidence') and s['evidence'] not in ids: out.append(f'skill “{s["name"]}” points at missing block {s["evidence"]}')
        if out: problems += len(out); print(f'{slug}:\n' + '\n'.join('  ' + o for o in out))
    print('OK' if not problems else f'{problems} problem(s)')


def cmd_seed_legacy():
    tmp = pathlib.Path(tempfile.mkdtemp()) / 'content.mjs'
    tmp.write_text((ROOT / 'merge/content.js').read_text())
    js = f"import('{tmp}').then(m => console.log(JSON.stringify({{P: m.PIECES, S: m.SECTIONS}})))"
    data = json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout)
    st = studio(); tmpl = {'engineering': 'engineering', 'design': 'design', 'analytics': 'analytics'}
    floor_of = {}
    for fi, sec in enumerate(data['S']):
        for order, pi in enumerate(sec['pieces']): floor_of[pi] = (['engineering', 'design', 'analytics'][fi], order)
    for pi, piece in enumerate(data['P']):
        slug = SLUG_OF[pi]
        if slug in S.slugs(): print(f'{slug}: exists, skipped'); continue
        floor, order = floor_of[pi]; t = st['templates'][tmpl[floor]]
        d = piece.get('detail', {})
        legacy = {k: v for k, v in {'card': piece.get('desc'), 'take': piece.get('take'), 'tags': piece.get('meta'), 'year': piece.get('year'),
                                    'line': d.get('line'), 'role': d.get('role'), 'tools': d.get('tools'), 'numbers': d.get('numbers'),
                                    'one': d.get('one'), 'todo': d.get('todo')}.items() if v}
        p = {'slug': slug, 'name': piece['name'], 'floor': floor, 'onSite': True, 'order': order, 'template': tmpl[floor], 'status': 'draft',
             'oneLiner': '', 'context': {}, 'software': [], 'skills': [], 'classes': [], 'cover': piece.get('img', ''),
             'blocks': [{'id': s['key'], 'stage': s['key'], 'title': '', 'text': '', 'layout': 'text', 'media': []} for s in t['stages']],
             'legacy': legacy, 'log': [{'by': 'claude', 'at': '2026-09-27', 'text': 'Placeholder from the old site copy; Claude is drafting it from the Drive.'}]}
        if slug in DRIVE: p['drive'] = {'path': DRIVE[slug][0], 'folder': DRIVE[slug][1]}
        S.save_project(slug, p); print(f'{slug}: seeded')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(1)
    if a[0] == 'changes': cmd_changes()
    elif a[0] == 'mark': cmd_mark()
    elif a[0] == 'import': cmd_import([x for x in a[1:] if not x.startswith('--')], '--force' in a)
    elif a[0] == 'check': cmd_check()
    elif a[0] == 'seed-legacy': cmd_seed_legacy()
    else: print(__doc__); sys.exit(1)
