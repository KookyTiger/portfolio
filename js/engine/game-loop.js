let lastTime = 0;
let paused = false;
let updateFn = null;
let renderFn = null;

export function startLoop(update, render) {
  updateFn = update;
  renderFn = render;
  lastTime = performance.now();
  requestAnimationFrame(tick);
}

function tick(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (!paused && updateFn && renderFn) {
    updateFn(dt);
    renderFn();
  }

  requestAnimationFrame(tick);
}

export function setPaused(v) { paused = v; }
export function isPaused() { return paused; }
