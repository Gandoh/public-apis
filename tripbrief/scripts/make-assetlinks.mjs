#!/usr/bin/env node
/**
 * Generate public/.well-known/assetlinks.json from your signing fingerprints.
 *
 *   node scripts/make-assetlinks.mjs <SHA256_1> [SHA256_2 ...]
 *
 * Pass BOTH fingerprints when you use Play App Signing:
 *   1. your local upload key   — `bubblewrap fingerprint list`
 *   2. Google's app signing key — Play Console > Test and release > Setup >
 *                                 App signing > SHA-256 certificate fingerprint
 *
 * Listing both is valid and is the safest configuration: builds you sideload
 * and builds Play distributes will both verify.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2).filter(Boolean);

if (!args.length) {
  console.error(`
Usage: node scripts/make-assetlinks.mjs <SHA256_FINGERPRINT> [MORE...]

Get your fingerprints from:
  • local upload key : bubblewrap fingerprint list
  • Play signing key : Play Console > Test and release > Setup > App signing

Example:
  node scripts/make-assetlinks.mjs \\
    AA:BB:CC:...:11 \\
    22:33:44:...:99
`);
  process.exit(1);
}

const NORM = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/;
const fingerprints = [];

for (const raw of args) {
  const fp = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!NORM.test(fp)) {
    console.error(`\n✗ Not a valid SHA-256 fingerprint:\n    ${raw}`);
    console.error('  Expected 32 hex byte pairs separated by colons, e.g. AA:BB:CC:...\n');
    process.exit(1);
  }
  if (!fingerprints.includes(fp)) fingerprints.push(fp);
}

// Read the package id straight from twa-manifest.json so the two can't drift.
let packageName = 'app.tripbrief.twa';
try {
  const twa = JSON.parse(await readFile(join(process.cwd(), 'twa-manifest.json'), 'utf8'));
  if (twa.packageId) packageName = twa.packageId;
} catch {
  console.warn('! twa-manifest.json not readable — defaulting package to', packageName);
}

const doc = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageName,
      sha256_cert_fingerprints: fingerprints,
    },
  },
];

const out = join(process.cwd(), 'public', '.well-known', 'assetlinks.json');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(doc, null, 2) + '\n');

console.log(`\n✓ Wrote ${out}`);
console.log(`  package_name : ${packageName}`);
console.log(`  fingerprints : ${fingerprints.length}`);
fingerprints.forEach((f) => console.log(`                 ${f.slice(0, 17)}…`));
console.log(`
Next:
  1. npm run build && redeploy
  2. Confirm it is live and unredirected:
       curl -sI https://YOUR-SITE/.well-known/assetlinks.json
  3. Verify with Google:
       https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://YOUR-SITE&relation=delegate_permission/common.handle_all_urls
  4. Reinstall the app — the URL bar should be gone.
`);
