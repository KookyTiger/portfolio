# KookyTiger — lanterns/ (P0: lanterns × snow)

A 3D tiger walks a snowy night and lights one lantern per project. Footprints trail behind it.
The path is a T (seven lanterns wide, then five deep). The twelfth lantern stays dark: it's the reader's.

Same engine as stack/ (Lenis clock, three.js world, GSAP SplitText, camera rails per block, sky flip).

## Run it

Double-click `dist/index.html` (single self-contained file; fonts from Google Fonts).

Source needs a local server (app.js is an ES module):

    cd lanterns
    python3 -m http.server 8000      # → http://localhost:8000/preview.html

Rebuild `dist/index.html` after editing: `python3 build.py . dist` (run from inside lanterns/).

Debug flags: `?snap=1` (camera snaps instead of easing — for screenshots), `?bright=1` (flat work light).

## Where things live

- `content.js` — copy, the 12 lanterns (11 projects + yours), lantern positions (the T), camera rigs, lights, sky.
- `app.js` — engine: path + footprints, lantern lighting, the 3D tiger (boxes: head, 王, ears, blush, stripes, legs, tail), walk / run / reach / sit, camera rigs (bar, turn, stem, dawn), HUD, cursor, quips.
- `style.css` — DOM layer. `index.html` — the page (fragment; `preview.html` wraps it in a doctype).
- `vendor/` — three 0.170, gsap 3.13 (+SplitText, CustomEase), lenis 1.3.8.
