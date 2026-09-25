# KookyTiger — stack/ (P0: the scroll)

The Tetris-well portfolio. One scroll = one clock (Lenis); the world is three.js; text is GSAP SplitText.

## Run it

Double-click `dist/index.html` — it's a single self-contained file (fonts come from Google Fonts).

To work on the source (`index.html` + `app.js` + `content.js` + `style.css`) you need a local server because `app.js` is an ES module:

    cd stack
    python3 -m http.server 8000      # then open http://localhost:8000/preview.html

(`preview.html` is just `index.html` wrapped in a doctype/head/body — regenerate it with `python3 build.py`, which also rebuilds `dist/index.html`.)

## Where things live

- `content.js` — everything the page says or animates: pieces, copy, colours, camera rails, timing. Edit this first.
- `app.js` — the engine: Lenis clock, three.js well + tiger, drop logic, line clear, camera, HUD, cursor.
- `style.css` — the DOM layer: nav, hero, intro, card, HUD, archives, footer, light/dark ink flip.
- `vendor/` — three 0.170, gsap 3.13 (+SplitText, CustomEase), lenis 1.3.8. No build tools, no npm.
- `build.py` — bundles all of the above into `dist/index.html` (and `dist/artifact.html`, the same page without the document skeleton).

## Deploy

`dist/index.html` is the whole site. GitHub Pages: copy it to the repo root as `index.html`.
