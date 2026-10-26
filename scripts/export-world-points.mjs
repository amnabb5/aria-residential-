#!/usr/bin/env node

/**
 * export-world-points.mjs — dump decoded splat centers+colors of a city
 * .ksplat into WALKTHROUGH WORLD coordinates for offline verification renders.
 *
 * Binary layout: repeated [f32 x, f32 y, f32 z, u8 r, u8 g, u8 b, u8 a]
 * world = (-18.04 - 20·dx, -15.97+splatY - 20·dy, -14.73 + 20·dz)
 *
 * Usage: node scripts/export-world-points.mjs <in.ksplat> <out.bin> [splatY] [alphaCut=30]
 */
import { readFileSync, writeFileSync } from 'fs';

const [inFile, outFile, splatYArg, alphaArg] = process.argv.slice(2);
if (!inFile || !outFile) throw new Error('usage: node scripts/export-world-points.mjs <in.ksplat> <out.bin> [splatY] [alphaCut]');
const splatY = Number(splatYArg ?? 1.5517);
const alphaCut = Number(alphaArg ?? 30);

const buf = readFileSync(inFile);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const u32 = (o) => dv.getUint32(o, true);
const u16 = (o) => dv.getUint16(o, true);
const f32 = (o) => dv.getFloat32(o, true);

const HEADER = 4096, SECTION_HEADER = 1024;
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
  let cursor = maxFull, bi = fullBucketCount, p = 0;
  while (cursor < splatCount && !(local >= cursor && local < cursor + partialLens[p])) {
    cursor += partialLens[p];
    bi++;
    p++;
  }
  return bi;
};

const T = { x: -18.04, y: -15.97 + splatY, z: -14.73 };
const out = Buffer.alloc(splatCount * 16);
let n = 0;
for (let j = 0; j < splatCount; j++) {
  const o = dataBase + j * bytesPerSplat;
  const colOff = o + 20;
  const a = buf[colOff + 3];
  if (a < alphaCut) continue;
  const bb = bucketsBase + bucketIdx(j) * 12;
  const dx = (u16(o) - range) * sf + f32(bb);
  const dy = (u16(o + 2) - range) * sf + f32(bb + 4);
  const dz = (u16(o + 4) - range) * sf + f32(bb + 8);
  const p = n * 16;
  out.writeFloatLE(T.x - 20 * dx, p);
  out.writeFloatLE(T.y - 20 * dy, p + 4);
  out.writeFloatLE(T.z + 20 * dz, p + 8);
  out[p + 12] = buf[colOff];
  out[p + 13] = buf[colOff + 1];
  out[p + 14] = buf[colOff + 2];
  out[p + 15] = a;
  n++;
}
writeFileSync(outFile, Buffer.concat([Buffer.alloc(8), out.subarray(0, n * 16)]));
const hdr = Buffer.alloc(8);
hdr.writeUInt32LE(n, 0);
hdr.writeUInt32LE(0, 4);
const full = Buffer.concat([hdr, out.subarray(0, n * 16)]);
writeFileSync(outFile, full);
console.log(`${inFile} → ${outFile}: ${n} points`);
