#!/usr/bin/env node

/**
 * convert-ksplat.mjs — convert .splat → .ksplat (GaussianSplats3D pre-packaged format).
 *
 * Why: per the gaussian-splats-3d README, .ksplat files carry cache-optimized
 * splat ordering + optional compression, so they load faster and with less
 * client-side processing than raw .splat/.ply. No splats are removed.
 *
 * Usage:
 *   node scripts/convert-ksplat.mjs <input.splat> [output.ksplat]
 *
 * If no output is given, it writes next to the input with .ksplat extension.
 *
 * Implementation note: the library's loader API (SplatLoader.loadFromURL)
 * fetches over HTTP, so for local files we spin up a temporary localhost
 * server, convert, then shut it down.
 */

import { fileURLToPath } from 'url';
import { dirname, join, resolve, basename, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { createServer } from 'http';
import { readFile, writeFile, stat } from 'fs/promises';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/convert-ksplat.mjs <input.splat> [output.ksplat]');
  process.exit(1);
}

const inputPath = resolve(args[0]);
const outputPath = args[1] ? resolve(args[1]) : inputPath.replace(/\.splat$/i, '.ksplat');

if (!existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const outDir = dirname(outputPath);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// gaussian-splats-3d expects a browser-ish global environment (it calls
// window.setTimeout internally). Polyfill before importing it.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

// gaussian-splats-3d is an ESM module — dynamic import
const { SplatLoader } = await import('@mkkellogg/gaussian-splats-3d');

// Serve the input file on an ephemeral localhost port.
const fileData = await readFile(inputPath);
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', fileData.length);
  res.end(fileData);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/${basename(inputPath)}`;

// Compression: 0 = none, 1 = lossless-ish (half floats), 2 = lossy.
// Level 1 keeps full visual fidelity while shrinking the file.
const COMPRESSION_LEVEL = 1;

console.log(`Converting: ${inputPath}`);
console.log(`Output:     ${outputPath}`);

try {
  const splatBuffer = await SplatLoader.loadFromURL(
    url,
    () => { /* progress callback fires per-section; totals >100% in Node */ },
    /* progressiveLoadToSplatBuffer */ false,
    /* onProgressiveLoadSectionProgress */ undefined,
    /* minimumAlpha (keep all splats) */ 1,
    /* compressionLevel */ COMPRESSION_LEVEL,
    /* optimizeSplatData → cache-optimized ordering */ true
  );
  process.stdout.write('\rProcessing: 100.0%\n');

  // A SplatBuffer's backing bytes ARE the .ksplat file format.
  await writeFile(outputPath, Buffer.from(splatBuffer.bufferData));

  const inputSize = (await stat(inputPath)).size;
  const outputSize = splatBuffer.bufferData.byteLength;
  console.log(`Done! ${inputPath} → ${outputPath}`);
  console.log(`  Input:  ${(inputSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Output: ${(outputSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Splat count: preserved (no decimation)`);
} catch (err) {
  console.error('\nConversion failed:', err.message);
  process.exitCode = 1;
} finally {
  server.close();
  // The library leaves background workers/timers alive; exit explicitly to
  // avoid a libuv assertion when Node tears down the event loop.
  process.exit(process.exitCode ?? 0);
}
