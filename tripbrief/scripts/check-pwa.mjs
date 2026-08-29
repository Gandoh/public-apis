#!/usr/bin/env node
/**
 * Pre-flight check for the Google Play (TWA) path.
 * Run against a built dist/ folder, or against a live URL:
 *
 *   node scripts/check-pwa.mjs                    # checks ./dist
 *   node scripts/check-pwa.mjs https://your.site  # checks a deployed site
 */

import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const target = process.argv[2];
const remote = target && /^https?:\/\//.test(target);
const base = remote ? target.replace(/\/$/, '') : join(process.cwd(), 'dist');

let pass = 0;
let fail = 0;
let warn = 0;

const ok = (m, d = '') => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}${d ? ` \x1b[90m${d}\x1b[0m` : ''}`); };
const no = (m, d = '') => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}${d ? ` \x1b[90m${d}\x1b[0m` : ''}`); };
const wa = (m, d = '') => { warn++; console.log(`  \x1b[33m!\x1b[0m ${m}${d ? ` \x1b[90m${d}\x1b[0m` : ''}`); };

async function get(path) {
  if (remote) {
    const res = await fetch(base + path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { text: await res.text(), headers: res.headers };
  }
  const buf = await readFile(join(base, path));
  return { text: buf.toString('utf8'), headers: null };
}

async function exists(path) {
  try {
    if (remote) {
      const r = await fetch(base + path, { method: 'HEAD' });
      return r.ok;
    }
    await access(join(base, path));
    return true;
  } catch {
    return false;
  }
}

console.log(`\n\x1b[1mPWA / TWA readiness — ${remote ? base : 'dist/'}\x1b[0m\n`);

/* ---- 1. HTTPS ---- */
console.log('\x1b[1mTransport\x1b[0m');
if (remote) {
  base.startsWith('https://')
    ? ok('Served over HTTPS', 'required by TWA')
    : no('Not HTTPS', 'TWA refuses to load http:// origins');
} else {
  wa('Local build — HTTPS not verifiable', 'your host must serve over HTTPS');
}

/* ---- 2. Manifest ---- */
console.log('\n\x1b[1mWeb app manifest\x1b[0m');
let manifest = null;
try {
  const { text } = await get('/manifest.webmanifest');
  manifest = JSON.parse(text);
  ok('manifest.webmanifest present and valid JSON');
} catch (e) {
  no('manifest.webmanifest missing or invalid', e.message);
}

if (manifest) {
  manifest.name ? ok('name', manifest.name) : no('name missing');
  manifest.short_name
    ? (manifest.short_name.length <= 12
        ? ok('short_name', manifest.short_name)
        : wa('short_name longer than 12 chars', 'may be truncated on the launcher'))
    : no('short_name missing');
  manifest.start_url ? ok('start_url', manifest.start_url) : no('start_url missing');
  ['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)
    ? ok('display', manifest.display)
    : no('display must be standalone/fullscreen/minimal-ui', String(manifest.display));
  manifest.background_color ? ok('background_color', manifest.background_color) : wa('background_color missing');
  manifest.theme_color ? ok('theme_color', manifest.theme_color) : wa('theme_color missing');

  const icons = manifest.icons || [];
  const has512 = icons.some((i) => /512x512/.test(i.sizes || ''));
  const has192 = icons.some((i) => /192x192/.test(i.sizes || ''));
  const maskable = icons.some((i) => (i.purpose || '').includes('maskable'));
  has192 ? ok('192x192 icon declared') : no('192x192 icon missing');
  has512 ? ok('512x512 icon declared') : no('512x512 icon missing', 'required for Play listing');
  maskable ? ok('maskable icon declared') : wa('no maskable icon', 'Android will letterbox your icon');

  for (const i of icons) {
    const p = i.src.startsWith('http') ? null : i.src;
    if (p && !(await exists(p))) no(`icon file missing: ${p}`);
  }
}

/* ---- 3. Service worker ---- */
console.log('\n\x1b[1mService worker\x1b[0m');
if (await exists('/sw.js')) {
  ok('sw.js present');
  const { text } = await get('/sw.js');
  /addEventListener\(\s*['"]fetch['"]/.test(text)
    ? ok('registers a fetch handler', 'required for installability')
    : no('no fetch handler', 'PWA will not be installable');
  /addEventListener\(\s*['"]install['"]/.test(text) ? ok('has install handler') : wa('no install handler');
} else {
  no('sw.js missing', 'required for an installable PWA');
}

/* ---- 4. HTML wiring ---- */
console.log('\n\x1b[1mHTML\x1b[0m');
try {
  const { text: html } = await get('/index.html');
  /<link[^>]+rel=["']manifest["']/.test(html) ? ok('manifest linked from HTML') : no('no <link rel="manifest">');
  /<meta[^>]+name=["']theme-color["']/.test(html) ? ok('theme-color meta tag') : wa('no theme-color meta');
  /<meta[^>]+name=["']viewport["']/.test(html) ? ok('viewport meta tag') : no('no viewport meta');
  /<title>/.test(html) ? ok('has <title>') : no('no <title>');
  /name=["']description["']/.test(html) ? ok('has meta description') : wa('no meta description');
} catch (e) {
  no('index.html unreadable', e.message);
}

/* ---- 5. Play Store extras ---- */
console.log('\n\x1b[1mGoogle Play requirements\x1b[0m');
(await exists('/privacy.html')) || (await exists('/privacy'))
  ? ok('privacy policy page present', 'Play Console requires a public URL')
  : no('no privacy policy page', 'Play Console will block submission');
(await exists('/offline.html')) ? ok('offline fallback page') : wa('no offline page');

if (remote) {
  const has = await exists('/.well-known/assetlinks.json');
  if (has) {
    try {
      const { text } = await get('/.well-known/assetlinks.json');
      const j = JSON.parse(text);
      const fp = j?.[0]?.target?.sha256_cert_fingerprints;
      Array.isArray(fp) && fp.length
        ? ok('assetlinks.json present with fingerprint', `${fp.length} fingerprint(s)`)
        : no('assetlinks.json has no sha256_cert_fingerprints');
    } catch (e) {
      no('assetlinks.json invalid JSON', e.message);
    }
  } else {
    wa('no /.well-known/assetlinks.json yet', 'add it after Bubblewrap generates your key — the TWA shows a URL bar without it');
  }
} else {
  wa('assetlinks.json not checked', 'only verifiable on the deployed origin');
}

/* ---- 6. TWA manifest sanity ---- */
console.log('\n\x1b[1mtwa-manifest.json\x1b[0m');
try {
  const raw = await readFile(join(process.cwd(), 'twa-manifest.json'), 'utf8');
  const t = JSON.parse(raw);
  t.targetSdkVersion >= 36
    ? ok('targetSdkVersion', String(t.targetSdkVersion))
    : no(`targetSdkVersion ${t.targetSdkVersion}`, 'Play requires 36+ from 31 Aug 2026');
  /REPLACE_WITH_YOUR_DOMAIN/.test(raw)
    ? wa('host still a placeholder', 'set your real domain before building')
    : ok('host configured', t.host);
  t.packageId ? ok('packageId', t.packageId) : no('packageId missing');
} catch {
  wa('twa-manifest.json not found', 'Bubblewrap will create one on `bubblewrap init`');
}

/* ---- summary ---- */
console.log(`\n\x1b[1mSummary\x1b[0m  \x1b[32m${pass} passed\x1b[0m  \x1b[33m${warn} warnings\x1b[0m  \x1b[31m${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
