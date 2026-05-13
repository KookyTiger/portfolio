export class Camera {
  constructor(viewW, viewH) {
    this.x = 0;
    this.y = 0;
    this.viewW = viewW;
    this.viewH = viewH;
    this.lerp = 0.08;
  }

  follow(target) {
    const targetX = target.x - this.viewW / 2;
    const targetY = target.y - this.viewH / 2;
    this.x += (targetX - this.x) * this.lerp;
    this.y += (targetY - this.y) * this.lerp;
  }

  clamp(worldLeft, worldTop, worldRight, worldBottom) {
    this.x = Math.max(worldLeft, Math.min(worldRight - this.viewW, this.x));
    this.y = Math.max(worldTop, Math.min(worldBottom - this.viewH, this.y));
  }

  resize(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
  }

  apply(ctx) {
    ctx.translate(-this.x, -this.y);
  }
}
