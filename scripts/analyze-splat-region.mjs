#!/usr/bin/env node

/**
 * analyze-splat-region.mjs — dump the spatial structure of a .ksplat capture
 * (decompressed splat centers, read directly from the file with
 * alignment-safe DataView accesses) so a junk region (e.g. the capture's
 * backing "rectangle") can be pinpointed and culled by coordinates at runtime.
 *
 * Usage:  node scripts/analyze-splat-region.mjs [ksplatPath] [steps]
 * Env:    ALPHA_CUT=0..1   only count splats whose alpha >= cut
 */

import { resolve, basename } from 'path';
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const inputPath = resolve(args[0] ?? 'public/models/la_night_decimated.ksplat');
const steps = Number(args[1] ?? process.env.STEPS ?? 24);

const buf = readFileSync(inputPath);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

// ── .ksplat format (GaussianSplats3D SplatBuffer) ────────────────────────────
const HEADER = 4096;
const SECTION_HEADER = 1024;

const u32 = (o) => dv.getUint32(o, true);
const u16 = (o) => dv.getUint16(o, true);
const f32 = (o) => dv.getFloat32(o, true);

const versionMajor = buf[0];
const versionMinor = buf[1];
const maxSectionCount = u32(4);
const maxSplatCount = u32(12);
const compressionLevel = u16(20);

console.log(`File: ${basename(inputPath)} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
console.log(`version ${versionMajor}.${versionMinor} sections=${maxSectionCount} maxSplats=${maxSplatCount} compressionLevel=${compressionLevel}`);

const SH_COMPONENTS = [0, 9, 24, 45];
const LEVELS = {
  0: { bytesPerCenter: 12, bytesPerScale: 12, bytesPerRotation: 16, bytesPerColor: 4, scaleRange: 1, shBytesPerComponent: 4 },
  1: { bytesPerCenter: 6, bytesPerScale: 6, bytesPerRotation: 8, bytesPerColor: 4, scaleRange: 32767, shBytesPerComponent: 2 },
  2: { bytesPerCenter: 6, bytesPerScale: 6, bytesPerRotation: 8, bytesPerColor: 4, scaleRange: 32767, shBytesPerComponent: 1 },
};

// Flat store: centers + alpha of every splat we can decode
const raw = [];
const alphaArr = [];
let nanCount = 0;

let sectionBase = HEADER + maxSectionCount * SECTION_HEADER;

for (let s = 0; s < maxSectionCount; s++) {
  const hb = HEADER + s * SECTION_HEADER;
  const secMaxSplatCount = u32(hb + 4);
  const bucketSize = u32(hb + 8);
  const bucketCount = u32(hb + 12);
  const bucketBlockSize = f32(hb + 16);
  const bucketStorageSizeBytes = u16(hb + 20);
  const compressionScaleRange = u32(hb + 24) || LEVELS[compressionLevel].scaleRange;
  const fullBucketCount = u32(hb + 32);
  const partiallyFilledBucketCount = u32(hb + 36);
  const shDegree = u16(hb + 40);
  const L = LEVELS[compressionLevel];
  const bytesPerCenter = compressionLevel >= 1 ? 6 : 12;
  const bytesPerSplat = bytesPerCenter + L.bytesPerScale + L.bytesPerRotation + L.bytesPerColor +
                        SH_COMPONENTS[shDegree] * L.shBytesPerComponent;
  const bucketsMetaSize = partiallyFilledBucketCount * 4;
  const bucketsStorage = bucketStorageSizeBytes * bucketCount + bucketsMetaSize;
  const dataBase = sectionBase + bucketsStorage;
  const compressionScaleFactor = ((bucketBlockSize / 2) / compressionScaleRange) || 1;

  console.log(`section ${s}: splats=${secMaxSplatCount} shDeg=${shDegree} bytes/splat=${bytesPerSplat} buckets=${bucketCount} (full=${fullBucketCount} partial=${partiallyFilledBucketCount}) bucketSize=${bucketSize}`);

  for (let j = 0; j < secMaxSplatCount; j++) {
    const o = dataBase + j * bytesPerSplat;
    let x, y, z;
    if (compressionLevel === 0) {
      x = f32(o);
      y = f32(o + 4);
      z = f32(o + 8);
    } else {
      const maxFull = fullBucketCount * bucketSize;
      let bi;
      if (j < maxFull) {
        bi = Math.floor(j / bucketSize);
      } else {
        let cursor = maxFull;
        let p = 0;
        bi = fullBucketCount;
        while (cursor < secMaxSplatCount && !(j >= cursor && j < cursor + u32(sectionBase + p * 4))) {
          cursor += u32(sectionBase + p * 4);
          bi++;
          p++;
        }
      }
      const bb = sectionBase + bucketsMetaSize + bi * 12;
      const sf = compressionScaleFactor;
      const sr = compressionScaleRange;
      x = (u16(o) - sr) * sf + f32(bb);
      y = (u16(o + 2) - sr) * sf + f32(bb + 4);
      z = (u16(o + 4) - sr) * sf + f32(bb + 8);
    }
    const colorOffset = compressionLevel >= 1 ? 20 : 40;
    const a = dv.getUint8(o + colorOffset + 3) / 255;
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      raw.push(x, y, z);
      alphaArr.push(a);
    } else {
      nanCount++;
    }
  }
  sectionBase += bucketsStorage + bytesPerSplat * secMaxSplatCount;
}

console.log(`splats OK=${alphaArr.length} NaN=${nanCount}`);

const alphaCut = Number(process.env.ALPHA_CUT ?? 0);
const useIdx = [];
for (let i = 0; i < alphaArr.length; i++) if (alphaArr[i] >= alphaCut) useIdx.push(i);
if (useIdx.length === 0) {
  console.error(`No splats with alpha >= ${alphaCut}`);
  process.exit(1);
}
console.log(`Using ${useIdx.length} splats${alphaCut ? ` (alpha >= ${alphaCut})` : ''}`);

const get = (i, axis) => raw[useIdx[i] * 3 + axis];

let minX = Infinity, minY = Infinity, minZ = Infinity;
let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
for (let i = 0; i < useIdx.length; i++) {
  minX = Math.min(minX, get(i, 0)); maxX = Math.max(maxX, get(i, 0));
  minY = Math.min(minY, get(i, 1)); maxY = Math.max(maxY, get(i, 1));
  minZ = Math.min(minZ, get(i, 2)); maxZ = Math.max(maxZ, get(i, 2));
}
const f = (v) => v.toFixed(2);
console.log(`AABB x: [${f(minX)}, ${f(maxX)}]  y: [${f(minY)}, ${f(maxY)}]  z: [${f(minZ)}, ${f(maxZ)}]`);

function grid(label, axisCol, axisRow) {
  console.log(`\n${label}`);
  const g = new Int32Array(steps * steps);
  let maxCell = 0;
  for (let i = 0; i < useIdx.length; i++) {
    const col = Math.min(steps - 1, Math.max(0, Math.floor(((get(i, axisCol) - (axisCol === 0 ? minX : axisCol === 1 ? minY : minZ)) / ((axisCol === 0 ? maxX : axisCol === 1 ? maxY : maxZ) - (axisCol === 0 ? minX : axisCol === 1 ? minY : minZ) || 1)) * steps)));
    const row = Math.min(steps - 1, Math.max(0, Math.floor(((get(i, axisRow) - (axisRow === 0 ? minX : axisRow === 1 ? minY : minZ)) / ((axisRow === 0 ? maxX : axisRow === 1 ? maxY : maxZ) - (axisRow === 0 ? minX : axisRow === 1 ? minY : minZ) || 1)) * steps)));
    const c = ++g[row * steps + col];
    if (c > maxCell) maxCell = c;
  }
  const chars = ' .:*#@';
  const lo = axisRow === 0 ? minX : axisRow === 1 ? minY : minZ;
  const hi = axisRow === 0 ? maxX : axisRow === 1 ? maxY : maxZ;
  for (let row = steps - 1; row >= 0; row--) {
    let line = '';
    for (let col = 0; col < steps; col++) {
      const v = g[row * steps + col] / (maxCell || 1);
      const k = v === 0 ? 0 : Math.max(1, Math.ceil(v * (chars.length - 1)));
      line += chars[k];
    }
    const rw = lo + ((row + 1) / steps) * (hi - lo);
    console.log(`  ${rw.toFixed(1).padStart(8)} |${line}|`);
  }
  const cLo = axisCol === 0 ? minX : axisCol === 1 ? minY : minZ;
  const cHi = axisCol === 0 ? maxX : axisCol === 1 ? maxY : maxZ;
  console.log(`           ${'-'.repeat(steps + 1)}`);
  console.log(`           [${cLo.toFixed(1)} … ${cHi.toFixed(1)}] cols = min→max of the COLUMN axis`);
}

grid('X-Y top view (rows = Y from min up; cols = X)', 0, 1);
grid('X-Z top view (rows = Z from min up; cols = X)', 0, 2);
grid('Y-Z side view (rows = Z; cols = Y)', 1, 2);
