export class Nutrient {
  constructor(x, y, projectSlug, projectTitle, plantSkill, nutrientType) {
    this.x = x;
    this.y = y;
    this.projectSlug = projectSlug;
    this.projectTitle = projectTitle;
    this.plantSkill = plantSkill;
    this.nutrientType = nutrientType || 'fertilizer';
    this.collected = false;
    this.nearPlayer = false;
    this.bobTimer = Math.random() * Math.PI * 2;
  }

  checkProximity(tiger) {
    if (this.collected) return false;
    const dist = Math.abs(tiger.x - this.x);
    const vertDist = Math.abs((tiger.y + 40) - this.y);
    this.nearPlayer = dist < 45 && vertDist < 70;
    return this.nearPlayer;
  }

  update(dt) {
    this.bobTimer += dt * 2;
  }

  render(ctx) {
    if (this.collected) return;

    ctx.save();
    const bobY = Math.sin(this.bobTimer) * 3;
    ctx.translate(this.x, this.y + bobY);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Draw based on nutrient type
    switch (this.nutrientType) {
      case 'fertilizer':
        // Small bag shape
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-12, -20);
        ctx.lineTo(12, -20);
        ctx.lineTo(10, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NPK', 0, -8);
        break;

      case 'water':
        // Watering can shape
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-10, -15);
        ctx.lineTo(10, -15);
        ctx.lineTo(8, 0);
        ctx.closePath();
        ctx.stroke();
        // Spout
        ctx.beginPath();
        ctx.moveTo(10, -15);
        ctx.lineTo(18, -22);
        ctx.stroke();
        break;

      case 'sunbeam':
        // Sun drop
        ctx.beginPath();
        ctx.arc(0, -10, 8, 0, Math.PI * 2);
        ctx.stroke();
        // Rays
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 10, -10 + Math.sin(a) * 10);
          ctx.lineTo(Math.cos(a) * 15, -10 + Math.sin(a) * 15);
          ctx.stroke();
        }
        break;
    }

    // Project title label
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.projectTitle, 0, 14);

    // Interaction prompt
    if (this.nearPlayer) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('[E]', 0, -30);
    }

    ctx.restore();
  }

  renderCarried(ctx, tigerX, tigerY) {
    ctx.save();
    ctx.translate(tigerX, tigerY - 120);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-10, -15);
    ctx.lineTo(10, -15);
    ctx.lineTo(8, 0);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#000';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.projectTitle.substring(0, 8), 0, -4);

    ctx.restore();
  }
}
