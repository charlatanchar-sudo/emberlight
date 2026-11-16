// Particles for Emberlight: sparks, shockwave rings and floating score popups, all pooled in
// one flat array so a busy wave never allocates per frame. Everything is drawn additively
// ('lighter') so overlapping sparks read as glow against the dark arena.

const KIND_DOT = 0;
const KIND_RING = 1;
const KIND_TEXT = 2;

export class Particles {
  constructor(capacity = 1000) {
    this.capacity = capacity;
    this.items = [];
  }

  clear() {
    this.items.length = 0;
  }

  #push(particle) {
    if (this.items.length >= this.capacity) this.items.shift();
    this.items.push(particle);
  }

  /**
   * A burst of sparks flying out of (x, y). `colors` is a palette the sparks pick from;
   * `speed` and `life` are the centres of a randomised range.
   */
  burst(x, y, { count = 12, colors = ['#ffd27a'], speed = 220, life = 0.5, size = 2.4, gravity = 0 } = {}) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.3 + Math.random() * 0.9);
      const span = life * (0.5 + Math.random() * 0.8);
      this.#push({
        kind: KIND_DOT,
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: span,
        maxLife: span,
        size: size * (0.6 + Math.random() * 0.8),
        color: colors[(Math.random() * colors.length) | 0],
        gravity,
      });
    }
  }

  /** One soft drifting mote — the warden's engine trail and the lantern's rising embers. */
  trail(x, y, color, { size = 2, life = 0.4, spread = 14 } = {}) {
    this.#push({
      kind: KIND_DOT,
      x: x + (Math.random() - 0.5) * spread,
      y: y + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 22,
      vy: -18 - Math.random() * 26,
      life,
      maxLife: life,
      size,
      color,
      gravity: 0,
    });
  }

  /** An expanding shockwave ring that fades as it grows. */
  ring(x, y, color, { maxRadius = 90, life = 0.4, width = 3 } = {}) {
    this.#push({
      kind: KIND_RING,
      x,
      y,
      vx: 0,
      vy: 0,
      life,
      maxLife: life,
      size: width,
      color,
      maxRadius,
      gravity: 0,
    });
  }

  /** A floating score popup that rises and fades: "+150". */
  popup(x, y, text, color = '#ffe9b0') {
    this.#push({
      kind: KIND_TEXT,
      x,
      y,
      vx: (Math.random() - 0.5) * 16,
      vy: -56,
      life: 0.85,
      maxLife: 0.85,
      size: 15,
      color,
      text,
      gravity: 0,
    });
  }

  update(dt) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const p = items[i];
      p.life -= dt;
      if (p.life <= 0) {
        items.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === KIND_DOT) {
        // Sparks drag hard, so a burst blooms and settles instead of streaking away.
        const drag = Math.max(0, 1 - 3.2 * dt);
        p.vx *= drag;
        p.vy *= drag;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.items) {
      const fade = Math.max(0, p.life / p.maxLife);
      if (p.kind === KIND_DOT) {
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * fade), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === KIND_RING) {
        const grown = 1 - fade;
        ctx.globalAlpha = fade * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * fade + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.maxRadius * grown + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, fade * 1.6);
        ctx.fillStyle = p.color;
        ctx.font = `700 ${p.size}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      }
    }
    ctx.restore();
  }
}
