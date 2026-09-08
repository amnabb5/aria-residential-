#!/usr/bin/env node

/**
 * decimate-splat.mjs — stride-sample a .splat file (keep every Nth splat).
 *
 * The .splat format is a flat array of 32-byte rows:
 *   position (3×f32) · scale (3×f32) · color (RGBA u8) · rotation (4×u8)
 * Uniform stride sampling keeps the spatial distribution even — surfaces get
 * proportionally sparser everywhere instead of losing whole regions.
 *
 * Usage:
 *   node scripts/decimate-splat.mjs <input.splat> <stride> <output.splat>
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

const [, , inputPath, strideStr, outputPath] = process.argv;
const stride = parseInt(strideStr, 10);
if (!inputPath || !stride || stride < 2 || !outputPath) {
  console.error('Usage: node scripts/decimate-splat.mjs <input.splat> <stride> <output.splat>');
  process.exit(1);
}

const ROW = 32;
const buf = await readFile(resolve(inputPath));
const count = Math.floor(buf.length / ROW);
const keep = Math.floor(count / stride);
const out = Buffer.allocUnsafe(keep * ROW);
for (let i = 0; i < keep; i++) {
  buf.copy(out, i * ROW, i * stride * ROW, (i * stride + 1) * ROW);
}
await writeFile(resolve(outputPath), out);

console.log(`Done. ${inputPath} → ${outputPath}`);
console.log(`  Splats: ${count.toLocaleString()} → ${keep.toLocaleString()} (stride ${stride})`);
console.log(`  Size:   ${(buf.length / 1024 / 1024).toFixed(1)} MB → ${(out.length / 1024 / 1024).toFixed(1)} MB`);
