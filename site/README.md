# API Scout

API Scout is a zero-dependency, static discovery experience built on top of the repository's `README.md` catalog. It turns the list into a searchable product with shortlists, filters, a recommendation flow, and a clearly labeled partner slot.

## Run it locally

From the repository root:

```bash
python3 scripts/build_catalog.py
python3 -m http.server 8000 --directory site
```

Then open <http://localhost:8000>.

The app loads `data/apis.json` in the browser, so it needs a local web server rather than a `file://` URL.

## Turn the revenue hook on

The provider section is deliberately honest: it does not fake a lead form. To make it production-ready:

1. Replace the blank `partnerEmail` in `app.js` with an inbox you control.
2. Replace the placeholder pitch details in `sponsorPitch()` with your audience, placement, and rate.
3. Add tracked partner URLs only when you have an approved affiliate or sponsorship agreement.
4. Keep sponsored placements clearly labeled and retain the repository's MIT license and attribution.
5. Deploy the `site/` directory to GitHub Pages, Netlify, Cloudflare Pages, or any static host.

A good first offer is a small, clearly labeled featured placement for an API provider. The catalog already has high-intent context: category, authentication, HTTPS, CORS, and a direct provider link.

## Refresh the catalog

`README.md` is the source of truth. After it changes, regenerate the browser data:

```bash
python3 scripts/build_catalog.py
```

No build tool or npm install is required.
