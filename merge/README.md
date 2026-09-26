# KookyTiger — merge/ (the live site)

Read `../CLAUDE.md` first: it has Kay's ground rules, the file map, the workflow and the open todo.

Short version: Léo's camera rail (linear in scroll, rotation fixed) + Laurens's scroll-scrubbed climber (the tiger keeps its place on the right; its states are functions of scroll). Three floors — workshop, night bar, one big beige desktop computer — separated by section title papers and physical floor slabs; each project is a frameless cut-out object floating in the room (on floor 03: a preview on the computer's screen, page scroll slides the strip while the camera holds), words beside it on hover, a detail panel on click; each floor's value statement appears over the room, never paper on paper; the descent ends on a meadow.

- Preview: `python3 -m http.server 8000` in this folder → `preview.html` (`?snap=1` for screenshots)
- Build: `python3 build.py . dist` → `dist/index.html` (copy it to the repo root for GitHub Pages)
- Frames: `node tools/shot.js` (Playwright) · errors: `node tools/errcheck.js`
- Cut-outs: `python3 cutout.py photo.jpg slug --out ../assets/projects`
