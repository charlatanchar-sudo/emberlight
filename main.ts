// Emberlight — handoff program for make.fun's best-game-01 bounty (Node 22, standard library only).
//
// The game itself is the static site in game/ beside this file: plain HTML, CSS and ES modules
// that a desktop browser plays offline, with no build step and no network request. This program
// hands the entry in. It copies game/ and screenshots/ into the output directory and writes the
// dossier the judge reads — dossier.json, produced by buildDossier from the vendored make.fun
// library — next to them. The output is a pure function of the repository's files, so the two
// grading runs write identical bytes.
//
// In the grader the output directory is /output; anywhere else, point MAKEFUN_OUTPUT_DIR at a
// scratch directory instead:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game, exactly as it sits in the repository.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });

// The screenshots, in their own folder so the gate counts them apart from the game files.
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier, under the scorer's caps: the judge's text budget shapes its bytes, and the size
// limits restate the gate's own (at most 4 screenshots of 256 KiB; at most 993 game files and
// 48 MiB of game; no path under game/ longer than 1000 bytes), so an entry the scorer would
// refuse is refused here instead of written.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
