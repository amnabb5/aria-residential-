#!/usr/bin/env node

/**
 * filter-ksplat-plane.mjs — physically delete splats from a .ksplat capture
 * and re-encode the library's bucket-compressed format exactly.
 *
 * WHY: runtime shader culls proved unreliable across library material
 * rebuilds; this removes the data itself, so deleted regions can never render.
 * Splat scale/rotation/color bytes are copied verbatim; ONLY centers are
 * re-quantized (against their new bucket centers).
 *
 * Coordinate mapping (walkthrough world <- capture data), derived from
 * WalkthroughScene:
 *   world = Ry(PI) * (EXTERIOR_GROUP_POS + splatPos) + diag(-1,-1,1) * 20 * data
 *         = (-18.04 - 20*dx,  -15.97+splatY - 20*dy,  -14.73 + 20*dz)
 *
 * MODES:
 *   --world-z Z --delete-below|--delete-above   axis-aligned half-space cut
 *   --keep-z-min A --keep-z-max B               keep a z band
 *   --behind-pose X Z YAW [--keep-z-min A]      delete everything behind a
 *       vertical camera plane through (X, Z) with yaw YAW (radians, app
 *       convention: forward = (-sin yaw, 0, -cos yaw)); behind = (sin yaw,
 *       0, cos yaw). Optional lower z bound may be combined with it.
 *
 * USAGE:
 *   node scripts/filter-ksplat-plane.mjs --behind-pose 14.09 129.86 -18.6652 \
 *        --keep-z-min -13.1 public/models/la_night_full.ksplat ...
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, basename } from 'path';

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let worldZ = -13.1;
let deleteBelow = true;
let bandMin = null;
let bandMax = null;
let behindPose = null; // { x, z, yaw }
const files = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--world-z') worldZ = Number(argv[++i]);
  else if (a === '--delete-below') deleteBelow = true;
  else if (a === '--delete-above') deleteBelow = false;
  else if (a === '--keep-z-min') bandMin = Number(argv[++i]);
  else if (a === '--keep-z-max') bandMax = Number(argv[++i]);
  else if (a === '--behind-pose') {
    behindPose = { x: Number(argv[++i]), z: Number(argv[++i]), yaw: Number(argv[++i]) };
  } else files.push(a);
}

const POSE_MODE = behindPose !== null;
const BAND_MODE = bandMin !== null && bandMax !== null;
const valid = files.length > 0 &&
  (POSE_MODE || BAND_MODE ? true : true) &&
  !(bandMax !== null && bandMin === null);
if (!valid) {
  console.error('Usage:');
  console.error('  node scripts/filter-ksplat-plane.mjs [--world-z Z] [--delete-below|--delete-above] <file...>');
  console.error('  node scripts/filter-ksplat-plane.mjs --keep-z-min A --keep-z-max B <file...>');
  console.error('  node scripts/filter-ksplat-plane.mjs --behind-pose X Z YAW [--keep-z-min A] <file...>');
  process.exit(1);
}

const SPLAT_BASE = { x: -18.04, z: -14.73, y: -15.97 };
const SPLAT_SCALE = 20;
const SIN_YAW = POSE_MODE ? Math.sin(behindPose.yaw) : 0;
const COS_YAW = POSE_MODE ? Math.cos(behindPose.yaw) : 0;

const HEADER = 4096;
const SECTION_HEADER = 1024;
const SH_COMPONENTS = [0, 9, 24, 45];
const LEVEL1 = { bytesPerCenter: 6, bytesPerScale: 6, bytesPerRotation: 8, bytesPerColor: 4, shBytesPerComponent: 2 };

function processFile(path) {
  const buf = readFileSync(path);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u32 = (o) => dv.getUint32(o, true);
  const u16 = (o) => dv.getUint16(o, true);
  const f32 = (o) => dv.getFloat32(o, true);

  const maxSectionCount = u32(4);
  const compressionLevel = u16(20);
  if (compressionLevel !== 1) throw new Error(`${basename(path)}: only compressionLevel 1 supported (got ${compressionLevel})`);
  if (maxSectionCount !== 1) throw new Error(`${basename(path)}: expected 1 section (got ${maxSectionCount})`);

  const hb = HEADER;
  const splatCount = u32(hb + 4);
  const bucketSize = u32(hb + 8);
  const bucketCount = u32(hb + 12);
  const bucketBlockSize = f32(hb + 16);
  const compressionScaleRange = u32(hb + 24);
  const fullBucketCount = u32(hb + 32);
  const partiallyFilledBucketCount = u32(hb + 36);
  const shDegree = u16(hb + 40);

  const bytesPerSplat = LEVEL1.bytesPerCenter + LEVEL1.bytesPerScale + LEVEL1.bytesPerRotation + LEVEL1.bytesPerColor +
                        SH_COMPONENTS[shDegree] * LEVEL1.shBytesPerComponent;

  const metaSize = partiallyFilledBucketCount * 4;
  const bucketsBase = HEADER + SECTION_HEADER + metaSize;
  const dataBase = bucketsBase + bucketCount * 12;

  const partialLengths = new Uint32Array(buf.buffer, buf.byteOffset + HEADER + SECTION_HEADER, partiallyFilledBucketCount);
  const sf = (bucketBlockSize / 2) / compressionScaleRange;

  const bucketIndexFor = (local) => {
    const maxFull = fullBucketCount * bucketSize;
    if (local < maxFull) return Math.floor(local / bucketSize);
    let cursor = maxFull;
    let bi = fullBucketCount;
    let p = 0;
    while (cursor < splatCount && !(local >= cursor && local < cursor + partialLengths[p])) {
      cursor += partialLengths[p];
      bi++;
      p++;
    }
    return bi;
  };

  const xOf = (j) => {
    const o = dataBase + j * bytesPerSplat;
    const bb = bucketsBase + bucketIndexFor(j) * 12;
    return (u16(o) - compressionScaleRange) * sf + f32(bb);
  };
  const yOf = (j) => {
    const o = dataBase + j * bytesPerSplat;
    const bb = bucketsBase + bucketIndexFor(j) * 12;
    return (u16(o + 2) - compressionScaleRange) * sf + f32(bb + 4);
  };
  const zOf = (j) => {
    const o = dataBase + j * bytesPerSplat;
    const bb = bucketsBase + bucketIndexFor(j) * 12;
    return (u16(o + 4) - compressionScaleRange) * sf + f32(bb + 8);
  };
  const worldZOf = (dz) => SPLAT_BASE.z + SPLAT_SCALE * dz;
  const worldXOf = (dx) => SPLAT_BASE.x - SPLAT_SCALE * dx;

  console.log(`\n${basename(path)}: splats=${splatCount} bucketSize=${bucketSize} block=${bucketBlockSize} range=${compressionScaleRange} shDeg=${shDegree} bytes/splat=${bytesPerSplat}`);

  // ── classify ─────────────────────────────────────────────────────────────
  let cutDesc;
  if (POSE_MODE) {
    cutDesc = `delete behind view at (${behindPose.x}, ${behindPose.z}) yaw ${behindPose.yaw}` +
      (bandMin !== null ? `, and keep world-z >= ${bandMin}` : '');
  } else if (BAND_MODE) {
    cutDesc = `keep world-z [${bandMin}, ${bandMax}]`;
  } else {
    cutDesc = `world-z ${deleteBelow ? '<' : '>'} ${worldZ}`;
  }
  console.log(`  cut: ${cutDesc}`);

  const keep = new Uint8Array(splatCount);
  let kept = 0;
  let removed = 0;
  for (let j = 0; j < splatCount; j++) {
    const dz = zOf(j);
    const wz = worldZOf(dz);
    let keepIt;
    if (POSE_MODE) {
      const wx = worldXOf(xOf(j));
      const behind = (wx - behindPose.x) * SIN_YAW + (wz - behindPose.z) * COS_YAW;
      keepIt = (bandMin === null || wz >= bandMin) && behind <= 0;
    } else if (BAND_MODE) {
      keepIt = wz >= bandMin && wz <= bandMax;
    } else {
      keepIt = deleteBelow ? !(wz < worldZ) : (wz >= worldZ);
    }
    if (keepIt) {
      keep[j] = 1;
      kept++;
    } else {
      removed++;
    }
  }
  console.log(`  kept ${kept}, removed ${removed} (${((removed / splatCount) * 100).toFixed(1)}%)`);
  if (kept === 0) throw new Error('nothing left after filtering');

  // ── recompute bucket partitioning for kept splats ─────────────────────────
  const block = bucketBlockSize;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let j = 0; j < splatCount; j++) {
    if (!keep[j]) continue;
    const x = xOf(j), y = yOf(j), z = zOf(j);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const yBlocks = Math.ceil((maxY - minY) / block) || 1;
  const zBlocks = Math.ceil((maxZ - minZ) / block) || 1;
  const bucketCenterOf = (x, y, z) => {
    const xBlock = Math.floor((x - minX) / block);
    const yBlock = Math.floor((y - minY) / block);
    const zBlock = Math.floor((z - minZ) / block);
    return {
      id: xBlock * (yBlocks * zBlocks) + yBlock * zBlocks + zBlock,
      cx: xBlock * block + minX + block / 2,
      cy: yBlock * block + minY + block / 2,
      cz: zBlock * block + minZ + block / 2,
    };
  };

  const partialBuckets = new Map();
  const fullBuckets = [];
  for (let j = 0; j < splatCount; j++) {
    if (!keep[j]) continue;
    const c = bucketCenterOf(xOf(j), yOf(j), zOf(j));
    let b = partialBuckets.get(c.id);
    if (!b) {
      b = { cx: c.cx, cy: c.cy, cz: c.cz, idxs: [] };
      partialBuckets.set(c.id, b);
    }
    b.idxs.push(j);
    if (b.idxs.length >= bucketSize) {
      fullBuckets.push(b);
      partialBuckets.delete(c.id);
    }
  }
  const partialEntries = [...partialBuckets.entries()].sort((a, b) => a[0] - b[0]);
  const buckets = [...fullBuckets, ...partialEntries.map(([, b]) => b)];

  const outFullBucketCount = fullBuckets.length;
  const outPartialCount = partialEntries.length;
  const outBucketCount = buckets.length;
  const sectionDataSize = kept * bytesPerSplat;
  const bucketMetaSize = outPartialCount * 4;
  const bucketDataSize = bucketMetaSize + outBucketCount * 12;
  const storageSizeBytes = sectionDataSize + bucketDataSize;
  const outSize = HEADER + SECTION_HEADER + storageSizeBytes;

  const out = Buffer.alloc(outSize);
  const odv = new DataView(out.buffer, out.byteOffset, out.byteLength);

  // header
  odv.setUint8(0, buf[0]);
  odv.setUint8(1, buf[1]);
  odv.setUint32(4, 1, true);      // maxSectionCount
  odv.setUint32(8, 1, true);      // sectionCount
  odv.setUint32(12, kept, true);  // maxSplatCount
  odv.setUint32(16, kept, true);  // splatCount
  odv.setUint16(20, 1, true);     // compressionLevel
  odv.setFloat32(24, 0, true);
  odv.setFloat32(28, 0, true);
  odv.setFloat32(32, 0, true);
  odv.setFloat32(36, f32(36), true);
  odv.setFloat32(40, f32(40), true);

  // section header
  const shb = HEADER;
  odv.setUint32(shb + 0, kept, true);
  odv.setUint32(shb + 4, kept, true);
  odv.setUint32(shb + 8, bucketSize, true);
  odv.setUint32(shb + 12, outBucketCount, true);
  odv.setFloat32(shb + 16, bucketBlockSize, true);
  odv.setUint16(shb + 20, 12, true);
  odv.setUint32(shb + 24, compressionScaleRange, true);
  odv.setUint32(shb + 28, storageSizeBytes, true);
  odv.setUint32(shb + 32, outFullBucketCount, true);
  odv.setUint32(shb + 36, outPartialCount, true);
  odv.setUint16(shb + 40, shDegree, true);

  // bucket meta
  let metaOff = HEADER + SECTION_HEADER;
  for (const [, b] of partialEntries) {
    odv.setUint32(metaOff, b.idxs.length, true);
    metaOff += 4;
  }
  // bucket centers
  let bucketOff = HEADER + SECTION_HEADER + bucketMetaSize;
  for (const b of buckets) {
    odv.setFloat32(bucketOff, b.cx, true);
    odv.setFloat32(bucketOff + 4, b.cy, true);
    odv.setFloat32(bucketOff + 8, b.cz, true);
    bucketOff += 12;
  }

  // rows: re-quantize centers against their bucket center, copy rest verbatim
  const qScale = 1 / sf;
  let outRow = HEADER + SECTION_HEADER + bucketDataSize;
  let written = 0;
  for (const b of buckets) {
    for (const j of b.idxs) {
      const src = dataBase + j * bytesPerSplat;
      const qx = Math.round((xOf(j) - b.cx) * qScale + compressionScaleRange);
      const qy = Math.round((yOf(j) - b.cy) * qScale + compressionScaleRange);
      const qz = Math.round((zOf(j) - b.cz) * qScale + compressionScaleRange);
      odv.setUint16(outRow, Math.max(0, Math.min(65535, qx)), true);
      odv.setUint16(outRow + 2, Math.max(0, Math.min(65535, qy)), true);
      odv.setUint16(outRow + 4, Math.max(0, Math.min(65535, qz)), true);
      buf.copy(out, outRow + 6, src + 6, src + bytesPerSplat);
      outRow += bytesPerSplat;
      written++;
    }
  }
  if (written !== kept) throw new Error(`row count mismatch: ${written} != ${kept}`);

  writeFileSync(path, out);
  console.log(`  wrote ${(outSize / 1024 / 1024).toFixed(2)} MB (was ${(buf.length / 1024 / 1024).toFixed(2)} MB) -> ${path}`);
}

for (const f of files) {
  try {
    processFile(resolve(f));
  } catch (err) {
    console.error(`FAILED ${f}: ${err.message}`);
    process.exitCode = 1;
  }
}
