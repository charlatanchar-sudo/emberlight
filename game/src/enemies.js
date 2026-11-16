// The ember-moths: geometric swarmers that cross the dark to snuff the lantern, and the
// wave director that sends them in growing, mixed waves. Four kinds, each with its own
// silhouette, gait and temper:
//
//   ember — the common moth: a wobbling diamond that drifts straight for the flame.
//   dart  — a fast sliver that weaves hard and dies to a single bolt, but bites quickly.
//   orb   — a slow, fat hexagon with a thick shell: it soaks bolts and hits the lantern hard.
//   storm — the elite that closes every fifth wave: a great spiked star, very tough,
//           that surges as it nears the light and bursts into loose embers when it dies.

export const MOTH_KINDS = {
  ember: {
    hp: 2, speed: 62, radius: 13, lanternDamage: 6, hullDamage: 8, score: 50,
    colors: ['#ff9a3c', '#ffcf6e', '#ff6a2a'],
    body: '#3a1408', edge: '#ffb03a',
  },
  dart: {
    hp: 1, speed: 138, radius: 10, lanternDamage: 4, hullDamage: 6, score: 40,
    colors: ['#ff5da2', '#ffc2dd', '#ff2a7a'],
    body: '#33081d', edge: '#ff5da2',
  },
  orb: {
    hp: 7, speed: 37, radius: 21, lanternDamage: 13, hullDamage: 14, score: 150,
    colors: ['#c77dff', '#e6c6ff', '#9d4dff'],
    body: '#1d0a33', edge: '#c77dff',
  },
  storm: {
    hp: 46, speed: 30, radius: 32, lanternDamage: 26, hullDamage: 20, score: 1000,
    colors: ['#ff3860', '#ffd166', '#ff7b3c'],
    body: '#2b0714', edge: '#ff3860',
  },
};

let nextMothId = 1;

export class EmberMoth {
  constructor(kind, x, y, wave) {
    const stats = MOTH_KINDS[kind];
    this.id = nextMothId;
    nextMothId += 1;
    this.kind = kind;
    this.x = x;
    this.y = y;
    // Later waves breed tougher, quicker moths; the growth is capped so a long run stays fair.
    const hpBonus = kind === 'storm' ? wave * 2 : Math.floor(wave / 6);
    this.maxHp = stats.hp + hpBonus;
    this.hp = this.maxHp;
    this.speed = stats.speed * Math.min(1.45, 1 + wave * 0.022) * (0.88 + Math.random() * 0.24);
    this.radius = stats.radius;
    this.lanternDamage = stats.lanternDamage;
    this.hullDamage = stats.hullDamage;
    this.scoreValue = stats.score;
    this.vx = 0;
    this.vy = 0;
    this.knockX = 0;
    this.knockY = 0;
    this.flash = 0;
    this.wobbleSeed = Math.random() * Math.PI * 2;
    this.age = 0;
    this.surgeTimer = 2 + Math.random() * 2;
  }

  get dead() {
    return this.hp <= 0;
  }

  /**
   * Steer for one step: home on the lantern, weaving by kind. Knockback from bolt hits is
   * added on top and bleeds off quickly.
   */
  update(dt, lantern) {
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt);
    const dx = lantern.x - this.x;
    const dy = lantern.y - this.y;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;

    let weave = 0;
    if (this.kind === 'ember') weave = Math.sin(this.age * 3.1 + this.wobbleSeed) * 0.45;
    if (this.kind === 'dart') weave = Math.sin(this.age * 6.4 + this.wobbleSeed) * 0.85;
    if (this.kind === 'orb') weave = Math.sin(this.age * 1.4 + this.wobbleSeed) * 0.16;

    let speed = this.speed;
    if (this.kind === 'storm') {
      // The elite gathers itself and lunges: a slow stalk, then a surge near the light.
      this.surgeTimer -= dt;
      if (this.surgeTimer <= 0) this.surgeTimer = 2.6;
      if (this.surgeTimer < 0.7 || distance < 210) speed = this.speed * 1.9;
    }

    const steerX = nx - ny * weave;
    const steerY = ny + nx * weave;
    const steerLength = Math.hypot(steerX, steerY) || 1;
    this.vx = (steerX / steerLength) * speed + this.knockX;
    this.vy = (steerY / steerLength) * speed + this.knockY;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const knockDecay = Math.max(0, 1 - 7 * dt);
    this.knockX *= knockDecay;
    this.knockY *= knockDecay;
  }

  /** Take bolt damage with a shove along the bolt's line. Returns true when the moth dies. */
  hit(damage, angle) {
    this.hp -= damage;
    this.flash = 0.09;
    const shove = this.kind === 'storm' ? 26 : this.kind === 'orb' ? 60 : 130;
    this.knockX += Math.cos(angle) * shove;
    this.knockY += Math.sin(angle) * shove;
    return this.dead;
  }

  draw(ctx, time) {
    const stats = MOTH_KINDS[this.kind];
    const heading = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(heading);
    ctx.shadowColor = stats.edge;
    ctx.shadowBlur = 13;
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : stats.body;
    ctx.strokeStyle = this.flash > 0 ? '#ffffff' : stats.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (this.kind === 'ember') {
      ctx.moveTo(14, 0);
      ctx.lineTo(0, -10);
      ctx.lineTo(-12, 0);
      ctx.lineTo(0, 10);
      ctx.closePath();
    } else if (this.kind === 'dart') {
      ctx.moveTo(15, 0);
      ctx.lineTo(-4, -6);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-4, 6);
      ctx.closePath();
    } else if (this.kind === 'orb') {
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + time * 0.7;
        const px = Math.cos(a) * this.radius;
        const py = Math.sin(a) * this.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      // storm: an eight-point star, slowly turning against its heading.
      const spin = time * 0.9;
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2 + spin;
        const r = i % 2 === 0 ? this.radius : this.radius * 0.55;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // The burning core: brighter as the moth closes on the lantern's heart.
    const pulse = 0.75 + 0.25 * Math.sin(time * 6 + this.wobbleSeed);
    ctx.fillStyle = stats.colors[1];
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // A chipped shell shows: tough kinds carry a thin damage arc.
    if ((this.kind === 'orb' || this.kind === 'storm') && this.hp < this.maxHp) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 6, -Math.PI / 2, -Math.PI / 2 + (this.hp / this.maxHp) * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * What a wave is made of. Wave 1 teaches with embers alone; darts join at wave 2, orbs at
 * wave 3, and every fifth wave is closed by a storm elite with an escort.
 */
export function waveComposition(wave) {
  const list = [];
  const add = (kind, count) => {
    for (let i = 0; i < count; i += 1) list.push(kind);
  };
  add('ember', 5 + wave * 3);
  if (wave >= 2) add('dart', Math.min(16, 1 + wave));
  if (wave >= 3) add('orb', Math.min(9, Math.floor((wave - 1) * 1.1)));
  if (wave % 5 === 0) add('storm', 1 + Math.floor(wave / 15));
  // Shuffle so kinds arrive interleaved, not in blocks.
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = (Math.random() * (i + 1)) | 0;
    const swap = list[i];
    list[i] = list[j];
    list[j] = swap;
  }
  // The storm, when there is one, closes the wave.
  const stormIndex = list.indexOf('storm');
  if (stormIndex >= 0) {
    list.splice(stormIndex, 1);
    list.push('storm');
  }
  return list;
}

/** Seconds between spawns in a wave: brisk early, relentless later, never a solid wall. */
export function waveSpawnInterval(wave) {
  return Math.max(0.34, 1.02 - wave * 0.055);
}

/** Hands out a wave's moths one spawn at a time, from the arena's edge. */
export class WaveDirector {
  constructor(bounds) {
    this.bounds = bounds;
    this.queue = [];
    this.timer = 0;
    this.interval = 1;
    this.wave = 0;
  }

  startWave(wave) {
    this.wave = wave;
    this.queue = waveComposition(wave);
    this.interval = waveSpawnInterval(wave);
    this.timer = 0.35; // a breath before the first moth of a wave
  }

  get pending() {
    return this.queue.length;
  }

  /** Advance the clock; returns a spawn spec {kind, x, y} when a moth is due, else null. */
  update(dt) {
    if (this.queue.length === 0) return null;
    this.timer -= dt;
    if (this.timer > 0) return null;
    this.timer = this.interval * (0.75 + Math.random() * 0.5);
    const kind = this.queue.shift();
    const { x, y } = this.#edgePoint();
    return { kind, x, y, wave: this.wave };
  }

  /** A random point on the playfield's rim, kept off the corners so entries read clearly. */
  #edgePoint() {
    const b = this.bounds;
    const margin = 46;
    const side = (Math.random() * 4) | 0;
    if (side === 0) return { x: b.x + margin + Math.random() * (b.w - margin * 2), y: b.y - 18 };
    if (side === 1) return { x: b.x + margin + Math.random() * (b.w - margin * 2), y: b.y + b.h + 18 };
    if (side === 2) return { x: b.x - 18, y: b.y + margin + Math.random() * (b.h - margin * 2) };
    return { x: b.x + b.w + 18, y: b.y + margin + Math.random() * (b.h - margin * 2) };
  }
}
