import { Platform } from '../entities/platform.js';
import { Interactable, Pipe } from '../entities/interactable.js';

const W = 900;
const H = 500;
const FLOOR_Y = H - 40;
const WALL_THICK = 6;

export class BathroomScene {
  constructor() {
    this.worldW = W;
    this.worldH = H;

    this.platforms = [
      new Platform(0, FLOOR_Y, W),
    ];

    this.interactables = [
      new Interactable(W / 2 - 35, FLOOR_Y - 80, 70, 80, 'toilet', 'toilet'),
      new Interactable(60, FLOOR_Y - 280, 100, 130, 'mirror', 'mirror'),
      new Interactable(W - 160, FLOOR_Y - 200, 80, 100, 'picture', 'picture'),
      new Interactable(W - 80, FLOOR_Y - 120, 50, 60, 'note', 'note'),
      new Interactable(W - 50, FLOOR_Y - 55, 40, 55, 'door', 'exit'),
    ];

    this.spawnX = 200;
    this.spawnY = FLOOR_Y - 95;
  }

  enter(tiger) {
    if (tiger) {
      tiger.x = this.spawnX;
      tiger.y = this.spawnY;
      tiger.vx = 0;
      tiger.vy = 0;
      tiger.grounded = true;
    }
  }

  exit() {}

  getInteractableAt(tiger) {
    for (const obj of this.interactables) {
      if (obj.checkProximity(tiger)) return obj;
    }
    return null;
  }

  update(tiger) {
    for (const obj of this.interactables) {
      obj.checkProximity(tiger);
    }
  }

  render(ctx) {
    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    // Walls — ink line border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = WALL_THICK;
    ctx.strokeRect(WALL_THICK / 2, WALL_THICK / 2, W - WALL_THICK, H - WALL_THICK);

    // Floor tiles (subtle grid)
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    const tileSize = 50;
    for (let tx = 0; tx < W; tx += tileSize) {
      ctx.beginPath();
      ctx.moveTo(tx, FLOOR_Y);
      ctx.lineTo(tx, H);
      ctx.stroke();
    }

    // Interactables
    for (const obj of this.interactables) {
      obj.render(ctx);
    }

    // Toilet detail — bowl shape on top of rect
    const toilet = this.interactables[0];
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(
      toilet.x + toilet.w / 2, toilet.y + 10,
      toilet.w / 2 - 5, 15,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
  }
}
