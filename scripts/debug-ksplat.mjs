import { resolve, basename } from 'path';
import { readFileSync } from 'fs';

const buf = readFileSync(resolve(process.argv[2] ?? 'public/models/la_night_decimated.ksplat'));
const u32 = (o) => buf.readUInt32LE(o);
const f32 = (o) => buf.readFloatLE(o);
const u16 = (o) => buf.readUInt16LE(o);

const HEADER = 4096;
const SECTION_HEADER = 1024;
const maxSectionCount = u32(4);
const compressionLevel = u16(20);
console.log('header:', { versionMajor: buf[0], versionMinor: buf[1], maxSectionCount, maxSplatCount: u32(12), splatCount: u32(16), compressionLevel,
  sceneCenter: [f32(24), f32(28), f32(32)] });

let sectionBase = HEADER + maxSectionCount * SECTION_HEADER;
const s0 = sectionBase;
const secMaxSplatCount = u32(s0 + 4);
const bucketSize = u32(s0 + 8);
const bucketCount = u32(s0 + 12);
const bucketBlockSize = f32(s0 + 16);
const bucketStorageSizeBytes = u16(s0 + 20);
const compressionScaleRange = u32(s0 + 24);
const fullBucketCount = u32(s0 + 32);
const partiallyFilledBucketCount = u32(s0 + 36);
const shDegree = u16(s0 + 40);
console.log('section 0:', { secMaxSplatCount, bucketSize, bucketCount, bucketBlockSize, bucketStorageSizeBytes, compressionScaleRange, fullBucketCount, partiallyFilledBucketCount, shDegree });

const bytesPerSplat = 6 + 6 + 8 + 4 + 0; // shDeg 0, level 1
const metaSize = partiallyFilledBucketCount * 4;
const metaBytes = buf.subarray(s0, s0 + metaSize);
const bucketsArr = new Float32Array(buf.buffer, buf.byteOffset + s0 + metaSize, bucketCount * 3);
const dataBase = s0 + bucketStorageSizeBytes * bucketCount + metaSize;
console.log('metaSize', metaSize, 'dataBase', dataBase, 'expected file size', HEADER + maxSectionCount * SECTION_HEADER + bucketStorageSizeBytes * bucketCount + metaSize + bytesPerSplat * secMaxSplatCount, 'actual', buf.length);

// partial lengths
const partialLengths = new Uint32Array(buf.buffer, buf.byteOffset + s0, partiallyFilledBucketCount);
console.log('first partial lens:', Array.from(partialLengths.slice(0, 10)));
console.log('first 5 buckets:', Array.from(bucketsArr.slice(0, 15)).map((v) => v.toFixed(2)).join(', '));

// sample raw splat rows
const centersU16 = new Uint16Array(buf.buffer, buf.byteOffset + dataBase, secMaxSplatCount * 3);
const scalesU16 = new Uint16Array(buf.buffer, buf.byteOffset + dataBase, secMaxSplatCount * 3 /* base only */);
for (let j of [0, 1, 255, 256, 300]) {
  const w = (j * bytesPerSplat) / 2;
  const bi = Math.floor(j / bucketSize);
  const bb = bi * 3;
  const q = [centersU16[w], centersU16[w + 1], centersU16[w + 2]];
  const sf = (bucketBlockSize / 2) / compressionScaleRange;
  const c = q.map((v) => (v - compressionScaleRange) * sf);
  console.log(`splat ${j} (bucket ${bi}): u16q=[${q}] rawBucket=[${bucketsArr[bb].toFixed(2)}, ${bucketsArr[bb + 1].toFixed(2)}, ${bucketsArr[bb + 2].toFixed(2)}]`,
    'center=', c.map((v) => (v + [bucketsArr[bb], bucketsArr[bb + 1], bucketsArr[bb + 2]][0] && 0) || v).join()); // rough
  console.log('   plus bucket:', (c[0] + bucketsArr[bb]).toFixed(2), (c[1] + bucketsArr[bb + 1]).toFixed(2), (c[2] + bucketsArr[bb + 2]).toFixed(2));
}
