#!/usr/bin/env node

/**
 * world-histogram.mjs — decode a city .ksplat and print ASCII density maps in
 * WALKTHROUGH WORLD COORDINATES, replicating the exact scene graph:
 *
 *   group Ry(π) → group pos [19.04,-15.97,15.73] → group pos [-1,splatY,-1]
 *     → splatMesh scale 20, rotation Rx(π)
 *
 *   world = (-18.04 - 20·dx,  -15.97+splatY - 20·dy,  -14.73 + 20·dz)
 *
 * Usage: node scripts/world-histogram.mjs <file.ksplat> [splatY=1.55]
 */

import { readFileSync } from 'fs';

const file = process.argv[2];
if (!file) throw new Error('usage: node scripts/world-histogram.mjs <file.ksplat> [splatY]');
const splatY = Number(process.argv[3] ?? 1.5517);
const buf = readFileSync(file);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const u32 = (o) => dv.getUint32(o, true);
const u16 = (o) => dv.getUint16(o, true);
const f32 = (o) => dv.getFloat32(o, true);

const HEADER = 4096;
const SECTION_HEADER = 1024;
const range = u32(HEADER + 24);
const bucketCount = u32(HEADER + 12);
const block = f32(HEADER + 16);
const shDeg = u16(HEADER + 40);
const splatCount = u32(HEADER + 4);
const bucketSize = u32(HEADER + 8);
const fullBucketCount = u32(HEADER + 32);
const partialCount = u32(HEADER + 36);
const SH_COMPONENTS = [0, 9, 24, 45];
const bytesPerSplat = 24 + SH_COMPONENTS[shDeg] * 2;

const metaSize = partialCount * 4;
const bucketsBase = HEADER + SECTION_HEADER + metaSize;
const dataBase = bucketsBase + bucketCount * 12;
const partialLens = new Uint32Array(buf.buffer, buf.byteOffset + HEADER + SECTION_HEADER, partialCount);
const sf = (block / 2) / range;

const bucketIdx = (local) => {
  const maxFull = fullBucketCount * bucketSize;
  if (local < maxFull) return Math.floor(local / bucketSize);
  let cursor = maxFull;
  let bi = fullBucketCount;
  let p = 0;
  while (cursor < splatCount && !(local >= cursor && local < cursor + partialLens[p])) {
    cursor += partialLens[p];
    bi++;
    p++;
  }
  return bi;
};

const N = splatCount;
const wx = new Float32Array(N);
const wy = new Float32Array(N);
const wz = new Float32Array(N);
const T = { x: -18.04, y: -15.97 + splatY, z: -14.73 };

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (let j = 0; j < N; j++) {
  const o = dataBase + j * bytesPerSplat;
  const bb = bucketsBase + bucketIdx(j) * 12;
  const dx = (u16(o) - range) * sf + f32(bb);
  const dy = (u16(o + 2) - range) * sf + f32(bb + 4);
  const dz = (u16(o + 4) - range) * sf + f32(bb + 8);
  wx[j] = T.x - 20 * dx;
  wy[j] = T.y - 20 * dy;
  wz[j] = T.z + 20 * dz;
  if (wx[j] < minX) minX = wx[j];
  if (wx[j] > maxX) maxX = wx[j];
  if (wy[j] < minY) minY = wy[j];
  if (wy[j] > maxY) maxY = wy[j];
  if (wz[j] < minZ) minZ = wz[j];
  if (wz[j] > maxZ) maxZ = wz[j];
}

console.log(`splats=${N}  shDeg=${shDeg}  block=${block}`);
console.log(`WORLD AABB  x [${minX.toFixed(1)}, ${maxX.toFixed(1)}]  y [${minY.toFixed(1)}, ${maxY.toFixed(1)}]  z [${minZ.toFixed(1)}, ${maxZ.toFixed(1)}]`);

// ── z histogram ──────────────────────────────────────────────────────────────
const bin = (maxZ - minZ) / 40 || 1;
const zh = new Array(40).fill(0);
for (let j = 0; j < N; j++) zh[Math.min(39, Math.floor((wz[j] - minZ) / bin))]++;
const maxH = Math.max(...zh);
console.log('\nZ histogram (world z, % of splats per bin, bin=' + bin.toFixed(1) + '):');
for (let b = 0; b < 40; b += 2) {
  const z0 = minZ + b * bin;
  const chars = Math.round((zh[b] / maxH) * 50);
  console.log(`  z ${z0.toFixed(0).padStart(6)}..${(z0 + 2 * bin).toFixed(0).padStart(6)} ${'#'.repeat(chars)} ${((zh[b] / N) * 100).toFixed(2)}%`);
}

// ── split relative to user's plane ──────────────────────────────────────────
let behind = 0, front = 0, nearBehind = 0;
for (let j = 0; j < N; j++) {
  if (wz[j] < -13.1) behind++; else front++;
  if (wz[j] < -13.1 && wz[j] > -60) nearBehind++;
}
console.log(`\nrelative to world z = -13.1:  behind=${behind} (${((behind / N) * 100).toFixed(1)}%)  front=${front}  within 47u behind plane=${nearBehind}`);

function asciiMap(title, u, v, uMin, uMax, vMin, vMax, w, h) {
  const grid = Array.from({ length: h }, () => new Array(w).fill(0));
  for (let j = 0; j < N; j++) {
    const cu = Math.floor(((u[j] - uMin) / (uMax - uMin)) * w);
    const cv = Math.floor(((v[j] - vMin) / (vMax - vMin)) * h);
    if (cu >= 0 && cu < w && cv >= 0 && cv < h) grid[h - 1 - cv][cu]++;
  }
  const m = Math.max(1, ...grid.flat());
  const chars = ' .:-=+*#%@';
  console.log(`\n${title}`);
  for (let r = 0; r < h; r++) {
    let line = '';
    for (let c = 0; c < w; c++) {
      const t = Math.log1p(grid[r][c]) / Math.log1p(m);
      line += grid[r][c] === 0 ? ' ' : chars[Math.min(chars.length - 1, 1 + Math.floor(t * (chars.length - 2)))];
    }
    console.log('  ' + line);
  }
}

const pad = 20;
asciiMap(
  `TOP VIEW (world X→, Z↑)  x[${(minX - pad).toFixed(0)}..${(maxX + pad).toFixed(0)}] z[${(minZ - pad).toFixed(0)}..${(maxZ + pad).toFixed(0)}]`,
  wx, wz, minX - pad, maxX + pad, minZ - pad, maxZ + pad, 60, 24
);

asciiMap(
  `SIDE VIEW near camera (world X→, Y↑)  x[-200..200] y[${(minY - 5).toFixed(0)}..${(maxY + 5).toFixed(0)}]`,
  wx, wy, -200, 200, minY - 5, maxY + 5, 60, 24
);
