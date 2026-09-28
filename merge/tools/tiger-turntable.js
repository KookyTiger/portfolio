// Renders a sheet of views of a tiger GLB (the standing idle all around + the climb from behind, as the site shows it) with tiger-view.html.
//   node merge/tools/tiger-turntable.js assets/tiger/tiger.glb merge/shots/tiger-views.png [VIEWS=all|back|climb] [CELL=360]
// Needs the preview server (cd merge && python3 -m http.server 8000); BASE overrides the page URL. The GLB is read from disk and handed
// to the page, so any file works (no need to serve it).
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const PRESETS = {
  all: [0, 45, 90, 135, 180, 225, 270, 315].map((yaw) => ({ yaw, pitch: 8, label: `idle ${yaw}°` }))
    .concat([{ yaw: 180, pitch: 40, label: 'back from above' }, { yaw: 180, pitch: -20, label: 'back from below' },
      { clip: 'climb', t: 0.1, yaw: -10, pitch: 18, label: 'climb 0.1 (as on the site)' }, { clip: 'climb', t: 0.6, yaw: 10, pitch: 18, label: 'climb 0.6' }]),
  back: [135, 160, 180, 200, 225].map((yaw) => ({ yaw, pitch: 10, zoom: 1.3, label: `back ${yaw}°` })).concat([{ yaw: 180, pitch: 45, zoom: 1.3, label: 'top' }]),
  climb: [0.05, 0.3, 0.55, 0.8].map((t, i) => ({ clip: 'climb', t, yaw: -15 + i * 10, pitch: 16, zoom: 1.2, label: `climb ${t}` })),
  close: [{ yaw: 180, pitch: 8, zoom: 2.0, dy: 0.05, label: 'back, close' }, { yaw: 180, pitch: 15, zoom: 3.2, dy: 0.42, label: 'back of the head' },
    { yaw: 120, pitch: 5, zoom: 2.4, dy: 0.0, label: 'side seam (left)' }, { yaw: 240, pitch: 5, zoom: 2.4, dy: 0.0, label: 'side seam (right)' },
    { yaw: 160, pitch: 5, zoom: 3.4, dy: 0.02, label: 'tail' }, { yaw: 180, pitch: 60, zoom: 2.6, dy: 0.45, label: 'crown from above' },
    { yaw: 150, pitch: 10, zoom: 3.0, dy: 0.1, label: 'arm, back' }, { yaw: 190, pitch: 5, zoom: 2.8, dy: -0.12, label: 'legs, back' }],
};
(async () => {
  const [glb, out] = process.argv.slice(2); if (!glb || !out) { console.log('usage: tiger-turntable.js <glb> <out.png>'); process.exit(1); }
  // VIEWS_JSON='[{"yaw":250,"pitch":0,"zoom":3,"dy":-0.05,"label":"right hip"}]' for views of your own
  const views = process.env.VIEWS_JSON ? JSON.parse(process.env.VIEWS_JSON) : PRESETS[process.env.VIEWS || 'all'], cell = +(process.env.CELL || 360), cols = +(process.env.COLS || 4);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: cols * cell, height: Math.ceil(views.length / cols) * cell } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto((process.env.BASE || 'http://localhost:8000/tools/tiger-view.html') + `?cell=${cell}&cols=${cols}`);
  await p.waitForFunction(() => window.__load, null, { timeout: 20000 });
  const info = await p.evaluate((b64) => window.__load(b64), fs.readFileSync(glb).toString('base64'));
  const size = await p.evaluate((v) => window.__views(v), views); await p.waitForTimeout(200);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: size.w, height: size.h } });
  console.log('views', views.length, '→', out, 'clips', info.clips.length, errs.length ? 'ERRORS ' + JSON.stringify(errs) : '');
  await b.close();
})();
