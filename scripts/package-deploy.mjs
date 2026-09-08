#!/usr/bin/env node

/**
 * package-deploy.mjs — package the standalone build into a hostable archive.
 *
 * Run AFTER `next build` (npm run dist does both). Produces:
 *   dist/aria-residences-deploy.zip   (Windows: PowerShell Compress-Archive)
 *   dist/aria-residences-deploy.tar.gz (fallback on unix without zip)
 *
 * The archive contains the complete app: server.js, minimal node_modules,
 * static chunks, and all referenced 3D assets — plus a DEPLOY.md with run
 * instructions. Extract on any server with Node 18+ and run `node server.js`.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const standalone = join(root, '.next', 'standalone');
const distDir = join(root, 'dist');

const DEPLOY_MD = `# Aria Residences — deployment

## Requirements
- Node.js 18+ (nothing else — dependencies are bundled)

## Run
\`\`\`bash
PORT=3000 HOSTNAME=0.0.0.0 node server.js
\`\`\`
The app listens on the given port (default 3000) on all interfaces.

## Reverse proxy (recommended)
Put Caddy/Nginx in front for HTTPS + your domain. Caddy example:

\`\`\`caddyfile
example.com {
    reverse_proxy 127.0.0.1:3000
}
\`\`\`

Keep the app's own COOP/COEP response headers (they enable the fast
SharedArrayBuffer splat sorting). HTTPS is required for the phone
motion-sensor controls (deviceorientation).

## Caching
/models/* and /hdri/* are served with
\`Cache-Control: public, max-age=31536000, immutable\` — visitors download
them once. If you replace a model, ship it under a new filename.

## Process management (optional)
\`\`\`bash
# run under a supervisor, e.g. pm2:
pm2 start server.js --name aria
\`\`\`
`;

function fmtSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  if (!existsSync(standalone) || !existsSync(join(standalone, 'server.js'))) {
    console.error('✗ .next/standalone/server.js not found — run `npm run build` first.');
    process.exit(1);
  }

  // Ship instructions inside the package itself.
  await writeFile(join(standalone, 'DEPLOY.md'), DEPLOY_MD);
  console.log('✓ wrote DEPLOY.md into the package');

  mkdirSync(distDir, { recursive: true });

  const zipPath = join(distDir, 'aria-residences-deploy.zip');
  const tarPath = join(distDir, 'aria-residences-deploy.tar.gz');
  rmSync(zipPath, { force: true });
  rmSync(tarPath, { force: true });

  let outPath = null;
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${standalone.replace(/\\/g, '\\\\')}\\*' -DestinationPath '${zipPath.replace(/\\/g, '\\\\')}' -Force"`,
      { stdio: 'inherit' }
    );
    outPath = zipPath;
  } else {
    try {
      execSync(`command -v zip`, { stdio: 'ignore' });
      execSync(`cd "$(dirname "${standalone}")" && zip -qr "${zipPath}" standalone`, { stdio: 'inherit' });
      outPath = zipPath;
    } catch {
      execSync(`tar -czf "${tarPath}" -C "$(dirname "${standalone}")" standalone`, { stdio: 'inherit' });
      outPath = tarPath;
    }
  }

  const size = statSync(outPath).size;
  console.log(`\n✓ Package ready: ${outPath} (${fmtSize(size)})`);
  console.log('  Upload → extract → `PORT=3000 HOSTNAME=0.0.0.0 node server.js`');
  console.log('  (see DEPLOY.md inside the archive for proxy/caching notes)');
}

main().catch((err) => {
  console.error('package-deploy failed:', err);
  process.exit(1);
});
