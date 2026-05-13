// Cubist ink-line tiger sprite — kookytiger character

const SCALE = 2.5;
const TIGER_W = 50 * SCALE;
const TIGER_H = 80 * SCALE;
const PAW_OFFSET = 36 * SCALE;

// Tiger faces right by default; flip with ctx.scale(-1, 1) for left
// Coords (pre-scale): origin (0,0) at hip-line center
// Head: y in [-44, -14], Body: y in [-14, 16], Legs: y in [16, 32]

function drawHead(ctx) {
  // Cubist head — boxy with faceted edges, slightly tilted forward
  ctx.beginPath();
  ctx.moveTo(-12, -42);   // top-back
  ctx.lineTo(-2, -44);    // crown
  ctx.lineTo(10, -40);    // top-front
  ctx.lineTo(16, -32);    // brow-front
  ctx.lineTo(17, -22);    // cheek
  ctx.lineTo(13, -14);    // jaw-front
  ctx.lineTo(2, -12);     // chin-front
  ctx.lineTo(-8, -14);    // chin-back
  ctx.lineTo(-14, -22);   // jaw-back
  ctx.lineTo(-15, -34);   // mid-back
  ctx.closePath();
  ctx.stroke();

  // Triangular ear (pokes up from top-back)
  ctx.beginPath();
  ctx.moveTo(-12, -42);
  ctx.lineTo(-7, -52);
  ctx.lineTo(-1, -44);
  ctx.stroke();

  // Inner ear notch
  ctx.beginPath();
  ctx.moveTo(-7, -52);
  ctx.lineTo(-5, -46);
  ctx.stroke();

  // Cubist facet — vertical line through face
  ctx.beginPath();
  ctx.moveTo(8, -41);
  ctx.lineTo(3, -12);
  ctx.stroke();

  // Brow facet line
  ctx.beginPath();
  ctx.moveTo(-14, -30);
  ctx.lineTo(16, -28);
  ctx.stroke();

  // Two round eyes (cubist 3/4 view — both visible)
  ctx.beginPath();
  ctx.arc(-2, -22, 2.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(9, -23, 2.5, 0, Math.PI * 2);
  ctx.stroke();

  // Eye pupils (filled)
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-2, -22, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(9, -23, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Heart-shaped nose/mouth — two arc lobes + bottom point
  ctx.fillStyle = '#000';
  const cx = 3, cy = -17;
  ctx.beginPath();
  ctx.arc(cx - 2.5, cy - 1, 2.5, 0, Math.PI, true);
  ctx.arc(cx + 2.5, cy - 1, 2.5, 0, Math.PI, true);
  ctx.lineTo(cx, cy + 4);
  ctx.closePath();
  ctx.fill();

  // Whiskers — short angular lines off cheek
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(15, -20); ctx.lineTo(22, -19);
  ctx.moveTo(15, -17); ctx.lineTo(22, -15);
  ctx.stroke();

  // Head stripes — short curves
  ctx.beginPath();
  ctx.moveTo(-9, -39); ctx.lineTo(-5, -37);
  ctx.moveTo(-1, -41); ctx.lineTo(3, -39);
  ctx.moveTo(11, -34); ctx.lineTo(14, -30);
  ctx.moveTo(-13, -26); ctx.lineTo(-10, -22);
  ctx.stroke();
}

function drawBody(ctx) {
  // Blocky body — compact rectangle slightly tapered
  ctx.beginPath();
  ctx.moveTo(-12, -14);   // top-back shoulder
  ctx.lineTo(10, -14);    // top-front shoulder
  ctx.lineTo(13, 16);     // bottom-front hip
  ctx.lineTo(-14, 14);    // bottom-back hip
  ctx.closePath();
  ctx.stroke();

  // Body stripes — diagonal short lines
  ctx.beginPath();
  ctx.moveTo(-10, -8); ctx.lineTo(-4, -6);
  ctx.moveTo(-8, 0);   ctx.lineTo(-2, 2);
  ctx.moveTo(-10, 8);  ctx.lineTo(-4, 10);
  ctx.moveTo(4, -10);  ctx.lineTo(10, -8);
  ctx.moveTo(4, 0);    ctx.lineTo(11, 2);
  ctx.moveTo(4, 10);   ctx.lineTo(10, 12);
  ctx.stroke();
}

function drawTail(ctx) {
  // Tail emerges from upper-back of body, curves UP and slightly forward
  ctx.beginPath();
  ctx.moveTo(-11, -10);
  ctx.bezierCurveTo(-22, -18, -22, -34, -12, -38);
  ctx.stroke();

  // Tail stripe tick marks (perpendicular to tail curve)
  ctx.beginPath();
  ctx.moveTo(-17, -16); ctx.lineTo(-20, -14);
  ctx.moveTo(-21, -24); ctx.lineTo(-24, -23);
  ctx.moveTo(-19, -34); ctx.lineTo(-18, -37);
  ctx.stroke();

  // Tail tip — small filled blob
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-12, -38, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoot(ctx, x, y, flat = false) {
  // Chunky filled-black boot
  ctx.fillStyle = '#000';
  ctx.beginPath();
  if (flat) {
    // Heel-down — longer ellipse with toe raised
    ctx.ellipse(x - 1, y, 7, 3.5, -0.15, 0, Math.PI * 2);
  } else {
    // Planted — chunky rounded shape
    ctx.ellipse(x, y, 5.5, 4, 0, 0, Math.PI * 2);
  }
  ctx.fill();
}

// 3-frame walk cycle: contact → passing → contact (mirror)
const legFrames = [
  // Frame 0: CONTACT — back foot heel-down, front foot planted
  (ctx) => {
    // Back leg (behind, angled back)
    ctx.beginPath();
    ctx.moveTo(-8, 12);
    ctx.lineTo(-13, 30);
    ctx.stroke();
    drawBoot(ctx, -14, 32, true);

    // Front leg (leading)
    ctx.beginPath();
    ctx.moveTo(6, 14);
    ctx.lineTo(9, 30);
    ctx.stroke();
    drawBoot(ctx, 9, 32, false);
  },

  // Frame 1: PASSING — back leg lifted (knee bent), front leg planted under body
  (ctx) => {
    // Back leg lifted, knee bent
    ctx.beginPath();
    ctx.moveTo(-8, 12);
    ctx.lineTo(-4, 22);
    ctx.lineTo(-9, 25);
    ctx.stroke();
    drawBoot(ctx, -9, 25, false);

    // Front leg planted vertical
    ctx.beginPath();
    ctx.moveTo(6, 14);
    ctx.lineTo(4, 31);
    ctx.stroke();
    drawBoot(ctx, 4, 33, false);
  },

  // Frame 2: CONTACT (mirror) — back foot under, front foot heel-forward
  (ctx) => {
    // Back leg planted under body
    ctx.beginPath();
    ctx.moveTo(-8, 12);
    ctx.lineTo(-3, 30);
    ctx.stroke();
    drawBoot(ctx, -3, 32, false);

    // Front leg stepping forward, heel-down
    ctx.beginPath();
    ctx.moveTo(6, 14);
    ctx.lineTo(13, 30);
    ctx.stroke();
    drawBoot(ctx, 15, 32, true);
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

  drawTail(ctx);
  drawBody(ctx);
  drawHead(ctx);
  legFrames[frameIndex](ctx);

  ctx.restore();
}

export const tigerSize = { w: TIGER_W, h: TIGER_H, pawOffset: PAW_OFFSET };

// Blink overlay — squash eyes to lines
export function drawBlink(ctx) {
  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#f5f0eb';
  ctx.fillRect(-5, -26, 18, 6);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -22); ctx.lineTo(0, -22);
  ctx.moveTo(7, -23);  ctx.lineTo(11, -23);
  ctx.stroke();
  ctx.restore();
}
