// Frame renderer for merge/: POS="0:a,1.1:b,L-0.3:c" (screens; L = landing screen), WAIT ms, DIR=merge|dist, OUT prefix, HOVER=1
// Run from the repo root: node merge/tools/shot.js   (needs: npm i -D playwright && npx playwright install chromium)
const path = require('path'); const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const root = path.resolve(__dirname, '..');                                   // merge/
  const args = process.env.SWIFTSHADER ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
  const b = await chromium.launch({ args: ['--allow-file-access-from-files', ...args] });
  const p = await b.newPage({ viewport: { width: +(process.env.VW || 1440), height: +(process.env.VH || 900) } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  const file = (process.env.DIR || 'merge') === 'dist' ? path.join(root, 'dist', 'index.html') : path.join(root, 'preview.html');
  await p.goto('file://' + file + '?snap=1'); await p.waitForTimeout(3000); await p.evaluate(() => gsap.ticker.lagSmoothing(0));
  await p.mouse.move(1300, 60);
  const R = await p.evaluate(() => { const o = {}; document.querySelectorAll('section, footer').forEach(el => { if (!el.id) return; const r = el.getBoundingClientRect(); o[el.id] = [+((r.top + scrollY) / innerHeight).toFixed(2), +(r.height / innerHeight).toFixed(2)]; }); o.landS = window.__world.landS; return o; });
  console.log(JSON.stringify(R));
  fs.mkdirSync(path.join(root, 'shots'), { recursive: true });
  for (const [v, n] of (process.env.POS || '0:a').split(',').map(x => x.split(':'))) {
    const sv = v.startsWith('L') ? R.landS + parseFloat(v.slice(1) || '0') : parseFloat(v);
    await p.evaluate(v => { window.__lenis.scrollTo(v * innerHeight, { immediate: true, force: true }); window.scrollTo(0, v * innerHeight); }, sv);
    await p.waitForTimeout(+(process.env.WAIT || 1200));
    if (process.env.HOVER) { await p.mouse.move(300, 450); await p.waitForTimeout(800); }
    await p.screenshot({ path: path.join(root, 'shots', `${process.env.OUT || 'shot'}-${n}.png`) });
    console.log(n, sv.toFixed(3), await p.evaluate(() => JSON.stringify(window.__dbg)));
  }
  console.log(JSON.stringify(errs.slice(0, 10)));
  await b.close();
})();
