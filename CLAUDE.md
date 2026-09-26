# KookyTiger portfolio — notes for Claude Code

Owner: Zishu Kay Tu (KookyTiger), Northwestern MaDE + RTVF ’27. Live site: https://kookytiger.github.io/portfolio/ (GitHub Pages, branch `main`, root `index.html` = the bundle built from `merge/`).

Everything that matters lives in **`merge/`**. `stack/`, `lanterns/`, `descent/` are earlier prototypes (kept for reference); `v5.html`, `classic.html`, `js/`, `data/`, `script.js`, `style.css`, `server.js`, `admin.html` are the old game-as-portfolio site. Leave those alone unless Kay asks.

## Ground rules — Kay's non-negotiables (confirmed 2026-09-26). Do not change these without asking her first.

1. **Camera = Léo (leoparpeix.com).** Position is a *linear* function of page scroll (`camYAt(s) = -RATE * s`, `s = scroll / 100vh`), everywhere, even while paper covers the world. Rotation is fixed forever (`CAMERA.pitch`, no yaw, no mouse orbit). The header dollies down 2.0 and forward 4 over its 200vh. The only smoothing is Lenis (lerp .1). It clamps at the landing. One exception (Kay, 2026-09-26): in front of the computer on floor 03 the camera holds still for (projects − 1) screens while the previews slide, so `camYAt` is piecewise-linear with that one plateau (Léo's camera also holds under his long papers).
2. **Tiger = Laurens (laurens.art).** The tiger keeps one place on the right of the frame (hips glued to the camera: `hips.y = camera.y - LAY.glue`). Every locomotion state is *scrubbed by scroll* — `idle → turnToWall → overEdge → climbing (loop) → landing → turnAround → sit` in `app.js`, each a pure function of the scroll phase. Only idle bits (breathing, blink, ears, tail, the wave) run on time. It glances at each project as it arrives and looks back over its shoulder on hover/click. It climbs one ladder from the top platform to the meadow through every floor. Kay may replace the procedural rig with a skinned GLB later; keep the state names so `action.time` can map to the same phases.
3. **Paper / world alternation (Léo).** DOM paper blocks (hero, intro, section title papers, archives, footer) scroll 1:1 over the WebGL world; the world is visible only in the "windows". Never two white blocks in a row (Kay, 2026-09-26): the value statements are not paper — each is revealed char by char over the room at the end of its window (Léo's library statement), paper-coloured in dark rooms. hero→intro and archives→footer stay paper-on-paper, as on Léo's site. Statements reveal char by char; other text uses masked line reveals (SplitText) with the `reveal` ease `cubic-bezier(.4,0,0,1)`.
4. **Projects are frameless.** No card, no border, no background. Each project is its cut-out object floating in the room (`.card figure`), with a soft drop shadow; the words appear *beside* it on hover in plain ink (or paper on dark floors). Click/Enter opens the detail panel, which slides in from the left while the tiger stays visible on the right.
5. **Three floors.** `SECTIONS` in `content.js`: 01 ENGINEERING (workshop, light) → 02 DESIGN & INTERACTION (night bar, dark) → 03 ANALYTICS & STRATEGY (one big beige desktop computer, dark). Rhythm per section: title paper (140vh) → the room with its projects → the value statement over the room. On floor 03 the projects live on the computer's screen (`deck: true`): a horizontal strip of previews on a fixed DOM overlay (`#deck`) laid over the projected 3D glass every frame; page scroll slides it one preview per screen during the camera hold; ← → keys, horizontal trackpad and drag also move it; click opens the same detail panel. The desk stands on thin legs on the meadow so the landing stays open. A floor slab with a hatch for the ladder sits at each boundary; the camera passes through it while the title paper covers the screen, so the room change is physical and seamless. Nav and project text flip to paper colour inside dark rooms (Léo's rule).
6. **Ending.** Landing on the meadow, sky flips light, "THE OTHER SHORE", the tiger turns to face you and sits, then archives and footer.
7. **Copy is truthful.** `content.js` holds only facts Kay verified. Where a project has a `detail.todo`, that field lists what is still missing — never invent roles, numbers, tools or outcomes. The project count drives every "thirteen" in the copy (`{N}` templates).
8. **Scope discipline.** Change only what Kay asks for. Before a layout-level change, restate what will and will not change and get a yes.

## Where things live (`merge/`)

- `content.js` — the single source of content and tuning: `CATS`, `SIL` (placeholder SVG silhouettes), `PIECES` (13 projects; `img` = cut-out webp, `sil` = placeholder, `detail` = panel copy), `SECTIONS`, `VALUE_SCREENS`, `THEMES` (room skins: bg, fog, ink, wall texture, lights), `DECK` (the computer: screen z, NDC box per tier, entry/exit screens, bezel, colours), `COPY`, `ARCHIVE`, `RATE`, `CAMERA`, `TIGER` (glue, ledgeY, rung, step, scroll phases), `MOTION`, `SKY`, `LIGHT`.
- `app.js` — builds the DOM from content, the Léo text grammar, Lenis, the three.js world (pier + ladder, rooms with slabs and props per theme, ledges, meadow), the tiger rig (`Rig` class: hips → pitch → torso/head/tail + four two-bone IK legs) and its scroll-scrubbed states, the computer (`deckFrame()` → world rectangle of the glass, `PROPS.computer` → monitor/desk/keyboard/tower, the `#deck` overlay projection in `frame()`, its keys/wheel/drag handlers), the detail panel, layout tiers (`tune()`: phones shift the camera and glue the tiger lower), the frame loop.
- `style.css` — Léo's 12-column grid (20px gutter/gap), paper blocks, `.st` statements and `.st.title` section papers, `.card` (frameless object + hover text), `.panel`, dark-window overrides, phone layout.
- `index.html` — authored as a fragment (title/meta/links + body); `preview.html` is the same wrapped as a full document for local viewing. Regenerate preview.html from index.html when index.html changes.
- `build.py` — bundles vendor + content + app + css into `dist/index.html` (single file; relative `assets/projects/*` paths) and `dist/artifact.html` (images inlined as data URIs, for claude.ai artifacts).
- `cutout.py` — photo → transparent cut-out (`<slug>.webp`, 960px) + ink silhouette (`<slug>-sil.webp`) with rembg. `python3 merge/cutout.py photo.jpg slug --crop x0,y0,x1,y1 --out assets/projects`.
- `tools/shot.js` — Playwright frame renderer for checking motion (see Workflow). `tools/errcheck.js` — loads the page and reports runtime errors.
- `notes/` — the frame-by-frame study of leoparpeix.com and laurens.art (the spec the camera and tiger were built from) and contact sheets of this build.
- `assets/` → symlink to `../assets` so `preview.html` and `build.py` find `assets/projects/*.webp`.

Layout at 1440×900 (screens): header 0–2 · hero 2–3 · intro 3–3.8 · title0 3.8–5.2 · win0 5.2–9.2 (3 projects + value) · title1 9.2–10.6 · win1 10.6–17.6 (6 projects + value) · title2 17.6–19 · win2 19–27.3 (0.5 entry · hold 19.5–22.5 with the 4 previews · 1.5 exit · value · 2.3 shore screens; landing 25.8) · archives · footer. Each floating project is centred at its own screen inside its window; each preview is centred at its own screen of the hold.

## Workflow

- **Preview the source**: `cd merge && python3 -m http.server 8000` → http://localhost:8000/preview.html. `?snap=1` fixes the frame step (dt .2) for screenshots.
- **Build**: `cd merge && python3 build.py . dist`, then `cp dist/index.html ../index.html` (Pages serves the root). Commit both.
- **Check motion**: `npm i -D playwright && npx playwright install chromium` once, then `POS="0:h0,1.1:edge,4.3:climb,L:land,L0.7:sit" node merge/tools/shot.js` → `merge/shots/*.png` (`L` = the landing screen). `node merge/tools/errcheck.js` for console/page errors. Look at the frames — the tiger's limbs must move between neighbouring scroll positions; the camera must not turn.
- **Cut-outs**: `pip3 install rembg onnxruntime pillow scipy opencv-python`, drop photos in `assets/projects/`, run `cutout.py`, then set `img: 'assets/projects/<slug>.webp'` on the piece in `content.js`.
- **Deploy**: commit to `main` and `git push origin main`; Pages rebuilds in about a minute. Kay pushes herself (SSH key).
- Commit messages: end with a `Co-Authored-By: Claude …` line.

## Open todo (2026-09-26)

1. Photos still needed (see `assets/projects/README.md`): giftme, plu (People Like Us), onebirth, austin, alv, yello, amg. The No-Tip-Clip source is 315px — a bigger photo would be sharper. Placeholder SVG silhouettes show until then (they read as pale blobs in the dark rooms; fine for now).
2. Kay to review the copy for GiftMe, People Like Us, 隐藏的宝藏 (see their `detail.todo`), and Neighbors / Running (nothing verified beyond the one-liners).
3. Later: a rigged tiger (GLB) with clips named after the states; real photos for the panel; performance pass for low-end laptops (DPR cap, 1024 shadow map); OG image refresh (`og.png` at the root).
