const STAGES = ['seed', 'sprout', 'leafing', 'flowering', 'bloomed'];

export class Plant {
  constructor(x, y, skillKey, label) {
    this.x = x;
    this.y = y;
    this.skillKey = skillKey;
    this.label = label;
    this.stage = 0;
    this.fedCount = 0;
    this.nearPlayer = false;
    this.bloomed = false;
    this.bloomAnim = 0;
  }

  get stageName() { return STAGES[this.stage]; }
  get isFullyGrown() { return this.stage >= STAGES.length - 1; }

  feed() {
    if (this.isFullyGrown) return false;
    this.fedCount++;
    this.stage = Math.min(this.stage + 1, STAGES.length - 1);
    if (this.isFullyGrown) {
      this.bloomed = true;
      this.bloomAnim = 1;
    }
    return true;
  }

  checkProximity(tiger) {
    const dist = Math.abs(tiger.x - this.x);
    const vertDist = Math.abs((tiger.y + 40) - this.y);
    this.nearPlayer = dist < 50 && vertDist < 80;
    return this.nearPlayer;
  }

  update(dt) {
    if (this.bloomAnim > 0) {
      this.bloomAnim -= dt * 0.5;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const h = 20 + this.stage * 25;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Stem
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -h);
    ctx.stroke();

    // Growth details per stage
    if (this.stage >= 1) {
      // Sprout — two small leaves
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.quadraticCurveTo(-15, -25, -8, -30);
      ctx.moveTo(0, -15);
      ctx.quadraticCurveTo(15, -25, 8, -30);
      ctx.stroke();
    }

    if (this.stage >= 2) {
      // Leafing — bigger leaves
      ctx.beginPath();
      ctx.moveTo(0, -40);
      ctx.quadraticCurveTo(-25, -55, -12, -60);
      ctx.moveTo(0, -40);
      ctx.quadraticCurveTo(25, -55, 12, -60);
      ctx.stroke();
    }

    if (this.stage >= 3) {
      // Flowering — bud at top
      ctx.beginPath();
      ctx.arc(0, -h, 8, 0, Math.PI * 2);
      ctx.stroke();
      // Petals hint
      for (let a = 0; a < 5; a++) {
        const angle = (a / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 8, -h + Math.sin(angle) * 8);
        ctx.lineTo(Math.cos(angle) * 16, -h + Math.sin(angle) * 16);
        ctx.stroke();
      }
    }

    if (this.stage >= 4) {
      // Bloomed — full flower with filled center
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(0, -h, 5, 0, Math.PI * 2);
      ctx.fill();

      // Bloom glow
      if (this.bloomAnim > 0) {
        ctx.strokeStyle = `rgba(0,0,0,${this.bloomAnim * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, -h, 20 + (1 - this.bloomAnim) * 20, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Label
    ctx.fillStyle = '#000';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.label, 0, 16);
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(this.stageName, 0, 28);

    // Interaction prompt
    if (this.nearPlayer) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('[E]', 0, -h - 20);
    }

    ctx.restore();
  }
}
