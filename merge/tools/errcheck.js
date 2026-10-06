// Loads merge/preview.html (or dist with DIR=dist) headless and prints page errors + the debug state.
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch({ args: ['--allow-file-access-from-files', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
  const file = process.env.DIR === 'dist' ? path.join(root, 'dist', 'index.html') : path.join(root, 'preview.html');
  // BASE=http://localhost:8000/preview.html: the GLB tiger only loads over http
  await p.goto(process.env.BASE ? process.env.BASE + (process.env.BASE.includes('?') ? '&' : '?') + 'snap=1' : 'file://' + file + '?snap=1');
  if (process.env.BASE && !process.env.BASE.includes('rig')) await p.waitForFunction(() => window.__dbg && window.__dbg.glb, null, { timeout: 30000 }).catch(() => console.log('GLB tiger not ready'));
  await p.waitForTimeout(4000);
  console.log('world built:', await p.evaluate(() => !!window.__world), 'dbg:', await p.evaluate(() => JSON.stringify(window.__dbg)));
  await b.close();
})();
