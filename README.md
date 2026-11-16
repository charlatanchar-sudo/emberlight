# emberlight

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/charlatanchar-sudo/emberlight/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/charlatanchar-sudo/emberlight/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

EMBERLIGHT is a neon arena-defense arcade game in plain JavaScript — no engine, no assets, everything drawn and sounded in code. You pilot a warden around the last lantern in a dark arena while waves of geometric ember-moths swarm in to snuff it. Move with WASD or the arrow keys, aim with the mouse, hold the mouse button or Space to fire. Moths that reach the lantern drain its light; moths that hit you drain your hull. Kills drop embers that stack a combo multiplier, wave clears repair you a little, and a spiked storm elite closes every fifth wave. The game is complete: a title screen with a live attract mode, escalating waves, a HUD (score, wave, moths left, combo, lantern light, hull), pause and mute, and a game-over screen with your score and a restart.

## Run it

To play: serve `game/` with any static file server and open `game/index.html` in a desktop browser — it makes no network requests and loads only its own files.

```
python3 -m http.server --directory game 8080   # then open http://localhost:8080
```

`main.ts` is the handoff program: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` there with `buildDossier` from `vendor/makefun-game.ts`.

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards
