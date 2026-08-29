import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * BASE_PATH lets one codebase deploy to either kind of host:
 *
 *   root origin   (Netlify, Vercel, Cloudflare, custom domain)
 *     npm run build                       -> base "/"
 *
 *   project subpath (GitHub Pages on a fork: user.github.io/public-apis/)
 *     BASE_PATH=/public-apis/ npm run build
 *
 * Everything that hardcodes a path — the web manifest, the service worker
 * scope, the icon URLs — is rewritten to match, otherwise the PWA silently
 * breaks on a subpath.
 */
const BASE = process.env.BASE_PATH || '/';

/** Rewrites root-relative paths in the manifest + index.html to honour BASE. */
function basePathPlugin(base) {
  const withBase = (p) => (p.startsWith('/') ? base.replace(/\/$/, '') + p : p);

  return {
    name: 'trip-brief-base-path',

    // index.html: swap %BASE_URL% tokens
    transformIndexHtml(html) {
      return html.replaceAll('%BASE_URL%', base);
    },

    // public/manifest.webmanifest is copied verbatim by Vite, so patch the
    // emitted copy rather than the source.
    async generateBundle() {
      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      try {
        const raw = await readFile(join(process.cwd(), 'public', 'manifest.webmanifest'), 'utf8');
        const m = JSON.parse(raw);

        m.start_url = withBase(m.start_url || '/');
        m.scope = withBase(m.scope || '/');
        if (Array.isArray(m.icons)) m.icons = m.icons.map((i) => ({ ...i, src: withBase(i.src) }));
        if (Array.isArray(m.shortcuts)) m.shortcuts = m.shortcuts.map((s) => ({ ...s, url: withBase(s.url) }));

        this.emitFile({
          type: 'asset',
          fileName: 'manifest.webmanifest',
          source: JSON.stringify(m, null, 2) + '\n',
        });
      } catch (e) {
        this.warn(`Could not rewrite manifest for base "${base}": ${e.message}`);
      }
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), basePathPlugin(BASE)],
  build: {
    // Vite would otherwise refuse to overwrite the copied public/ manifest.
    copyPublicDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // The sandbox preview is served from https://{port}-{sandbox}.e2b.app
    allowedHosts: true,
    cors: true,
    hmr: { clientPort: 443, protocol: 'wss' },
  },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true },
});
