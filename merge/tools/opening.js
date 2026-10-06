// The opening, frame by frame: OUT=op node merge/tools/opening.js  (BASE defaults to http://localhost:8000/preview.html; VW/VH)
// Loads the page with its opening (no ?snap), waits for the tiger, then sets the opening's phase/time and shoots each moment, and finally
// plays it in real time once (click → done), logging the phases it passed through and how long it took.
const path = require('path'), fs = require('fs'); const { chromium } = require('playwright');
(async () => {
  const root = path.resolve(__dirname, '..'), base = process.env.BASE || 'http://localhost:8000/preview.html', out = process.env.OUT || 'op';
  const b = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] }); const p = await b.newPage({ viewport: { width: +(process.env.VW || 1440), height: +(process.env.VH || 900) } });
  const errs = []; p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  fs.mkdirSync(path.join(root, 'shots'), { recursive: true });
  const shot = async (n) => p.screenshot({ path: path.join(root, 'shots', `${out}-${n}.png`) });
  const freeze = (ph, t) => p.evaluate(([ph, t]) => { const E = window.__entry; E.phase = ph; E.t = t; E.k = ph === 'card' || ph === 'cardOut' || ph === 'drop' ? 0 : 1; if (ph === 'rise') { E.lamp = 1; E.light = Math.min(1, t / 2.6); } if (ph === 'black') E.lamp = 0; }, [ph, t]);
  // 1) stepped: hold each moment for a few frames (the clock moves on by a frame or two before the shot)
  await p.goto(base);
  await p.waitForFunction(() => window.__dbg && window.__dbg.glb && window.__entry, null, { timeout: 30000 });
  await p.waitForTimeout(500); await shot('0card');
  const moments = (process.env.MOMENTS || 'drop:0.3,drop:0.5,drop:0.75,drop:1.0,drop:1.3,black:0.3,beam:0.15,beam:0.5,beam:1.3,rise:0.5,rise:1.3,rise:2.4').split(',');
  for (const m of moments) { const [ph, t] = m.split(':'); await freeze(ph, +t); await p.waitForTimeout(40); await shot(`${ph}-${t}`); console.log(m, await p.evaluate(() => JSON.stringify({ e: window.__entry.phase, t: +window.__entry.t.toFixed(2) }))); }
  // 2) real time from a fresh load: it plays itself; log the phases
  await p.goto(base); await p.waitForFunction(() => window.__entry, null, { timeout: 30000 });
  const t0 = Date.now(), seen = []; let clicked = false;
  while (Date.now() - t0 < 20000) { const ph = await p.evaluate(() => window.__entry.phase); if (seen[seen.length - 1]?.[0] !== ph) seen.push([ph, ((Date.now() - t0) / 1000).toFixed(2)]);
    if (ph === 'done') break; await p.waitForTimeout(50); }
  console.log('real time:', JSON.stringify(seen)); await p.waitForTimeout(1500); await shot('done');
  console.log(JSON.stringify(errs.slice(0, 10))); await b.close();
})();
