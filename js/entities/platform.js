export class Platform {
  constructor(x, y, w, h = 12) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  render(ctx) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.w, this.y);
    ctx.stroke();
  }
}
