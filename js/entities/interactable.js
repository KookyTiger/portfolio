export class Interactable {
  constructor(x, y, w, h, type, label) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type;
    this.label = label;
    this.nearPlayer = false;
  }

  checkProximity(tiger) {
    const cx = this.x + this.w / 2;
    const dist = Math.abs(tiger.x - cx);
    this.nearPlayer = dist < this.w / 2 + 40 &&
      tiger.y + tiger.pawOffset > this.y - 20 &&
      tiger.y - 60 < this.y + this.h;
    return this.nearPlayer;
  }

  render(ctx) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x, this.y, this.w, this.h);

    // Label
    ctx.fillStyle = '#000';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.label, this.x + this.w / 2, this.y - 8);

    // Interaction prompt
    if (this.nearPlayer) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('[E]', this.x + this.w / 2, this.y - 28);
    }
  }
}

export class Pipe {
  constructor(x, y, h) {
    this.x = x;
    this.y = y;
    this.h = h;
    this.w = 20;
    this.nearPlayer = false;
  }

  checkProximity(tiger) {
    const dist = Math.abs(tiger.x - (this.x + this.w / 2));
    this.nearPlayer = dist < 35 &&
      tiger.y > this.y - 20 &&
      tiger.y < this.y + this.h + 20;
    return this.nearPlayer;
  }

  isOnPipe(tiger) {
    const dist = Math.abs(tiger.x - (this.x + this.w / 2));
    return dist < 35 &&
      tiger.y >= this.y - 20 &&
      tiger.y <= this.y + this.h;
  }

  render(ctx) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;

    // Two vertical lines for pipe
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x, this.y + this.h);
    ctx.moveTo(this.x + this.w, this.y);
    ctx.lineTo(this.x + this.w, this.y + this.h);
    ctx.stroke();

    // Rungs
    const spacing = 40;
    ctx.lineWidth = 2;
    for (let ry = this.y + spacing; ry < this.y + this.h; ry += spacing) {
      ctx.beginPath();
      ctx.moveTo(this.x, ry);
      ctx.lineTo(this.x + this.w, ry);
      ctx.stroke();
    }

    // Prompt
    if (this.nearPlayer) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[W/S]', this.x + this.w / 2, this.y - 12);
    }
  }
}
