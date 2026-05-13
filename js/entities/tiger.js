import { drawTiger, drawBlink, tigerSize } from '../data/sprite-defs.js';

const WALK_SPEED = 260;
const JUMP_VEL = -480;
const FRAME_RATE = 8;

export class Tiger {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 'right';
    this.grounded = false;
    this.walking = false;
    this.carrying = null;

    this.frame = 0;
    this.frameTimer = 0;
    this.blinking = false;
    this.blinkTimer = 0;
    this.nextBlink = 2 + Math.random() * 3;
  }

  get width() { return tigerSize.w; }
  get height() { return tigerSize.h; }
  get pawOffset() { return tigerSize.pawOffset; }

  // AABB for collision: a box around the body (not ears/tail)
  get collider() {
    return {
      x: this.x - 20,
      y: this.y - 40,
      w: 40,
      h: this.pawOffset + 40,
    };
  }

  applyInput(inputLeft, inputRight, inputJump) {
    let moveX = 0;
    if (inputLeft)  moveX -= 1;
    if (inputRight) moveX += 1;

    this.walking = moveX !== 0;

    if (moveX !== 0) {
      this.facing = moveX > 0 ? 'right' : 'left';
      this.vx = moveX * WALK_SPEED;
    } else {
      this.vx *= 0.82;
      if (Math.abs(this.vx) < 5) this.vx = 0;
    }

    if (inputJump && this.grounded) {
      this.vy = JUMP_VEL;
      this.grounded = false;
    }
  }

  update(dt) {
    // Walk animation
    if (this.walking && this.grounded) {
      this.frameTimer += dt;
      if (this.frameTimer >= 1 / FRAME_RATE) {
        this.frameTimer = 0;
        this.frame = (this.frame + 1) % 3;
      }
    } else if (!this.grounded) {
      this.frame = 1;
    } else {
      this.frame = 0;
      this.frameTimer = 0;
    }

    // Blink
    this.blinkTimer += dt;
    if (this.blinking) {
      if (this.blinkTimer >= 0.15) {
        this.blinking = false;
        this.blinkTimer = 0;
        this.nextBlink = 2 + Math.random() * 4;
      }
    } else if (this.blinkTimer >= this.nextBlink) {
      this.blinking = true;
      this.blinkTimer = 0;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    drawTiger(ctx, this.frame, this.facing);
    if (this.blinking) drawBlink(ctx);

    ctx.restore();

    if (this.carrying && this.carrying.renderCarried) {
      this.carrying.renderCarried(ctx, this.x, this.y);
    }
  }
}
