#!/usr/bin/env node

/**
 * decimate-splat-alpha.mjs — QUALITY-AWARE decimation of a .splat file.
 *
 * Unlike uniform stride sampling (which produces banding/speckle), this
 * keeps the visually important splats and thins the rest at random:
 *
 *   • ALWAYS keep splats whose color alpha ≥ --keep-alpha (bright/opaque —
 *     city lights, key surfaces — they define the night skyline look).
 *   • Keep other (dim) splats with probability --keep-prob (seeded RNG →
 *     reproducible builds, no regular patterns).
 *
 * The result looks like the same scene at slightly lower "density", with
 * the lights intact — ideal for a distant backdrop viewed through windows.
 *
 * Usage:
 *   node scripts/decimate-splat-alpha.mjs <in.splat> <out.splat> [keepProb] [keepAlpha]
 *   (defaults: keepProb=0.3, keepAlpha=200)
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

const [, , inputPath, outputPath, probStr = '0.3', alphaStr = '200'] = process.argv;
const keepProb = parseFloat(probStr);
const keepAlpha = parseInt(alphaStr, 10);
if (!inputPath || !outputPath || !(keepProb > 0 && keepProb <= 1)) {
  console.error('Usage: node scripts/decimate-splat-alpha.mjs <in.splat> <out.splat> [keepProb] [keepAlpha]');
  process.exit(1);
}

// Deterministic RNG (mulberry32) so rebuilding produces identical output.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1337);

const ROW = 32;
const ALPHA_BYTE = 27; // position(12) + scale(12) + rgb(3) → alpha
const buf = await readFile(resolve(inputPath));
const count = Math.floor(buf.length / ROW);

// Pass 1: decide which rows to keep.
const keep = new Uint8Array(count);
let keptBright = 0;
let keptDim = 0;
for (let i = 0; i < count; i++) {
  const alpha = buf[i * ROW + ALPHA_BYTE];
  if (alpha >= keepAlpha) {
    keep[i] = 1;
    keptBright++;
  } else if (rand() < keepProb) {
    keep[i] = 1;
    keptDim++;
  }
}
const keepCount = keptBright + keptDim;

// Pass 2: compact.
const out = Buffer.allocUnsafe(keepCount * ROW);
let w = 0;
for (let i = 0; i < count; i++) {
  if (!keep[i]) continue;
  buf.copy(out, w * ROW, i * ROW, (i + 1) * ROW);
  w++;
}
await writeFile(resolve(outputPath), out);

const pct = (n) => `${(n * 100).toFixed(1)}%`;
console.log(`Done. ${inputPath} → ${outputPath}`);
console.log(`  Splats: ${count.toLocaleString()} → ${keepCount.toLocaleString()} (${pct(keepCount / count)})`);
console.log(`  bright kept: ${keptBright.toLocaleString()} · dim kept: ${keptDim.toLocaleString()} of ${(count - keptBright).toLocaleString()}`);
console.log(`  Size: ${(buf.length / 1024 / 1024).toFixed(1)} MB → ${(out.length / 1024 / 1024).toFixed(1)} MB`);
