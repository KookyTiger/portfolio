# KookyTiger — merge/ (Léo × Laurens layout, placeholder demo)

Paper blocks carry the words (Léo: hero, intro, two statements, archives, footer). Three windows show the world:
the tiger on a lift on the right, project cards rising past it on the left (Laurens). Cards are paper in Léo's
project format; the picture on each card is a flat silhouette of the object (placeholder), not a box.

## Camera
The lift's height is a linear function of page scroll — `liftYAt()` in app.js — everywhere, paper included, so the
tiger has descended further each time a window opens. The camera rides the lift (Léo's rail); the only smoothing is
Lenis (.1). Header: z backs off 1.4 and pitch dips .05 over the 2-screen header. Shore: camera drops .9, backs 1.2,
tilts to -.14. Mouse yaw .028 / pitch .03, damping .15; headline tilt 4 / 5 px, .28 / .35 deg (Laurens).

## Run it
Double-click `dist/index.html`. Source needs a local server (`python3 -m http.server 8000` → `preview.html`).
Rebuild: `python3 build.py . dist` from inside merge/. `?snap=1` snaps the camera for screenshots.

## Where things live
- `content.js` — projects (with `sil` = which silhouette), `SIL` (the placeholder SVG silhouettes — replace with real
  cut-out photos later), WINDOWS (which projects go in which window), copy, camera / mouse / light numbers.
- `app.js` — builds the DOM sections from content, the world (shaft, lift, tiger, ledges, shore), the frame.
- `style.css` — Léo's grid (12 cols, 20px), paper blocks, `.card` (8 columns, object silhouette with a soft shadow), statements, footer.
