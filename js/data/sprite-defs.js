// Placeholder tiger sprites — geometric shapes
// Will be replaced with real SVG path data later

const SCALE = 2.5;
const TIGER_W = 40 * SCALE;
const TIGER_H = 80 * SCALE;
const PAW_OFFSET = 38 * SCALE;

// Each frame is a function that draws onto ctx at (0, 0) centered
// Tiger faces right by default; flip with ctx.scale(-1, 1) for left

function drawBody(ctx) {
  // Head (circle)
  ctx.beginPath();
  ctx.arc(0, -20, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Ears
  ctx.beginPath();
  ctx.moveTo(-8, -30);
  ctx.lineTo(-13, -42);
  ctx.lineTo(-3, -33);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, -30);
  ctx.lineTo(13, -42);
  ctx.lineTo(3, -33);
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-5, -22, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(5, -22, 2, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.beginPath();
  ctx.moveTo(-2, -17);
  ctx.lineTo(0, -15);
  ctx.lineTo(2, -17);
  ctx.stroke();

  // Body (oval)
  ctx.beginPath();
  ctx.ellipse(0, 4, 14, 20, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Stripes
  ctx.beginPath();
  ctx.moveTo(-12, -2); ctx.lineTo(-6, 0);
  ctx.moveTo(-11, 8); ctx.lineTo(-5, 10);
  ctx.moveTo(12, -2); ctx.lineTo(6, 0);
  ctx.moveTo(11, 8); ctx.lineTo(5, 10);
  ctx.stroke();

  // Tail
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.quadraticCurveTo(30, -10, 26, -28);
  ctx.stroke();
}

// Walk frames — only legs differ
const legFrames = [
  // Frame 0: neutral stand
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-6, 22); ctx.lineTo(-8, 36);
    ctx.moveTo(6, 22);  ctx.lineTo(8, 36);
    ctx.stroke();
    // Paws
    ctx.beginPath();
    ctx.ellipse(-8, 38, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(8, 38, 5, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
  // Frame 1: front-left forward, back-right forward
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-6, 22); ctx.lineTo(-14, 34);
    ctx.moveTo(6, 22);  ctx.lineTo(14, 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-14, 36, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(14, 36, 5, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
  // Frame 2: legs together (passing)
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-4, 22); ctx.lineTo(-4, 36);
    ctx.moveTo(4, 22);  ctx.lineTo(4, 36);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-4, 38, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(4, 38, 5, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
  // Frame 3: front-right forward, back-left forward
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-6, 22); ctx.lineTo(2, 34);
    ctx.moveTo(6, 22);  ctx.lineTo(-2, 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(2, 36, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(-2, 36, 5, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
];

export function drawTiger(ctx, frameIndex, facing) {
  ctx.save();
  if (facing === 'left') ctx.scale(-1, 1);
  ctx.scale(SCALE, SCALE);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  drawBody(ctx);
  legFrames[frameIndex](ctx);

  ctx.restore();
}

export const tigerSize = { w: TIGER_W, h: TIGER_H, pawOffset: PAW_OFFSET };

// Blink overlay — squash eyes to lines
export function drawBlink(ctx) {
  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#f5f0eb';
  ctx.fillRect(-8, -25, 16, 8);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, -22); ctx.lineTo(-3, -22);
  ctx.moveTo(3, -22);  ctx.lineTo(7, -22);
  ctx.stroke();
  ctx.restore();
}
