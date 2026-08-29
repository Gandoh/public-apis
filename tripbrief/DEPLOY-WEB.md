# Publish the website (no Play Store account needed)

This gets Trip Brief live on the internet today. It costs nothing, needs no
developer account, and is a prerequisite for the Android app later — the TWA is
just a shell around this exact URL.

Two routes. **Netlify is the one to pick** unless you have a reason not to.

> 📱 **On a phone?** Skip the command line entirely — see
> [`DEPLOY-FROM-PHONE.md`](./DEPLOY-FROM-PHONE.md). You can connect GitHub or
> drag-and-drop a zip straight from the Netlify app.

---

## Which route?

|  | **Netlify** ⭐ | **GitHub Pages** |
|:--|:--|:--|
| Cost | Free | Free |
| Setup | One command | Flip one setting |
| URL | `tripbrief.netlify.app` | `gandoh.github.io/public-apis/` |
| Origin | **Root** | **Subpath** (this repo is a fork) |
| Installable PWA | ✅ | ✅ |
| **Can host the Android app later** | ✅ | ❌ |
| Custom headers | ✅ via `netlify.toml` | ❌ |

The deciding factor is that last row. Digital Asset Links — the file that
removes the URL bar from the Android app — **must be served from an origin root
with no redirect**. A project subpath cannot do that.

Both routes work perfectly as a *website*. Only Netlify also works as a
foundation for the *app*. Since you're heading to Play eventually, starting on
Netlify saves you a migration.

---

## Route A — Netlify (recommended, ~10 minutes)

- [ ] **1.** Create a free account at [netlify.com](https://netlify.com) — sign in with GitHub.

- [ ] **2.** Deploy:
      ```bash
      cd tripbrief
      npm install
      npm run build
      npx netlify-cli deploy --prod --dir=dist
      ```
      The first run opens a browser to authorise, then asks whether to link an
      existing site or create a new one — choose **create a new site**. It prints
      your live URL when it finishes.

- [ ] **3.** Give it a decent name: **Site configuration → Change site name**
      → e.g. `tripbrief` → your URL becomes `https://tripbrief.netlify.app`.

- [ ] **4.** Verify:
      ```bash
      npm run check https://your-site.netlify.app
      ```
      Expect everything green except `assetlinks.json`, which only matters for
      the Android app.

- [ ] **5.** Confirm the headers from `netlify.toml` landed:
      ```bash
      curl -sI https://your-site.netlify.app/manifest.webmanifest | grep -i content-type
      # expect: application/manifest+json
      ```

- [ ] **6.** Open it on your phone. Chrome should offer **Add to Home screen**.

### Continuous deploys (optional)

Instead of running the CLI each time: in Netlify choose
**Add new site → Import an existing project → GitHub**, pick this repo, and set
**Base directory** to `tripbrief`. The committed `netlify.toml` supplies the
build command and publish directory. Every push then redeploys automatically.

---

## Route B — GitHub Pages (zero CLI, ~5 minutes)

A ready-made workflow ships at `tripbrief/deploy/github-pages.yml`. It builds
with `BASE_PATH=/public-apis/` so every asset URL, the manifest scope and the
service-worker scope are rewritten for the subpath, then emits a `404.html`
fallback so shared `?a=…&b=…` links resolve, plus `.nojekyll`.

- [ ] **1.** Install the workflow (GitHub blocks app tokens from committing
      workflow files, so you run this yourself — it takes a few seconds):
      ```bash
      mkdir -p .github/workflows
      cp tripbrief/deploy/github-pages.yml .github/workflows/
      git add .github/workflows/github-pages.yml
      git commit -m "Add GitHub Pages deploy workflow"
      git push origin arena/01a04e2c-public-apis
      ```

- [ ] **2.** On GitHub: **Settings → Pages → Build and deployment**
      → set **Source** to **GitHub Actions**.
      (Enabling Pages needs repo-admin rights my token doesn't carry.)

- [ ] **3.** Trigger it: **Actions → Deploy Trip Brief → Run workflow** on the
      `arena/01a04e2c-public-apis` branch. Afterwards it runs automatically on
      any push touching `tripbrief/`.

- [ ] **4.** Wait ~2 minutes. The Actions log prints the live URL, typically
      `https://gandoh.github.io/public-apis/`.

- [ ] **5.** Verify:
      ```bash
      npm run check https://gandoh.github.io/public-apis
      ```

### Moving from Pages to Netlify later

Nothing to undo. Deploy to Netlify as in Route A — the root build is the
default (`npm run build` with no `BASE_PATH`). You can leave the Pages site up
or turn Pages off in Settings.

---

## How the dual-base build works

One codebase, two hosting shapes:

```bash
npm run build                          # base "/"            → Netlify, custom domains
BASE_PATH=/public-apis/ npm run build  # base "/public-apis/" → GitHub project pages
```

`vite.config.js` carries a small plugin that keeps everything consistent:

- `index.html` — `%BASE_URL%` tokens are substituted at build time
- `manifest.webmanifest` — `start_url`, `scope`, every icon `src` and each
  shortcut URL are rewritten in the emitted copy
- `sw.js` — derives its own base from `self.location.pathname` at runtime, so
  the same file is correct either way
- React — asset and privacy-policy links use `import.meta.env.BASE_URL`

Both variants were built and served locally, with every referenced asset
confirmed to return 200 under the subpath.

---

## After it's live

- **Share it.** Any comparison is a URL: pick two cities and copy the address bar.
- **Install it.** Add to Home screen on Android or iOS — it runs standalone and
  works offline for destinations already viewed.
- **Iterate freely.** Redeploy as often as you like; there's no review process.

When you're ready for the Play Store, `LAUNCH.md` picks up from here — your
deployed URL becomes step 3.2, and nothing about the website needs to change.
