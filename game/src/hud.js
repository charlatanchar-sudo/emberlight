// Everything Emberlight draws over the arena: the heads-up display during play (score,
// wave, combo, the lantern's light and the warden's hull) and the full-screen title,
// wave-banner, pause and game-over cards. All text is set in system fonts and drawn on the
// canvas itself, so a screenshot of the canvas shows the whole game.

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function bar(ctx, x, y, w, h, fraction, fill, label, valueText) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 4, 24, 0.62)';
  roundRect(ctx, x - 6, y - 6, w + 12, h + 24, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (fraction > 0) {
    ctx.fillStyle = fill;
    ctx.shadowColor = fill;
    ctx.shadowBlur = 10;
    roundRect(ctx, x, y, Math.max(h, w * clamp01(fraction)), h, h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = 'rgba(230, 236, 255, 0.85)';
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y + h + 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 13px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(valueText, x + w, y + h + 14);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * The in-play HUD. `state` carries score, wave, mothsLeft, comboStacks, comboMultiplier,
 * comboFraction (the decay timer, 0..1), lanternLight/lanternMax, hull/hullMax and muted.
 */
export function drawHud(ctx, view, state) {
  ctx.save();
  // Score and wave, top-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(168, 178, 255, 0.9)';
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('S C O R E', 26, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(String(state.score), 24, 66);
  ctx.fillStyle = 'rgba(168, 178, 255, 0.9)';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(`WAVE ${state.wave}`, 26, 92);

  // Moths remaining, top-centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 176, 58, 0.92)';
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText(state.mothsLeft > 0 ? `◆ ${state.mothsLeft} MOTHS IN THE DARK` : 'THE DARK IS CLEAR', view.w / 2, 36);

  // Combo, top-right: the multiplier and the ember-stack decay bar under it.
  if (state.comboStacks > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd166';
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText(`×${state.comboMultiplier.toFixed(2).replace(/\.?0+$/, '')}`, view.w - 24, 52);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.85)';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText(`COMBO · ${state.comboStacks} EMBERS`, view.w - 24, 72);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.25)';
    roundRect(ctx, view.w - 24 - 120, 80, 120, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    roundRect(ctx, view.w - 24 - 120 * clamp01(state.comboFraction), 80, 120 * clamp01(state.comboFraction), 5, 2.5);
    ctx.fill();
  }

  // Sound state, a whisper at top-right's foot.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(168, 178, 255, 0.55)';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText(state.muted ? 'SOUND OFF — M' : 'SOUND ON — M', view.w - 24, view.h - 18);

  // The two healths, bottom corners: the lantern's light in amber, the hull in cyan.
  bar(ctx, 24, view.h - 52, 250, 13, state.lanternLight / state.lanternMax,
    state.lanternLight / state.lanternMax < 0.3 ? '#ff5252' : '#ffb03a',
    'LANTERN LIGHT', `${Math.ceil(state.lanternLight)} / ${state.lanternMax}`);
  bar(ctx, view.w - 274, view.h - 52, 250, 13, state.hull / state.hullMax,
    state.hull / state.hullMax < 0.3 ? '#ff5252' : '#39e6ff',
    'WARDEN HULL', `${Math.ceil(state.hull)} / ${state.hullMax}`);
  ctx.restore();
}

/** The title card, drawn over the attract-mode demo playing behind it. */
export function drawTitleScreen(ctx, view, time, best) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 3, 18, 0.45)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';

  // The name, lit like the lantern itself.
  ctx.font = `800 92px ${FONT}`;
  ctx.shadowColor = '#ffb03a';
  ctx.shadowBlur = 42 + Math.sin(time * 2.2) * 10;
  ctx.fillStyle = '#ffd98a';
  ctx.fillText('EMBERLIGHT', view.w / 2, 218);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#6ff3ff';
  ctx.font = `600 19px ${FONT}`;
  ctx.fillText('a  l a n t e r n - d e f e n s e  a r c a d e', view.w / 2, 256);

  ctx.fillStyle = 'rgba(232, 236, 255, 0.92)';
  ctx.font = `400 18px ${FONT}`;
  ctx.fillText('Ember-moths are coming to snuff the last lantern.', view.w / 2, 322);
  ctx.fillText('Pilot its warden. Burn the swarm. Keep the light alive.', view.w / 2, 350);

  ctx.fillStyle = 'rgba(168, 178, 255, 0.95)';
  ctx.font = `600 15px ${FONT}`;
  const lines = [
    'WASD / ARROWS — move        MOUSE — aim        HOLD CLICK / SPACE — fire',
    'Gather fallen embers to raise your combo.  Do not let the moths reach the flame.',
    'P — pause        M — sound on/off',
  ];
  lines.forEach((line, i) => ctx.fillText(line, view.w / 2, 402 + i * 26));

  if (best > 0) {
    ctx.fillStyle = '#ffd166';
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(`BEST SCORE  ${best}`, view.w / 2, 512);
  }

  // The start prompt breathes.
  const glow = 0.55 + 0.45 * Math.sin(time * 3.4);
  ctx.globalAlpha = glow;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText('CLICK OR PRESS ENTER TO START', view.w / 2, 566);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** "WAVE N" sweeping through at a wave's start; `progress` runs 0..1 across its life. */
export function drawWaveBanner(ctx, view, wave, progress, isStormWave) {
  const alpha = progress < 0.15 ? progress / 0.15 : progress > 0.7 ? (1 - progress) / 0.3 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.textAlign = 'center';
  ctx.fillStyle = isStormWave ? '#ff5d7a' : '#ffd98a';
  ctx.font = `800 54px ${FONT}`;
  ctx.shadowColor = isStormWave ? '#ff3860' : '#ffb03a';
  ctx.shadowBlur = 30;
  ctx.fillText(isStormWave ? `WAVE ${wave} — THE STORM COMES` : `WAVE ${wave}`, view.w / 2, view.h / 2 - 120);
  ctx.restore();
}

/** The pause card. */
export function drawPausedOverlay(ctx, view) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 3, 18, 0.6)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8ecff';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 8);
  ctx.fillStyle = 'rgba(168, 178, 255, 0.9)';
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText('Press P to return to the dark', view.w / 2, view.h / 2 + 28);
  ctx.restore();
}

/**
 * The game-over card: why the run ended, the final score, the waves survived, the best
 * score, and how to go again. `result` is {score, wave, best, reason}.
 */
export function drawGameOverScreen(ctx, view, result, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 3, 18, 0.66)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';

  ctx.font = `800 64px ${FONT}`;
  ctx.shadowColor = '#ff3860';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#ff8fa5';
  ctx.fillText('THE LIGHT FADES', view.w / 2, 238);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(232, 236, 255, 0.92)';
  ctx.font = `400 19px ${FONT}`;
  ctx.fillText(result.reason, view.w / 2, 288);

  ctx.fillStyle = 'rgba(168, 178, 255, 0.9)';
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('F I N A L   S C O R E', view.w / 2, 356);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 56px ${FONT}`;
  ctx.fillText(String(result.score), view.w / 2, 416);

  ctx.fillStyle = '#ffd166';
  ctx.font = `700 19px ${FONT}`;
  ctx.fillText(`Waves survived: ${result.wave}`, view.w / 2, 462);
  if (result.score >= result.best && result.score > 0) {
    ctx.fillStyle = '#6ff3ff';
    ctx.fillText('★ A new best score ★', view.w / 2, 494);
  } else {
    ctx.fillStyle = 'rgba(168, 178, 255, 0.9)';
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(`Best score: ${result.best}`, view.w / 2, 494);
  }

  const glow = 0.55 + 0.45 * Math.sin(time * 3.4);
  ctx.globalAlpha = glow;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 22px ${FONT}`;
  ctx.fillText('PRESS ENTER OR CLICK TO TRY AGAIN', view.w / 2, 566);
  ctx.globalAlpha = 1;
  ctx.restore();
}
