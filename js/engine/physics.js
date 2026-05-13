const GRAVITY = 980;

export function applyGravity(entity, dt) {
  entity.vy += GRAVITY * dt;
  entity.y += entity.vy * dt;
  entity.x += entity.vx * dt;
}

export function resolvePlatforms(entity, platforms) {
  entity.grounded = false;
  const pawY = entity.y + entity.pawOffset;
  const prevPawY = pawY - entity.vy * (1 / 60);

  for (const p of platforms) {
    // Only collide from above (falling onto platform)
    if (entity.vy < 0) continue;

    // Horizontal overlap check
    const eLeft = entity.x - 20;
    const eRight = entity.x + 20;
    if (eRight < p.x || eLeft > p.x + p.w) continue;

    // Vertical: paws crossed the platform top this frame
    if (prevPawY <= p.y + 2 && pawY >= p.y - 2) {
      entity.y = p.y - entity.pawOffset;
      entity.vy = 0;
      entity.grounded = true;
      return;
    }
  }
}

export function clampToWorld(entity, worldLeft, worldRight) {
  const half = 25;
  entity.x = Math.max(worldLeft + half, Math.min(worldRight - half, entity.x));
}
