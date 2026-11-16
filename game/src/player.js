// The warden: the player's lantern-keeper. It glides around the arena on WASD or the arrow
// keys, aims at the mouse, and fires bolts of bottled light while the trigger is held. Its
// bolts live here too — the warden spawns and flies them; main.js tests them against moths.

export const WARDEN_TUNING = {
  radius: 14,
  speed: 308,
  acceleration: 2600,
  maxHull: 100,
  fireInterval: 0.135,
  boltSpeed: 780,
  boltLife: 0.85,
  boltDamage: 1,
  invulnerableSeconds: 0.7,
};

export class Warden {
  constructor(x, y) {
    this.spawnX = x;
    this.spawnY = y;
    this.bolts = [];
    this.reset();
  }

  reset() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.hull = WARDEN_TUNING.maxHull;
    this.aimAngle = -Math.PI / 2;
    this.fireTimer = 0;
    this.invulnerable = 0;
    this.muzzle = 0;
    this.thrust = 0;
    this.bolts.length = 0;
  }

  get alive() {
    return this.hull > 0;
  }

  /**
   * Move, aim and fire for one step. `bounds` is the playfield rectangle; `onFire` is called
   * for each bolt launched, so the game can play its sound.
   */
  update(dt, input, bounds, onFire) {
    const axis = input.axis();
    const length = Math.hypot(axis.x, axis.y) || 1;
    this.vx += (axis.x / length) * WARDEN_TUNING.acceleration * dt;
    this.vy += (axis.y / length) * WARDEN_TUNING.acceleration * dt;
    // Settle fast when no key pushes that way: the warden answers at once and stops at once.
    if (axis.x === 0) this.vx -= this.vx * Math.min(1, 14 * dt);
    if (axis.y === 0) this.vy -= this.vy * Math.min(1, 14 * dt);
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > WARDEN_TUNING.speed) {
      this.vx = (this.vx / speed) * WARDEN_TUNING.speed;
      this.vy = (this.vy / speed) * WARDEN_TUNING.speed;
    }
    this.x = clamp(this.x + this.vx * dt, bounds.x + WARDEN_TUNING.radius, bounds.x + bounds.w - WARDEN_TUNING.radius);
    this.y = clamp(this.y + this.vy * dt, bounds.y + WARDEN_TUNING.radius, bounds.y + bounds.h - WARDEN_TUNING.radius);
    this.thrust = speed / WARDEN_TUNING.speed;

    this.aimAngle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);

    this.fireTimer -= dt;
    if (input.firing && this.fireTimer <= 0) {
      this.fireTimer = WARDEN_TUNING.fireInterval;
      this.muzzle = 0.06;
      const spread = (Math.random() - 0.5) * 0.045;
      const angle = this.aimAngle + spread;
      this.bolts.push({
        x: this.x + Math.cos(this.aimAngle) * (WARDEN_TUNING.radius + 6),
        y: this.y + Math.sin(this.aimAngle) * (WARDEN_TUNING.radius + 6),
        vx: Math.cos(angle) * WARDEN_TUNING.boltSpeed,
        vy: Math.sin(angle) * WARDEN_TUNING.boltSpeed,
        life: WARDEN_TUNING.boltLife,
      });
      if (onFire) onFire();
    }

    for (let i = this.bolts.length - 1; i >= 0; i -= 1) {
      const bolt = this.bolts[i];
      bolt.life -= dt;
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      if (bolt.life <= 0 || bolt.x < bounds.x - 30 || bolt.x > bounds.x + bounds.w + 30
        || bolt.y < bounds.y - 30 || bolt.y > bounds.y + bounds.h + 30) {
        this.bolts.splice(i, 1);
      }
    }

    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
  }

  /**
   * Take a hit. Returns true when this hit destroys the warden. Hits landing during the
   * brief invulnerability after a previous hit are ignored, so a swarm cannot melt the
   * hull in a single frame.
   */
  damage(amount) {
    if (this.invulnerable > 0 || !this.alive) return false;
    this.hull = Math.max(0, this.hull - amount);
    this.invulnerable = WARDEN_TUNING.invulnerableSeconds;
    // A shove away from the lantern's heart is applied by main.js, which knows the geometry.
    return !this.alive;
  }

  draw(ctx, time) {
    // Bolts first: short glowing streaks along their flight.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#aefcff';
    ctx.fillStyle = '#e8feff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const bolt of this.bolts) {
      const tail = 0.016;
      ctx.globalAlpha = Math.min(1, bolt.life * 3);
      ctx.beginPath();
      ctx.moveTo(bolt.x - bolt.vx * tail, bolt.y - bolt.vy * tail);
      ctx.lineTo(bolt.x, bolt.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // The warden: a cyan kite-ship with a rotating guard ring, blinking while invulnerable.
    if (this.invulnerable > 0 && Math.floor(time * 16) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.aimAngle);
    ctx.shadowColor = '#39e6ff';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#0e5a6e';
    ctx.strokeStyle = '#6ff3ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d9fbff';
    ctx.beginPath();
    ctx.arc(3, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    if (this.muzzle > 0) {
      ctx.fillStyle = 'rgba(200, 250, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(22, 0, 4.5 * (this.muzzle / 0.06), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Guard ring, drawn unrotated so it sweeps calmly around the hull.
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(time * 1.4);
    ctx.strokeStyle = 'rgba(111, 243, 255, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, WARDEN_TUNING.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}
