#!/usr/bin/env node

/**
 * prepare-deploy.mjs — finalize the standalone deployment produced by
 * `next build` (output: "standalone"), cross-platform (no cp -r).
 *
 * What it does:
 *   1. Copies .next/static → .next/standalone/.next/static
 *      (required — the standalone server doesn't include static chunks).
 *   2. Copies ONLY the public assets the app actually references into
 *      .next/standalone/public — the repo's public/ also holds ~1.1 GB of
 *      source .ply / .splat captures that must NOT be deployed.
 *
 * Run automatically by `npm run build`. Deploy .next/standalone alone.
 */

import { cp, mkdir, stat, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const standalone = join(root, '.next', 'standalone');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(standalone))) {
    console.error('✗ .next/standalone not found — run `next build` first.');
    process.exit(1);
  }

  // 1. Static chunks (required by the standalone server)
  await cp(join(root, '.next', 'static'), join(standalone, '.next', 'static'), {
    recursive: true,
  });
  console.log('✓ copied .next/static');

  // 2. Referenced public assets only.
  //    Keep in sync with src/config/assets.ts + WalkthroughScene.tsx +
  //    the Landing section imagery. If you add an asset, add it here.
  const ASSETS = [
    // 3D models & environment (see src/config/assets.ts, WalkthroughScene)
    'models/main-building.glb',
    'models/main-building.mobile.glb', // mobile tier (1.5GB memory cap) — see MainBuildingModel
    'models/apartments/ApartmentV2.fast.ksplat',
    'models/la_night_full.ksplat',
    'models/la_night_mobile.ksplat', // phone backdrop (alpha-weighted)
    'models/la_night_medium.ksplat', // phone backdrop (mid option)
    'models/la_night_decimated.ksplat', // phone backdrop (fast option)
    'hdri/citrus_orchard_puresky_4k.hdr',
    'sw.js', // service worker (on-device caching)
  ];

  // Marketing imagery — copy the whole folder (small files).
  const publicImages = join(root, 'public', 'images');
  const imagesExists = await exists(publicImages);

  let copied = 0;
  let missing = 0;
  for (const rel of ASSETS) {
    const src = join(root, 'public', rel);
    const dest = join(standalone, 'public', rel);
    if (!(await exists(src))) {
      console.warn(`! missing asset (skipped): public/${rel}`);
      missing++;
      continue;
    }
    await mkdir(dirname(dest), { recursive: true });
    await cp(src, dest);
    const size = (await stat(dest)).size;
    console.log(`✓ public/${rel} (${(size / 1024 / 1024).toFixed(1)} MB)`);
    copied++;
  }

  if (imagesExists) {
    await cp(publicImages, join(standalone, 'public', 'images'), {
      recursive: true,
    });
    console.log('✓ public/images/');
  }

  console.log(
    `\nDone. ${copied} asset(s) copied${missing ? `, ${missing} missing` : ''}.`
  );
  console.log('Deploy the .next/standalone folder:');
  console.log('  PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js');
}

main().catch((err) => {
  console.error('prepare-deploy failed:', err);
  process.exit(1);
});
