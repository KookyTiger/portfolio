# Léo × Laurens — frame-by-frame study → merge v2 motion spec (2026-09-25)

Captured live: leoparpeix.com in Chrome at 1470×801 (scroll set by `window.scrollTo`, Lenis settles), laurens.art in the desktop-app browser pane at 1024×768 (scroll scrubbed through `document.scrollingElement.scrollTop`, the climber's clips read back from `app._tiles`: `_climbingAction.time`, `_turnToWallAction`, `_standingAction`, `_turnAroundAction`, `_putDownAction`, the group's position/rotation/scale, and the three.js camera).

## 1. Léo — what the camera does over time

Page @801vh: header 0–1602 (200vh, world visible) · hero paper 1602–2403 · intro 2403–3148 · project sliders 3148–5843 (paper) · webglSection 5843–7445 (200vh, world visible) · sliders 7445–10044 · archives · footer.

| scroll | header progress | frame |
|---|---|---|
| 0 | 0 | eye-level wide shot of the atelier, flower centred in the middle window, camera level, no pitch |
| 400 | .25 | camera lower and closer: flower head rises toward the top of the frame, pedestals grow, statement at left-middle |
| 800 | .5 | flower head cut by the top edge, window sills above centre — lower and closer again; statement faded (fade .2→.45) |
| 1200 | .75 | hero paper slides up from the bottom and covers the lower half; the world behind it is still moving |
| 1602 | 1 | paper only |
| 5443 | section .17 | the paper's bottom edge reveals a different room (library wall + ladder), camera level, looking straight at the shelves |
| 5843 | .33 | library fills the frame; white statement reveals char by char; nav ink flips to white |
| 6244 | .5 | shelves have moved UP in frame (straight vertical descent); statement scrolls with the DOM |
| 6644 | .67 | the floor appears at the bottom |
| 7045 | .83 | floor + lower shelves; the next paper rises from the bottom |
| 7445 | 1 | paper only |

Rules confirmed: camera rotation never changes. Position is a linear map of scroll (`−clamp(scroll/height × rangePos)`; header rangePos (0, 2.4, 4) = down 2.4 / forward 4 over 200vh; section (0, 2.75, 0) over [top − vh, top + h]). The world moves roughly a quarter to a third of the frame per 100vh. The world is only visible through two DOM windows; paper is ordinary DOM scrolling 1:1; the camera keeps moving while paper covers it, so the next window opens on a world that has already moved.

## 2. Laurens — what the character does over time (p = page progress, 4.2 pages)

Camera: rotation fixed (−.16, .04, 0). Only y moves: −1930 → −172 over p 0→.70 (≈ one character height per screen), then a reframe down by 230 at .70–.80 and it stops. The Spline world (rock, water) is matched to it.

| p | state | clip time | group | frame |
|---|---|---|---|---|
| 0 | idle (time-driven) | idle loops | rotY 0, scale 19.6, y −2520 | facing you, standing at the rock base, lower right (ndc .78, −.16) |
| .03 | turnToWall (scrubbed) | .18 / 3.37 | rotY −.14, y −2447 | starts turning |
| .06 | turnToWall | .71 | rotY −1.59, scale 18.8 | side-on |
| .075 | turnToWall | .98 | rotY −2.44 | backpack visible, back turning to you |
| .09 | turnToWall | 1.24 | rotY −3.02, scale 18.2 | back to you, looking up the wall |
| .11 | climbing (scrubbed) | .07 / 4.2 | rotY −3.14, scale 18, y −2304 | first reach; group rises at .78× the camera so she drifts down to ndc −.33 |
| .15 → .70 | climbing | .35 → 4.16 (≈ 6.95 s per unit p, one pass of the 4.2 s clip over 2.5 screens) | x 93→−41, z −1460→−1681 | limbs alternate; she moves from lower-right (.76, −.33) to centre-right (.45, −.25) and gets ~15% smaller; the rock scrolls down past her |
| .42 | — | — | — | sky tints; the statement is gone |
| .60 / .70 / .80 | — | — | — | project titles appear one by one at the left ("PLAYFUL TETRIS…", "TENDOR THE APP…", "EVERYTHING OFF THE MAIN ROUTE") |
| .80 | standing (crossfade .36 s, then scrubbed) | .13 / 4.03 | camera −403 (reframed) | hands on the summit |
| .86 → .90 | standing | 2.34 → 3.81 | y −1331 → −1287 | mantles onto the top |
| .90 | — | — | — | sunrise: sky flips to white (800 ms); nav ink black; "OPEN FOR WORK / THAT YOU CAN HOLD" |
| .93 → .96 | turnAround (scrubbed) | .68 → 1.52 / 3.37 | rotY −3.14 → 0, scale 18 → 19.8, y → −844 | turns to face you, rises to ndc (.5, .14) |
| .985 → 1 | putDown (time-driven) | 2.0 → 4.7 / 5.67 | rotY 0, scale 20 | takes the backpack off and sets it on the rock, then idles |

Rules confirmed: every locomotion clip is paused and scrubbed (`action.time = f(scroll)`); root motion is stripped so she keeps one place on the right while the world moves; the compositional drift is slow and deliberate; only idle and putDown run on time; the head glance layer (68°, 28°, .15 / .4 / .35 s) sits on top.

## 3. Why merge v1 failed

The tiger had no scroll-driven action at all (breathing, looks, one wave), so scrolling produced no motion; the "lift" camera had easing, a mouse orbit and a pitch change, and the world moved 7 units per screen — none of which is in Léo. There was no header dolly.

## 4. merge v2 — the spec now implemented (`merge/app.js`, `merge/content.js`)

Camera (Léo, literally): `position = (0, −RATE·s, 5.2 + 4·(1 − clamp(s/2)))` with `s = scroll/100vh`, `RATE = 1.0` (down 2.0 / forward 4 over the 200vh header, then straight down), `rotation = (−.12, 0, 0)` forever, no mouse orbit. Linear everywhere, paper included; clamps at the landing `s_L = bottom of the last window − 1.5 screens`. The world moves about a third of the frame per 100vh.

Tiger (Laurens, as a procedural rig with the same clip grammar): the hips are glued to the camera while climbing (`hips.y = camera.y − 1.08` → ndc ≈ (.63, −.33)); the ladder rises past it. States by `s`: idle [0, .3) → turnToWall [.3, .7) (180° in place, four little steps) → overEdge [.7, 1.3) (backs to the platform edge, hind feet find the top rungs, hands hold the platform then take the rungs above the edge) → climbing [1.3, s_L) → landing [s_L, s_L + .35) (feet reach the grass, hands let go, down onto all fours) → turnAround [+.35, +.75) → sit (time-driven, like putDown) with a wave every 6–11 s. Climb cycle time `c = (H0 − hips.y) / 0.6`: two rungs per cycle, rungs 0.3 apart, feet on alternate rungs, hands on the rungs above; a planted paw rides up with the ladder at exactly the world rate, a swing drops it two rungs with a lift. Head: looks down the ladder; glances at each card as it arrives (68°/28°, .15 / .4 / .35 s); hover → looks back over its shoulder; blink, ear flicks, tail sway (faster with scroll speed), breathing run on time. Every state is a function of the scroll phase, so a skinned GLB with clips named idle / turnToWall / overEdge / climbing / landing / turnAround / sit can replace the rig by mapping `action.time` to the same phases.

Layout (unchanged): header 200vh · hero · intro · window B (cards 1–4) · statement I · window C (5–8) · statement II · window D (9–11 + shore 2.3 screens) · archives · footer. Cards are 7 columns wide now so the ladder has air.

## 5. Frames rendered for this build (1440×900, Playwright, `?snap=1`)

sheet-header: s = 0 … 1.4 (idle → turn → over the edge → paper covers). sheet-cycle: one climb cycle, s = 4.0 … 4.6 in 9 steps (crop). sheet-land: s_L − .4 … s_L + 1.3 (landing → turn → sit → archives paper). sheet-sweep: every screen from 0 to 20.
