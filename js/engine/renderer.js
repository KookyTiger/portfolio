let canvas, ctx;
let width = 1280;
let height = 720;

export function initRenderer() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  const w = window.innerWidth || canvas.clientWidth || 1280;
  const h = window.innerHeight || canvas.clientHeight || 720;
  if (w > 0 && h > 0) {
    width = w;
    height = h;
  }
  canvas.width = width;
  canvas.height = height;
}

export function clear(color = '#f5f0eb') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

export function getCtx() { return ctx; }
export function getWidth() { return width; }
export function getHeight() { return height; }
