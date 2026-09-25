# KookyTiger — descent/ (v2: the lift)

The tiger never walks. It rides a stone lift down a shaft, always on the right of the screen. Ledges with a
monster per project slide up past it on the left; each project is a DOM block on the left (title, description,
meta, takeaway, image slot). When a ledge aligns with the lift the monster hops to the edge, the tiger swipes once,
the monster pops into sparks and its loot floats to the tiger. At the bottom the shaft opens onto a meadow.

## Motion grammar (copied from the two reference sites)
- Léo Parpeix: the lift (and the camera riding it) is a straight linear function of scroll — `liftYAt()` in app.js —
  clamped at the landing; no easing of its own, the only smoothing is Lenis' lerp (.1). Header content parallaxes
  800px and fades between .2 and .45 of the header block. Text lines reveal with the (.4,0,0,1) 1.125s ease and
  replay when scrolled back.
- Laurens: the hero stays in frame while the world moves; the camera yaws/pitches with the mouse
  (maxYaw .028, maxPitch .03, damping .15); headlines tilt with the mouse (4px / 5px, .28° / .35°, damping .1);
  a 70vmin soft light blob follows the cursor; the sky flips at fixed thresholds (800ms, cubic-bezier(.37,0,.63,1)).
- Everything the monsters and the tiger do is a pure function of a = (liftY − ledgeY) / FLOOR_H (see FIGHT in content.js).

## Run it
Double-click `dist/index.html`. Source needs a local server: `python3 -m http.server 8000` → `preview.html`.
Rebuild: `python3 build.py . dist` (from inside descent/). Debug flags: `?snap=1`, `?bright=1`.

## Where things live
- `content.js` — copy, the 11 projects + monsters (`monster.kind` picks a body plan), FLOOR_H / BLOCK_VH, FIGHT windows, LIFT geometry, CAMERA / MOUSE numbers, lights, sky.
- `app.js` — engine: lift, shaft, ledges, torches, the shore, the 3D tiger, monster body plans (`BUILD`), the frame.
- `style.css` (`.proj` = the left project blocks), `index.html` (fragment; `preview.html` wraps it), `vendor/`.
