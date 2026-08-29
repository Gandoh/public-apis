# Shipping Trip Brief to the Google Play Store

Trip Brief is a web app. The supported way to put a web app on Play is a
**Trusted Web Activity (TWA)** — a thin Android wrapper that runs your real site
in Chrome's engine with no browser UI. It's Google's own documented path, the
resulting `.aab` is under ~1 MB, and you never maintain a second codebase:
you deploy the website, and the installed app updates itself.

> **Verify before you build:** `npm run build && npm run check`
> The checker validates the manifest, service worker, icons, privacy page and
> your `targetSdkVersion` against current Play requirements.

---

## ⚠️ Two deadlines that will fail your build today

| Thing | Requirement | Status here |
|:--|:--|:--|
| **Target API level** | New apps and updates must target **Android 16 (API 36)** from **31 August 2026** | ✅ `twa-manifest.json` pins `targetSdkVersion: 36` |
| **Bubblewrap default** | Bubblewrap's template still ships `targetSdkVersion 35`, which Play now rejects | ✅ pre-set to 36 — **do not let `bubblewrap init` overwrite it** |

Google's target-API policy is documented [here](https://support.google.com/googleplay/android-developer/answer/11926878).
After running `bubblewrap init`, re-check `twa-manifest.json` and
`app/build.gradle` and force both to 36 before `bubblewrap build`.

---

## The honest timeline

If your Play Console account is **personal** and was created after
**13 November 2023**, you cannot publish straight to production. You must first
run a **closed test with at least 12 testers opted in for 14 consecutive
days**, then apply for production access.

| Stage | Time |
|:--|:--|
| Deploy the site + build the `.aab` | an afternoon |
| Play Console signup, identity verification | 1–3 days ($25 one-off) |
| Closed test: 12 testers × 14 unbroken days | **14 days minimum** |
| Production access application review | up to ~7 days |
| **Realistic total for a first launch** | **≈ 3 weeks** |

Key details people get wrong:
- The 14 days must be **continuous and the most recent**. If your opted-in count
  drops below 12 on day 11, the clock effectively restarts. **Recruit 15–20** so
  normal attrition doesn't cost you a fortnight.
- "Opted in" means they accepted the invite **and installed** under the *same*
  Google account you listed. Invited-but-not-installed doesn't count.
- Since 2026 Google also checks testers **genuinely used** the app, not just
  installed it. Collect real feedback — you'll be asked about it.
- **Organization accounts are exempt** from the 12-tester rule, but need a
  D-U-N-S number (can take up to 30 days) and a registered legal entity.
- Internal/open testing tracks do **not** satisfy the gate. It must be **closed** testing.

Run the closed test in parallel with writing your store listing so the fortnight isn't dead time.

---

## Step 1 — Deploy the website over HTTPS

TWA refuses non-HTTPS origins. Any static host works; the build output is `dist/`.

```bash
npm run build

# Netlify
npx netlify-cli deploy --prod --dir=dist

# Vercel
npx vercel --prod

# Cloudflare Pages
npx wrangler pages deploy dist --project-name trip-brief

# GitHub Pages — see the caveat below
```

**Origin root is what matters, not a custom domain.** Digital Asset Links must be
served from the root of the origin with no redirect. A Netlify subdomain
(`your-app.netlify.app`) is a valid origin root, so it works without buying a
domain. What does *not* work is a project **subpath** like
`user.github.io/repo/` — see the caveat below.

> **GitHub Pages caveat:** project pages are served from a subpath
> (`/repo-name/`). If you use one, set Vite's `base` to `'/repo-name/'` and
> update `start_url` and `scope` in `manifest.webmanifest` to match, or the
> service worker scope and TWA will not line up. A custom domain or a
> user/org page avoids the whole problem.

Verify the deployment:

```bash
npm run check https://tripbrief.netlify.app
```

A `netlify.toml` is committed with the correct headers already: JSON content
type and no-redirect handling for `/.well-known/assetlinks.json`, a
non-cacheable service worker, `application/manifest+json` for the manifest, and
immutable caching for hashed assets.

---

## Step 2 — Confirm it's genuinely installable

On desktop Chrome, open the site → DevTools → **Application**:

- **Manifest** — no errors, icons resolve
- **Service Workers** — status "activated and is running"
- An **install icon** appears in the omnibox

Then run **Lighthouse → Installable**. Historically Google referenced a
performance score of 80+ for TWA quality; in practice apps have shipped below
that, but treat 80 as the target rather than the floor. Trip Brief ships ~178 KB
of JS (~58 KB gzipped), so it should score well.

---

## Step 3 — Generate the Android package with Bubblewrap

Requires **JDK 17+** and the **Android SDK** (Bubblewrap can install both for you).

```bash
npm install -g @bubblewrap/cli

# Point Bubblewrap at your deployed manifest
bubblewrap init --manifest https://your-domain.example/manifest.webmanifest
```

Answer the prompts. Then **re-open `twa-manifest.json` and confirm**:

```jsonc
{
  "packageId": "app.tripbrief.twa",   // must be globally unique, never changeable
  "host": "your-domain.example",
  "targetSdkVersion": 36,             // ← force this; Bubblewrap defaults to 35
  "compileSdkVersion": 36,
  "appVersionCode": 1,
  "appVersionName": "1.0.0"
}
```

A pre-filled `twa-manifest.json` is committed in this folder — replace
`REPLACE_WITH_YOUR_DOMAIN` and you can copy it straight over.

```bash
bubblewrap build
```

Outputs `app-release-bundle.aab` (upload this) and `app-release-signed.apk`
(sideload this to test locally).

### 🔑 Back up your keystore

`bubblewrap build` creates `android.keystore`. **If you lose it or its password,
you can never update this app again** — you'd have to publish under a new
package ID and lose all installs and reviews.

Back up `android.keystore` and its passwords to a password manager **now**.
It is already covered by `.gitignore` — never commit it.

> Prefer opting into **Play App Signing** (Play Console offers it on first
> upload). Google then holds the app signing key and your local keystore
> becomes only the *upload* key, which Google can reset if you lose it.

---

## Step 4 — Digital Asset Links (removes the URL bar)

This is the step that makes it feel like a native app instead of a browser tab.
Without it the TWA shows a Chrome address bar across the top.

```bash
npm run assetlinks -- <GOOGLE_SHA256> <YOUR_UPLOAD_SHA256>
```

That writes `public/.well-known/assetlinks.json`, validating the fingerprint
format and reading `package_name` from `twa-manifest.json` so the two cannot
drift. Rebuild and redeploy so it lands at:

```
https://your-domain.example/.well-known/assetlinks.json
```

In this project, put it at `public/.well-known/assetlinks.json` and rebuild —
Vite copies `public/` verbatim into `dist/`.

**Critical:** if you enable Play App Signing, the fingerprint that matters is
the one Google generates, not your local one. After your first upload go to
**Play Console → Test and release → Setup → App signing**, copy the
**SHA-256 certificate fingerprint**, and make sure it appears in your
`assetlinks.json`. Listing both your upload key and Google's signing key is
valid and the safest option:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.tripbrief.twa",
    "sha256_cert_fingerprints": [
      "AA:BB:...:your-upload-key",
      "11:22:...:googles-signing-key"
    ]
  }
}]
```

Verify with Google's own tool:

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://your-domain.example&relation=delegate_permission/common.handle_all_urls
```

Then confirm: `npm run check https://your-domain.example`

---

## Step 5 — Play Console listing

Create the app at [play.google.com/console](https://play.google.com/console) ($25 one-time).

**Assets you need** (the icon is already generated in `assets/`):

| Asset | Spec | Status |
|:--|:--|:--|
| App icon | 512×512 PNG, 32-bit, no alpha | ✅ `assets/play-icon-512.png` |
| Feature graphic | 1024×500 PNG/JPG | ⬜ you'll need to make this |
| Phone screenshots | 2–8, min 320px, 16:9 or 9:16 | ⬜ screenshot the running app |
| Short description | ≤ 80 chars | ✅ draft below |
| Full description | ≤ 4000 chars | ✅ draft below |
| Privacy policy URL | public, no login | ✅ `/privacy.html` |

### Draft short description (74 chars)

```
Compare two destinations: weather, money, holidays and landmarks side by side.
```

### Draft full description

```
Trip Brief answers the question every trip starts with: which of these two
places should I go to, and when?

Search any two cities and get a complete side-by-side brief.

WEATHER THAT MATCHES YOUR TRIP
Pick the month you're travelling and see what the weather is actually like
then — not just today's forecast. Each destination gets a comfort score
from historical climate data, plus average highs and lows, rainfall and
the number of wet days to expect.

MONEY
Live European Central Bank exchange rates from your home currency, a
90-day trend so you can see which way the rate is moving, and a built-in
converter.

HEAD TO HEAD
An at-a-glance verdict: which destination has better weather, which is
warmer, drier, has cleaner air, and which gives you less jet lag.

EVERYTHING ELSE YOU CHECK BEFORE BOOKING
- Seven-day forecast with rain probability, UV index, sunrise and sunset
- Air quality with PM2.5 and PM10 readings
- Public holidays, so you know what's closed while you're there
- Languages, dial code, driving side and plug-relevant country facts
- An encyclopedia briefing and nearby landmarks with photos
- Maps for both destinations

NO ACCOUNT, NO TRACKING
There's no sign-up, no advertising and no analytics. Trip Brief has no
backend of its own — it reads from free, open data services and keeps your
preferences on your device. Destinations you've already viewed stay
available offline.

Built on open data from Open-Meteo, OpenStreetMap, Wikipedia, the European
Central Bank and other free public APIs.
```

### Forms Play will make you complete

- **Data safety** — declare what you collect. Trip Brief collects nothing and
  has no backend, but it *does* send your IP to third-party APIs by virtue of
  making requests. Declare **"No data collected"** and be ready to explain the
  third-party calls; the `/privacy.html` page already documents them.
- **Content rating** — a questionnaire; this app rates "Everyone".
- **Ads** — declare **no ads**.
- **Target audience** — choose **13+**. Selecting under-13 pulls you into the
  Families programme, which adds requirements a web-content app can't easily
  guarantee.
- **App category** — Travel & Local.

---

## Step 6 — Closed test, then production

1. **Test and release → Testing → Closed testing → Create track.**
2. Upload `app-release-bundle.aab`.
3. Create an email list of **15–20** testers (aim above the 12 minimum).
4. Share the opt-in link. Each tester must open it, tap **Become a tester**, and
   install **under the same Google account you listed**.
5. Wait **14 unbroken days** with ≥12 opted in. Gather genuine feedback and ship
   a fix or two — you'll be asked what you learned.
6. **Apply for production access**, answer the ~10 questions honestly, then submit
   the production release.

---

## Policy risk: don't get caught by 4.3 (minimum functionality)

Google rejects apps that are just a webview mirroring a website. A TWA over a
real PWA is the compliant path, and Trip Brief clears the bar because it's an
installable PWA with a service worker, offline behaviour, an app-appropriate
UI and genuine utility. To stay comfortably clear:

- Keep the service worker and offline page working.
- Don't ship an app that's only a link to a page users could just visit.
- Make sure the app doesn't show browser chrome — i.e. **get asset links right**.

---

## What about the Apple App Store?

**You can't ship this as-is.** Apple's Guideline 4.2 rejects "repackaged
websites", and PWAs wrapped in a WebView are routinely refused. iOS options:

1. **Ship it as a PWA anyway** — iOS Safari supports *Add to Home Screen*. Free,
   works today, just not listed in the App Store.
2. **Wrap with Capacitor and add real native features** — camera, push,
   offline sync, widgets, share extensions. The native functionality has to be
   substantial and genuine, not cosmetic.
3. **Build a native client** against the same public APIs.

For a tool like this, option 1 is usually the sensible answer.

---

## Updating the app later

Because it's a TWA, **content updates need no Play release at all** — deploy the
website and every installed app picks it up immediately.

You only ship a new `.aab` when you change something in the Android shell
(icon, name, target SDK, permissions). When you do, bump both fields:

```jsonc
"appVersionCode": 2,        // must increase every upload
"appVersionName": "1.1.0"
```

```bash
bubblewrap update   # pulls in template/SDK changes
bubblewrap build
```

Re-run `npm run check` before every upload.
