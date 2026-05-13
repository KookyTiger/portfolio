export class HUD {
  constructor() {
    this.tokens = 0;
    this.multiplier = 1.0;
    this.tickTimer = 0;
  }

  addTokens(amount) {
    this.tokens += amount;
  }

  addMultiplier(amount) {
    this.multiplier += amount;
  }

  update(dt) {
    this.tickTimer += dt;
    if (this.tickTimer >= 1) {
      this.tokens += Math.floor(100 * this.multiplier);
      this.tickTimer = 0;
    }
  }

  render(ctx) {
    const formatted = this.tokens.toLocaleString();
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${formatted} tokens`, ctx.canvas.width - 20, 32);

    if (this.multiplier > 1) {
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(`×${this.multiplier.toFixed(1)}`, ctx.canvas.width - 20, 52);
    }
    ctx.restore();
  }
}
