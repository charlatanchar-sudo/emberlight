// Emberlight — boot, the game loop and the state machine.
//
// One canvas, one requestAnimationFrame loop, four states: 'title' (an autopilot warden
// plays an attract demo behind the title card), 'playing', 'paused' and 'over'. This file
// owns the lantern, the score and combo, the ember pickups, all collision resolution and
// the rendering order; the pieces themselves live in their own modules — the warden in
// player.js, the moths and their waves in enemies.js, sparks in particles.js, sound in
// audio.js, the HUD and cards in hud.js, and raw devices in input.js.

import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { Particles } from './particles.js';
import { Warden, WARDEN_TUNING } from './player.js';
import { EmberMoth, WaveDirector } from './enemies.js';
import { drawHud, drawTitleScreen, drawGameOverScreen, drawWaveBanner, drawPausedOverlay } from './hud.js';

const VIEW = { w: 1280, h: 800 };
const ARENA = { x: 0, y: 0, w: VIEW.w, h: VIEW.h };
const LANTERN_POS = { x: VIEW.w / 2, y: VIEW.h / 2 };
const LANTERN_RADIUS = 26;
const LANTERN_MAX_LIGHT = 100;
const COMBO_WINDOW = 3.5; // seconds an ember stack survives without a fresh pickup
const PICKUP_MAGNET_RADIUS = 120;
const PICKUP_COLLECT_RADIUS = 30;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');

/** How the logical 1280x800 playfield sits inside the window, in CSS pixels. */
const frame = { scale: 1, offsetX: 0, offsetY: 0 };

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  frame.scale = Math.min(cssW / VIEW.w, cssH / VIEW.h);
  frame.offsetX = (cssW - VIEW.w * frame.scale) / 2;
  frame.offsetY = (cssH - VIEW.h * frame.scale) / 2;
  frame.dpr = dpr;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - frame.offsetX) / frame.scale,
    y: (clientY - rect.top - frame.offsetY) / frame.scale,
  };
}

const input = new Input(canvas, toLogical);
input.mouse.x = VIEW.w / 2;
input.mouse.y = VIEW.h / 2 - 160;
const sound = new SoundBank();
window.addEventListener('keydown', () => sound.unlock());
window.addEventListener('pointerdown', () => sound.unlock());

// ---------------------------------------------------------------------------
// The lantern: a brass lamp on a stand at the arena's heart, and its light.
// ---------------------------------------------------------------------------

const lantern = {
  x: LANTERN_POS.x,
  y: LANTERN_POS.y,
  radius: LANTERN_RADIUS,
  light: LANTERN_MAX_LIGHT,
  maxLight: LANTERN_MAX_LIGHT,
};

function drawLantern(time) {
  const frac = Math.max(0, lantern.light / lantern.maxLight);
  ctx.save();
  // The halo: it shrinks and thins as the light is drained, so the whole arena reads it.
  if (frac > 0) {
    const haloRadius = 90 + 300 * frac + Math.sin(time * 2.3) * 7;
    const halo = ctx.createRadialGradient(lantern.x, lantern.y, 10, lantern.x, lantern.y, haloRadius);
    halo.addColorStop(0, `rgba(255, 176, 58, ${0.34 * frac})`);
    halo.addColorStop(0.45, `rgba(255, 140, 40, ${0.13 * frac})`);
    halo.addColorStop(1, 'rgba(255, 120, 30, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(lantern.x, lantern.y, haloRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  // The stand: a brass post and tripod feet under the glass.
  ctx.strokeStyle = '#8a6a2f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(lantern.x, lantern.y + 16);
  ctx.lineTo(lantern.x, lantern.y + 52);
  ctx.moveTo(lantern.x, lantern.y + 52);
  ctx.lineTo(lantern.x - 20, lantern.y + 68);
  ctx.moveTo(lantern.x, lantern.y + 52);
  ctx.lineTo(lantern.x + 20, lantern.y + 68);
  ctx.stroke();
  // The glass.
  ctx.beginPath();
  ctx.arc(lantern.x, lantern.y, lantern.radius, 0, Math.PI * 2);
  ctx.fillStyle = frac > 0 ? '#2a1703' : '#14101f';
  ctx.fill();
  ctx.strokeStyle = frac > 0 ? '#ffcf6e' : '#4a4364';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#ffb03a';
  ctx.shadowBlur = 18 * frac;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // The flame: a bright heart that gutters as the light fails.
  if (frac > 0) {
    const flicker = 0.82 + 0.18 * Math.sin(time * 11) * Math.sin(time * 5.7 + 1.3);
    const flameRadius = (5 + 13 * frac) * flicker;
    const flame = ctx.createRadialGradient(lantern.x, lantern.y, 0, lantern.x, lantern.y, flameRadius * 2.1);
    flame.addColorStop(0, 'rgba(255, 246, 205, 0.98)');
    flame.addColorStop(0.4, 'rgba(255, 196, 84, 0.85)');
    flame.addColorStop(1, 'rgba(255, 120, 30, 0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.arc(lantern.x, lantern.y, flameRadius * 2.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#3d3757';
    ctx.beginPath();
    ctx.arc(lantern.x, lantern.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The background: a fixed starfield, the arena ring, and slow drifting motes.
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const starRandom = mulberry32(20261115);
const stars = Array.from({ length: 150 }, () => ({
  x: starRandom() * VIEW.w,
  y: starRandom() * VIEW.h,
  r: 0.6 + starRandom() * 1.5,
  phase: starRandom() * Math.PI * 2,
  speed: 0.4 + starRandom() * 1.4,
}));
const motes = Array.from({ length: 26 }, () => ({
  x: starRandom() * VIEW.w,
  y: starRandom() * VIEW.h,
  vx: -6 + starRandom() * 12,
  vy: -3 + starRandom() * 6,
  r: 1 + starRandom() * 2.2,
}));

function drawBackground(time, dt) {
  ctx.save();
  for (const star of stars) {
    ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
    ctx.fillStyle = '#aebaff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The arena ring: the lantern's ground, a faint chalk circle in the dark.
  ctx.strokeStyle = 'rgba(120, 110, 220, 0.16)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 18]);
  ctx.beginPath();
  ctx.arc(lantern.x, lantern.y, 430, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(120, 110, 220, 0.07)';
  ctx.beginPath();
  ctx.arc(lantern.x, lantern.y, 300, 0, Math.PI * 2);
  ctx.stroke();
  // Drifting motes of dust in the lamplight.
  ctx.fillStyle = 'rgba(255, 205, 120, 0.35)';
  for (const mote of motes) {
    mote.x = (mote.x + mote.vx * dt + VIEW.w) % VIEW.w;
    mote.y = (mote.y + mote.vy * dt + VIEW.h) % VIEW.h;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Run state.
// ---------------------------------------------------------------------------

const game = {
  state: 'title',
  time: 0,
  score: 0,
  best: 0,
  wave: 0,
  comboStacks: 0,
  comboTimer: 0,
  enemies: [],
  pickups: [],
  particles: new Particles(),
  warden: new Warden(LANTERN_POS.x, LANTERN_POS.y + 170),
  director: new WaveDirector(ARENA),
  phase: 'fighting', // 'fighting' | 'intermission'
  phaseTimer: 0,
  bannerTimer: 0,
  shake: 0,
  overTimer: 0,
  overReason: '',
  wardenDown: false,
  statusTimer: 0,
};

const comboMultiplier = () => 1 + Math.min(game.comboStacks, 16) * 0.25;

function setStatus(text) {
  statusLine.textContent = text;
}

function startRun() {
  game.score = 0;
  game.wave = 0;
  game.comboStacks = 0;
  game.comboTimer = 0;
  game.enemies.length = 0;
  game.pickups.length = 0;
  game.particles.clear();
  game.warden.reset();
  game.wardenDown = false;
  lantern.light = lantern.maxLight;
  game.shake = 0;
  game.state = 'playing';
  input.drainPresses();
  sound.runStart();
  startWave(1);
  setStatus('Emberlight: playing, wave 1');
}

function startWave(wave) {
  game.wave = wave;
  game.director.startWave(wave);
  game.phase = 'fighting';
  game.bannerTimer = 1.6;
  sound.waveStart();
}

function gameOver(kind) {
  game.state = 'over';
  game.overTimer = 0;
  // Spend every latched press, so the click or key that coincided with death is not
  // read as "try again" the moment the restart gate opens.
  input.drainPresses();
  game.best = Math.max(game.best, game.score);
  game.overReason = kind === 'lantern'
    ? 'The moths reached the flame, and the last light in the dark went out.'
    : 'The warden fell with the lantern still burning behind them.';
  if (kind === 'lantern') {
    lantern.light = 0;
    game.particles.burst(lantern.x, lantern.y, { count: 70, colors: ['#ffb03a', '#ff6a2a', '#ffd166'], speed: 380, life: 0.9, size: 3 });
    game.particles.ring(lantern.x, lantern.y, '#ffb03a', { maxRadius: 260, life: 0.7, width: 4 });
    game.shake = 16;
  } else {
    game.wardenDown = true;
    game.particles.burst(game.warden.x, game.warden.y, { count: 60, colors: ['#6ff3ff', '#aefcff', '#39e6ff'], speed: 340, life: 0.8, size: 3 });
    game.particles.ring(game.warden.x, game.warden.y, '#6ff3ff', { maxRadius: 200, life: 0.6, width: 4 });
    game.shake = 14;
  }
  sound.gameOver();
  setStatus(`Emberlight: game over, score ${game.score}, waves survived ${game.wave}`);
}

// ---------------------------------------------------------------------------
// Damage and death.
// ---------------------------------------------------------------------------

function damageLantern(moth) {
  lantern.light = Math.max(0, lantern.light - moth.lanternDamage);
  game.shake = Math.min(15, game.shake + 6);
  game.particles.burst(moth.x, moth.y, { count: 16, colors: ['#ffb03a', '#ff6a2a'], speed: 240, life: 0.5, size: 2.6 });
  game.particles.ring(lantern.x, lantern.y, '#ff6a2a', { maxRadius: 70, life: 0.3, width: 2.5 });
  sound.lanternHurt();
  if (lantern.light <= 0) gameOver('lantern');
}

function damageWarden(moth) {
  const died = game.warden.damage(moth.hullDamage);
  // Shove the warden away from the moth that hit it.
  const angle = Math.atan2(game.warden.y - moth.y, game.warden.x - moth.x);
  game.warden.vx += Math.cos(angle) * 260;
  game.warden.vy += Math.sin(angle) * 260;
  game.particles.burst(game.warden.x, game.warden.y, { count: 14, colors: ['#6ff3ff', '#ffffff'], speed: 220, life: 0.4, size: 2.4 });
  if (died) gameOver('hull');
  else {
    game.shake = Math.min(12, game.shake + 4);
    sound.playerHurt();
  }
}

function killMoth(moth, index) {
  game.enemies.splice(index, 1);
  const big = moth.kind === 'storm';
  const points = Math.round(moth.scoreValue * comboMultiplier());
  game.score += points;
  game.particles.burst(moth.x, moth.y, {
    count: big ? 46 : moth.kind === 'orb' ? 24 : 13,
    colors: moth.kind === 'dart'
      ? ['#ff5da2', '#ffc2dd', '#ff2a7a']
      : moth.kind === 'orb'
        ? ['#c77dff', '#e6c6ff', '#9d4dff']
        : moth.kind === 'storm'
          ? ['#ff3860', '#ffd166', '#ff7b3c']
          : ['#ff9a3c', '#ffcf6e', '#ff6a2a'],
    speed: big ? 340 : 230,
    life: big ? 0.8 : 0.5,
    size: big ? 3 : 2.4,
  });
  if (big) game.particles.ring(moth.x, moth.y, '#ff3860', { maxRadius: 150, life: 0.5, width: 3.5 });
  game.particles.popup(moth.x, moth.y - 10, `+${points}`, big ? '#ffd166' : '#ffe9b0');
  sound.explosion(big);
  // Fallen embers: most kills drop one; orbs and the storm drop them in handfuls.
  const drops = moth.kind === 'storm' ? 4 : moth.kind === 'orb' ? 2 : Math.random() < 0.55 ? 1 : 0;
  for (let i = 0; i < drops; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 70;
    game.pickups.push({
      x: moth.x, y: moth.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 6, spin: Math.random() * Math.PI * 2,
    });
  }
}

// ---------------------------------------------------------------------------
// Collisions.
// ---------------------------------------------------------------------------

function resolveCollisions() {
  const warden = game.warden;
  // Bolts against moths, back to front so splices stay honest.
  for (let bi = warden.bolts.length - 1; bi >= 0; bi -= 1) {
    const bolt = warden.bolts[bi];
    let spent = false;
    for (let ei = game.enemies.length - 1; ei >= 0; ei -= 1) {
      const moth = game.enemies[ei];
      const dx = moth.x - bolt.x;
      const dy = moth.y - bolt.y;
      const reach = moth.radius + 5;
      if (dx * dx + dy * dy < reach * reach) {
        spent = true;
        const angle = Math.atan2(bolt.vy, bolt.vx);
        if (moth.hit(WARDEN_TUNING.boltDamage, angle)) killMoth(moth, ei);
        else {
          sound.hit();
          game.particles.burst(bolt.x, bolt.y, { count: 3, colors: ['#ffffff', '#ffd27a'], speed: 130, life: 0.25, size: 1.8 });
        }
        break;
      }
    }
    if (spent) warden.bolts.splice(bi, 1);
  }

  // Moths against the lantern and the warden.
  for (let ei = game.enemies.length - 1; ei >= 0; ei -= 1) {
    if (game.state !== 'playing') return; // a game over mid-pass ends the run's bookkeeping
    const moth = game.enemies[ei];
    const dl = Math.hypot(moth.x - lantern.x, moth.y - lantern.y);
    if (dl < lantern.radius + moth.radius * 0.45) {
      game.enemies.splice(ei, 1);
      damageLantern(moth);
      continue;
    }
    if (!game.wardenDown) {
      const dw = Math.hypot(moth.x - warden.x, moth.y - warden.y);
      if (dw < moth.radius + WARDEN_TUNING.radius) {
        if (moth.kind === 'storm') {
          // The elite does not die on the warden: it deals its blow and is hurled back.
          damageWarden(moth);
          moth.knockX -= (moth.x - warden.x) * 6;
          moth.knockY -= (moth.y - warden.y) * 6;
        } else {
          game.enemies.splice(ei, 1);
          game.particles.burst(moth.x, moth.y, { count: 10, colors: ['#ff9a3c', '#ffcf6e'], speed: 200, life: 0.4, size: 2.2 });
          damageWarden(moth);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pickups and combo.
// ---------------------------------------------------------------------------

function updatePickups(dt) {
  const warden = game.warden;
  for (let i = game.pickups.length - 1; i >= 0; i -= 1) {
    const ember = game.pickups[i];
    ember.life -= dt;
    if (ember.life <= 0) {
      game.pickups.splice(i, 1);
      continue;
    }
    const dx = warden.x - ember.x;
    const dy = warden.y - ember.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (!game.wardenDown && distance < PICKUP_MAGNET_RADIUS) {
      const pull = 620 * (1 - distance / PICKUP_MAGNET_RADIUS) + 120;
      ember.vx += (dx / distance) * pull * dt * 4;
      ember.vy += (dy / distance) * pull * dt * 4;
    }
    ember.vx *= Math.max(0, 1 - 2.4 * dt);
    ember.vy *= Math.max(0, 1 - 2.4 * dt);
    ember.x += ember.vx * dt;
    ember.y += ember.vy * dt;
    ember.spin += dt * 3;
    if (!game.wardenDown && distance < PICKUP_COLLECT_RADIUS) {
      game.pickups.splice(i, 1);
      game.comboStacks += 1;
      game.comboTimer = COMBO_WINDOW;
      const points = Math.round(25 * comboMultiplier());
      game.score += points;
      game.particles.popup(warden.x, warden.y - 24, `+${points}`, '#ffd166');
      game.particles.burst(ember.x, ember.y, { count: 5, colors: ['#ffd166', '#fff3c4'], speed: 90, life: 0.3, size: 1.8 });
      sound.pickup(game.comboStacks);
    }
  }
}

function drawPickups(time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ember of game.pickups) {
    const blink = ember.life < 1.5 ? (Math.floor(time * 9) % 2 === 0 ? 0.35 : 1) : 1;
    const pulse = 0.8 + 0.2 * Math.sin(time * 5 + ember.spin);
    ctx.save();
    ctx.translate(ember.x, ember.y);
    ctx.rotate(ember.spin);
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffb03a';
    ctx.shadowBlur = 12;
    const r = 6.5 * pulse;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.62, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.62, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The attract demo: an autopilot warden plays behind the title card, so the
// first thing a visitor sees is the game itself, alive. It is a showpiece of
// the real rules — same warden, same moths, same bolts — with no score kept.
// ---------------------------------------------------------------------------

const demo = {
  warden: new Warden(LANTERN_POS.x, LANTERN_POS.y + 190),
  director: new WaveDirector(ARENA),
  enemies: [],
  wave: 2,
  axis: { x: 0, y: 0 },
  input: null,
};
demo.input = {
  axis: () => demo.axis,
  mouse: { x: LANTERN_POS.x, y: LANTERN_POS.y - 200 },
  firing: false,
};
demo.director.startWave(demo.wave);

function updateAttract(dt) {
  // Spawn and steer the swarm.
  const spawn = demo.director.update(dt);
  if (spawn) demo.enemies.push(new EmberMoth(spawn.kind, spawn.x, spawn.y, spawn.wave));
  if (demo.director.pending === 0 && demo.enemies.length === 0) {
    demo.wave = demo.wave >= 3 ? 2 : demo.wave + 1;
    demo.director.startWave(demo.wave);
  }
  for (const moth of demo.enemies) moth.update(dt, lantern);

  // The pilot: stand between the lantern and the moth nearest to it, and shoot that moth.
  let target = null;
  let targetDistance = Infinity;
  for (const moth of demo.enemies) {
    const d = Math.hypot(moth.x - lantern.x, moth.y - lantern.y);
    if (d < targetDistance) {
      targetDistance = d;
      target = moth;
    }
  }
  const warden = demo.warden;
  if (target) {
    const away = Math.atan2(target.y - lantern.y, target.x - lantern.x);
    const postX = lantern.x + Math.cos(away) * 185;
    const postY = lantern.y + Math.sin(away) * 185;
    const dx = postX - warden.x;
    const dy = postY - warden.y;
    const distance = Math.hypot(dx, dy);
    demo.axis = distance > 14 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
    // Lead the target a touch, so the demo lands its bolts like a player would.
    const flight = Math.hypot(target.x - warden.x, target.y - warden.y) / WARDEN_TUNING.boltSpeed;
    demo.input.mouse.x = target.x + target.vx * flight * 0.8;
    demo.input.mouse.y = target.y + target.vy * flight * 0.8;
    demo.input.firing = Math.hypot(target.x - warden.x, target.y - warden.y) < 560;
  } else {
    demo.axis = { x: 0, y: 0 };
    demo.input.firing = false;
  }
  warden.update(dt, demo.input, ARENA, null);

  // Demo bolts burn demo moths; demo moths that reach the flame burst harmlessly.
  for (let bi = warden.bolts.length - 1; bi >= 0; bi -= 1) {
    const bolt = warden.bolts[bi];
    for (let ei = demo.enemies.length - 1; ei >= 0; ei -= 1) {
      const moth = demo.enemies[ei];
      const dx = moth.x - bolt.x;
      const dy = moth.y - bolt.y;
      const reach = moth.radius + 5;
      if (dx * dx + dy * dy < reach * reach) {
        warden.bolts.splice(bi, 1);
        if (moth.hit(WARDEN_TUNING.boltDamage, Math.atan2(bolt.vy, bolt.vx))) {
          demo.enemies.splice(ei, 1);
          game.particles.burst(moth.x, moth.y, { count: 11, colors: ['#ff9a3c', '#ffcf6e'], speed: 210, life: 0.45, size: 2.2 });
        }
        break;
      }
    }
  }
  for (let ei = demo.enemies.length - 1; ei >= 0; ei -= 1) {
    const moth = demo.enemies[ei];
    if (Math.hypot(moth.x - lantern.x, moth.y - lantern.y) < lantern.radius + moth.radius * 0.45) {
      demo.enemies.splice(ei, 1);
      game.particles.burst(moth.x, moth.y, { count: 12, colors: ['#ffb03a', '#ff6a2a'], speed: 200, life: 0.4, size: 2.2 });
    }
  }
  if (Math.random() < dt * 6) {
    game.particles.trail(lantern.x + (Math.random() - 0.5) * 16, lantern.y - 10, '#ffcf6e', { size: 2, life: 0.8 });
  }
}

// ---------------------------------------------------------------------------
// Per-state updates.
// ---------------------------------------------------------------------------

function updatePlaying(dt) {
  const spawn = game.director.update(dt);
  if (spawn) game.enemies.push(new EmberMoth(spawn.kind, spawn.x, spawn.y, spawn.wave));
  for (const moth of game.enemies) moth.update(dt, lantern);

  game.warden.update(dt, input, ARENA, () => sound.fire());
  if (game.warden.thrust > 0.25 && Math.random() < dt * 22) {
    game.particles.trail(
      game.warden.x - game.warden.vx * 0.05,
      game.warden.y - game.warden.vy * 0.05,
      '#39e6ff', { size: 1.8, life: 0.32 },
    );
  }
  if (Math.random() < dt * 5) {
    game.particles.trail(lantern.x + (Math.random() - 0.5) * 16, lantern.y - 10, '#ffcf6e', { size: 2, life: 0.8 });
  }

  resolveCollisions();
  if (game.state !== 'playing') return; // the run ended inside the collisions
  updatePickups(dt);

  // Combo decay: an untouched stack halves when its window runs out.
  if (game.comboStacks > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      game.comboStacks = Math.floor(game.comboStacks / 2);
      game.comboTimer = game.comboStacks > 0 ? COMBO_WINDOW : 0;
    }
  }

  game.bannerTimer = Math.max(0, game.bannerTimer - dt);

  // Wave flow: cleared dark → a breath → the next, worse wave.
  if (game.phase === 'fighting' && game.director.pending === 0 && game.enemies.length === 0) {
    const bonus = 100 + game.wave * 50;
    game.score += bonus;
    game.particles.popup(lantern.x, lantern.y - 60, `WAVE BONUS +${bonus}`, '#ffd166');
    lantern.light = Math.min(lantern.maxLight, lantern.light + 8);
    game.warden.hull = Math.min(WARDEN_TUNING.maxHull, game.warden.hull + 6);
    game.phase = 'intermission';
    game.phaseTimer = 2.4;
  } else if (game.phase === 'intermission') {
    game.phaseTimer -= dt;
    if (game.phaseTimer <= 0) startWave(game.wave + 1);
  }

  game.statusTimer -= dt;
  if (game.statusTimer <= 0) {
    game.statusTimer = 0.5;
    setStatus(`Emberlight: playing, wave ${game.wave}, score ${game.score}, lantern ${Math.ceil(lantern.light)} percent`);
  }
}

function updateOver(dt) {
  game.overTimer += dt;
  // The swarm keeps coming for the dead light a while; the sparks settle.
  for (let ei = game.enemies.length - 1; ei >= 0; ei -= 1) {
    const moth = game.enemies[ei];
    moth.update(dt, lantern);
    if (Math.hypot(moth.x - lantern.x, moth.y - lantern.y) < lantern.radius + moth.radius * 0.45) {
      game.enemies.splice(ei, 1);
      game.particles.burst(moth.x, moth.y, { count: 8, colors: ['#8a7f6a', '#5c5546'], speed: 120, life: 0.5, size: 2 });
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering.
// ---------------------------------------------------------------------------

function render() {
  const dpr = frame.dpr || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#070418';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * frame.scale, 0, 0, dpr * frame.scale, dpr * frame.offsetX, dpr * frame.offsetY);
  if (game.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * 2 * game.shake, (Math.random() - 0.5) * 2 * game.shake);
  }

  drawBackground(game.time, 1 / 60);
  drawLantern(game.time);

  if (game.state === 'title') {
    for (const moth of demo.enemies) moth.draw(ctx, game.time);
    demo.warden.draw(ctx, game.time);
    game.particles.draw(ctx);
    drawTitleScreen(ctx, VIEW, game.time, game.best);
    return;
  }

  drawPickups(game.time);
  for (const moth of game.enemies) moth.draw(ctx, game.time);
  if (!game.wardenDown) game.warden.draw(ctx, game.time);
  game.particles.draw(ctx);

  if (game.state === 'playing' || game.state === 'paused') {
    drawHud(ctx, VIEW, {
      score: game.score,
      wave: game.wave,
      mothsLeft: game.director.pending + game.enemies.length,
      comboStacks: game.comboStacks,
      comboMultiplier: comboMultiplier(),
      comboFraction: game.comboStacks > 0 ? game.comboTimer / COMBO_WINDOW : 0,
      lanternLight: lantern.light,
      lanternMax: lantern.maxLight,
      hull: game.warden.hull,
      hullMax: WARDEN_TUNING.maxHull,
      muted: sound.muted,
    });
    if (game.bannerTimer > 0) {
      drawWaveBanner(ctx, VIEW, game.wave, 1 - game.bannerTimer / 1.6, game.wave % 5 === 0);
    }
  }
  if (game.state === 'paused') drawPausedOverlay(ctx, VIEW);
  if (game.state === 'over') {
    drawGameOverScreen(ctx, VIEW, {
      score: game.score,
      wave: game.wave,
      best: game.best,
      reason: game.overReason,
    }, game.time);
  }
}

// ---------------------------------------------------------------------------
// The loop and the state machine's keys.
// ---------------------------------------------------------------------------

let lastTimestamp = performance.now();

function frameLoop(timestamp) {
  const dt = Math.min(0.033, Math.max(0, (timestamp - lastTimestamp) / 1000));
  lastTimestamp = timestamp;
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt * 26);

  if (input.consumePress('KeyM')) sound.toggleMute();

  if (game.state === 'title') {
    updateAttract(dt);
    game.particles.update(dt);
    if (input.consumePress('Enter') || input.consumeClick()) startRun();
  } else if (game.state === 'playing') {
    if (input.consumePress('KeyP')) {
      game.state = 'paused';
      setStatus('Emberlight: paused');
    } else {
      updatePlaying(dt);
      game.particles.update(dt);
    }
  } else if (game.state === 'paused') {
    if (input.consumePress('KeyP') || input.consumePress('Enter')) {
      game.state = 'playing';
      input.drainPresses();
    }
  } else if (game.state === 'over') {
    updateOver(dt);
    game.particles.update(dt);
    if (game.overTimer > 0.9 && (input.consumePress('Enter') || input.consumeClick())) startRun();
  }

  render();
  requestAnimationFrame(frameLoop);
}

setStatus('Emberlight: title screen');
requestAnimationFrame(frameLoop);
