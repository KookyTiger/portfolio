#!/usr/bin/env python3
"""Bundle site/ into dist/index.html (single file, double-click-able, GitHub-Pages-able)
and dist/artifact.html (same page without the document skeleton, for the Artifact tool)."""
import re, pathlib, sys

ROOT = pathlib.Path(__file__).parent
SITE = ROOT / 'site'
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)

def read(p): return (SITE / p).read_text()

# 1) three: ES module → IIFE that returns the export map as a global THREE
three = read('vendor/three.module.min.js')
m = re.search(r'export\{([^}]*)\};?\s*$', three)
assert m, 'no export statement found in three'
body = three[:m.start()].rstrip()
pairs = []
for item in m.group(1).split(','):
    item = item.strip()
    if not item: continue
    if ' as ' in item:
        a, b = [x.strip() for x in item.split(' as ')]
    else:
        a = b = item
    pairs.append(f'{b}:{a}')
three_iife = 'const THREE=(()=>{' + body + '\nreturn {' + ','.join(pairs) + '};})();'

# 2) classic vendor scripts as-is
vendors = '\n'.join(read(f'vendor/{n}') for n in ['gsap.min.js', 'SplitText.min.js', 'CustomEase.min.js', 'lenis.min.js'])

# 3) content.js / app.js: strip module syntax
content = re.sub(r'^export ', '', read('content.js'), flags=re.M)
app = read('app.js')
app = re.sub(r"^import [^\n]*\n", '', app, flags=re.M)

css = read('style.css')
html = read('index.html')

# index.html is authored as a fragment (title/meta/links + body); split it
lines = html.split('\n')
head_lines = [l for l in lines if l.startswith('<title') or l.startswith('<meta') or l.startswith('<link rel="preconnect') or 'fonts.googleapis.com/css2' in l]
body_lines = [l for l in lines if not (l.startswith('<title') or l.startswith('<meta') or l.startswith('<link') or l.startswith('<script'))]
head = '\n'.join(head_lines) + '\n<style>\n' + css + '\n</style>'
body = '\n'.join(body_lines).strip()
scripts = ('<script>\n' + vendors + '\n</script>\n'
           '<script>\n' + three_iife + '\n</script>\n'
           '<script>\n(() => {\n"use strict";\n' + content + '\n' + app + '\n})();\n</script>')

full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        + head + '\n</head>\n<body>\n' + body + '\n' + scripts + '\n</body>\n</html>\n')
(DIST / 'index.html').write_text(full)
(DIST / 'artifact.html').write_text(head + '\n' + body + '\n' + scripts + '\n')
print('dist/index.html', len(full) // 1024, 'KB')
