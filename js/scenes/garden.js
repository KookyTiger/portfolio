import { Platform } from '../entities/platform.js';
import { Pipe } from '../entities/interactable.js';
import { Plant } from '../entities/plant.js';
import { Nutrient } from '../entities/nutrient.js';

const W = 1400;
const H = 1600;
const GROUND_Y = H - 40;

export class GardenScene {
  constructor() {
    this.worldW = W;
    this.worldH = H;

    this.platforms = [
      new Platform(0, GROUND_Y, W),

      // Lower tier — nutrients scattered here
      new Platform(100, GROUND_Y - 160, 300),
      new Platform(600, GROUND_Y - 200, 280),
      new Platform(1000, GROUND_Y - 160, 300),

      // Mid tier — plants live here
      new Platform(250, GROUND_Y - 380, 260),
      new Platform(700, GROUND_Y - 420, 300),
      new Platform(1050, GROUND_Y - 380, 250),

      // Upper tier
      new Platform(80, GROUND_Y - 580, 280),
      new Platform(500, GROUND_Y - 620, 260),
      new Platform(900, GROUND_Y - 580, 300),

      // Top tier
      new Platform(300, GROUND_Y - 800, 300),
      new Platform(750, GROUND_Y - 840, 280),

      // Exit ledge
      new Platform(550, 80, 300),
    ];

    this.pipe = new Pipe(680, 80, 400);

    this.spawnX = W / 2;
    this.spawnY = 120;

    this.plants = [];
    this.nutrients = [];
    this.dataLoaded = false;

    this.loadData();
  }

  async loadData() {
    try {
      const [projects, skills] = await Promise.all([
        fetch('/data/projects.json').then(r => r.json()),
        fetch('/data/skills.json').then(r => r.json()),
      ]);

      // Create plants from skills — one per skill, placed on mid/upper platforms
      const plantPositions = [
        { px: 380, py: GROUND_Y - 380 },
        { px: 850, py: GROUND_Y - 420 },
        { px: 220, py: GROUND_Y - 580 },
        { px: 630, py: GROUND_Y - 620 },
      ];

      const skillKeys = Object.keys(skills);
      skillKeys.forEach((key, i) => {
        const pos = plantPositions[i % plantPositions.length];
        this.plants.push(new Plant(pos.px, pos.py, key, skills[key].label));
      });

      // Create nutrients from projects — scattered on lower/ground platforms
      const nutrientPositions = [
        { px: 200, py: GROUND_Y },
        { px: 450, py: GROUND_Y },
        { px: 750, py: GROUND_Y - 160 },
        { px: 1100, py: GROUND_Y - 160 },
        { px: 350, py: GROUND_Y - 160 },
        { px: 900, py: GROUND_Y - 200 },
        { px: 650, py: GROUND_Y },
        { px: 1200, py: GROUND_Y },
        { px: 150, py: GROUND_Y - 380 },
        { px: 500, py: GROUND_Y - 380 },
        { px: 1000, py: GROUND_Y },
      ];

      const nutrientTypes = ['fertilizer', 'water', 'sunbeam'];
      const visibleProjects = projects.filter(p => !p.isHidden);

      visibleProjects.forEach((proj, i) => {
        const pos = nutrientPositions[i % nutrientPositions.length];
        const primarySkill = proj.skills[0] || 'coding';
        const type = nutrientTypes[i % nutrientTypes.length];
        this.nutrients.push(new Nutrient(
          pos.px, pos.py,
          proj.slug, proj.title, primarySkill, type
        ));
      });

      this.dataLoaded = true;
    } catch (e) {
      console.warn('Failed to load garden data:', e);
    }
  }

  enter(tiger) {
    if (tiger) {
      tiger.x = this.spawnX;
      tiger.y = this.spawnY;
      tiger.vx = 0;
      tiger.vy = 0;
      tiger.grounded = false;
    }
  }

  exit() {}

  handleInteract(tiger) {
    if (tiger.carrying) {
      for (const plant of this.plants) {
        if (plant.checkProximity(tiger) && !plant.isFullyGrown) {
          if (tiger.carrying.plantSkill === plant.skillKey) {
            plant.feed();
            const nutrientId = tiger.carrying.projectSlug;
            tiger.carrying = null;
            return { action: 'fed', plant, nutrientId };
          } else {
            return { action: 'wrong-plant' };
          }
        }
      }
      tiger.carrying.collected = false;
      tiger.carrying.x = tiger.x;
      tiger.carrying.y = tiger.y + tiger.pawOffset;
      tiger.carrying = null;
      return { action: 'dropped' };
    }

    for (const nut of this.nutrients) {
      if (nut.checkProximity(tiger) && !nut.collected) {
        nut.collected = true;
        tiger.carrying = nut;
        return { action: 'pickup' };
      }
    }

    return null;
  }

  restoreState(plantStages, fedNutrients) {
    if (!this.dataLoaded) return;
    if (plantStages) {
      for (const plant of this.plants) {
        if (plantStages[plant.skillKey] !== undefined) {
          plant.stage = plantStages[plant.skillKey];
          if (plant.isFullyGrown) plant.bloomed = true;
        }
      }
    }
    if (fedNutrients && fedNutrients.length) {
      for (const nut of this.nutrients) {
        if (fedNutrients.includes(nut.projectSlug)) {
          nut.collected = true;
        }
      }
    }
  }

  update(tiger) {
    this.pipe.checkProximity(tiger);

    for (const plant of this.plants) {
      plant.checkProximity(tiger);
      plant.update(0.016);
    }

    for (const nut of this.nutrients) {
      nut.checkProximity(tiger);
      nut.update(0.016);
    }
  }

  render(ctx) {
    // Underground background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#e8e0d4');
    grad.addColorStop(0.3, '#ddd4c6');
    grad.addColorStop(1, '#c8bfb0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Earthy texture lines
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    for (let ly = 100; ly < H; ly += 80) {
      ctx.beginPath();
      ctx.moveTo(0, ly + Math.sin(ly * 0.02) * 10);
      for (let lx = 0; lx < W; lx += 50) {
        ctx.lineTo(lx, ly + Math.sin((lx + ly) * 0.01) * 8);
      }
      ctx.stroke();
    }

    // World border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    // Platforms
    for (const p of this.platforms) p.render(ctx);

    // Pipe
    this.pipe.render(ctx);

    // Plants
    for (const plant of this.plants) plant.render(ctx);

    // Nutrients
    for (const nut of this.nutrients) nut.render(ctx);
  }
}
