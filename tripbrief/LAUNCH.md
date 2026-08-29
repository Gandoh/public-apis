# Trip Brief — Launch Checklist

Your step-by-step path from this repo to a live Play Store listing.
Tick each box as you go. **Total elapsed time: ~3 weeks**, but only about
half a day of that is actual work — the rest is Google's mandatory waiting.

`PUBLISHING.md` has the deep reference. This file is the running order.

---

## Before you start — decisions only you can make

| Decision | Why it matters | Recommendation |
|:--|:--|:--|
| **Account type** | Personal accounts need 12 testers for 14 days. Organization accounts skip that entirely but need a D-U-N-S number (up to 30 days) and a real legal entity. | **Personal**, unless you already have a registered business |
| **Domain** | Asset Links verification is per-origin. A custom domain is cleaner and portable. | Buy one (~$10/yr), e.g. `tripbrief.app` |
| **Package ID** | **Permanent.** Can never be changed after first publish. | `app.tripbrief.twa` (pre-set) — change only if you own a different domain |
| **App name** | Must be unique-ish on Play. | Check it's not taken before you commit |

---

## Phase 1 — Deploy the website (≈30 min)

The Android app is a thin shell around your live site, so the site goes first.

- [ ] **1.1** Pick a host. Netlify and Cloudflare Pages both have free tiers with HTTPS.
- [ ] **1.2** Build and deploy:
      ```bash
      cd tripbrief
      npm install
      npm run build
      npx netlify-cli deploy --prod --dir=dist
      ```
- [ ] **1.3** Point your custom domain at it (your host's dashboard → Domains).
- [ ] **1.4** Confirm HTTPS works and the padlock is green.
- [ ] **1.5** Validate the live site:
      ```bash
      npm run check https://your-domain.example
      ```
      Everything must pass except `assetlinks.json` — that comes in Phase 3.
- [ ] **1.6** Open the site on your **phone**, use it for a few minutes.
      Search two cities, change the month, save a trip. Fix anything that feels off.
- [ ] **1.7** In desktop Chrome DevTools → Application, confirm:
      Manifest has no errors, Service Worker is "activated and running",
      and an install icon appears in the address bar.

> ⚠️ **If you use GitHub Pages on a project subpath** (`user.github.io/repo/`),
> set `base: '/repo/'` in `vite.config.js` and update `start_url` and `scope`
> in `manifest.webmanifest` to match — otherwise the service worker scope and
> the TWA will not line up. A custom domain avoids this entirely.

---

## Phase 2 — Play Console account (≈1 hour + 1–3 days waiting)

- [ ] **2.1** Sign up at [play.google.com/console](https://play.google.com/console) — **$25 one-time**.
- [ ] **2.2** Choose **Personal** or **Organization** (see the table above).
- [ ] **2.3** Complete identity verification. Have a government ID ready.
- [ ] **2.4** ⏳ **Wait for approval** — usually 1–3 days. Continue to Phase 3 meanwhile.

---

## Phase 3 — Build the Android app (≈45 min)

Needs **JDK 17+** and the Android SDK. Bubblewrap will offer to install both.

- [ ] **3.1** Install Bubblewrap:
      ```bash
      npm install -g @bubblewrap/cli
      ```
- [ ] **3.2** Edit `twa-manifest.json` — replace all three occurrences of
      `REPLACE_WITH_YOUR_DOMAIN` with your real domain.
- [ ] **3.3** Initialise:
      ```bash
      bubblewrap init --manifest https://your-domain.example/manifest.webmanifest
      ```
- [ ] **3.4** 🔴 **Re-open `twa-manifest.json` and confirm `targetSdkVersion` is still `36`.**
      Bubblewrap's template defaults to 35, and **Play rejects anything below 36
      as of 31 August 2026**. Also check `app/build.gradle` after the build.
- [ ] **3.5** Build:
      ```bash
      bubblewrap build
      ```
      Produces `app-release-bundle.aab` (upload) and `app-release-signed.apk` (test).
- [ ] **3.6** 🔑 **Back up `android.keystore` and its passwords to a password manager right now.**
      Lose it and you can **never update this app again** — you'd need a new
      package ID and would forfeit every install and review. It's gitignored; keep it safe elsewhere.
- [ ] **3.7** Sideload the APK onto a real Android phone and test it:
      ```bash
      adb install app-release-signed.apk
      ```
      Expect a URL bar at the top for now — Phase 5 removes it.

---

## Phase 4 — Store listing (≈1–2 hours)

In Play Console: **Create app** → fill in **Main store listing**.

Ready-made assets in `assets/`:

- [ ] **4.1** App icon → `assets/play-icon-512.png` (512×512, no alpha) ✅
- [ ] **4.2** Feature graphic → `assets/play-feature-graphic-1024x500.png` (1024×500) ✅
- [ ] **4.3** Short description (80 char limit) — copy from `PUBLISHING.md` ✅
- [ ] **4.4** Full description — copy from `PUBLISHING.md` ✅
- [ ] **4.5** Privacy policy URL → `https://your-domain.example/privacy.html` ✅
- [ ] **4.6** **Screenshots — you must make these.** 2–8 phone shots required.
      Easiest route: open the site on your phone, compare two interesting cities,
      and capture:
      1. The comparison view with both columns visible
      2. The "Best time to visit" chart
      3. The weather + forecast card
      4. The packing list
      5. The money card with the sparkline

      Take them in **portrait**, minimum 320px on the short side.

Then the compliance forms:

- [ ] **4.7** **Data safety** → declare **"No data collected"**. Trip Brief has no
      backend and no analytics. Be ready to note that third-party APIs receive
      your IP by virtue of the request — `/privacy.html` already documents this.
- [ ] **4.8** **Content rating** questionnaire → rates "Everyone".
- [ ] **4.9** **Ads** → declare **no ads**.
- [ ] **4.10** **Target audience** → choose **13+**. Selecting under-13 triggers
      the Families programme, which adds requirements web content can't guarantee.
- [ ] **4.11** **Category** → Travel & Local.

---

## Phase 5 — Digital Asset Links (≈20 min) — removes the URL bar

This is the step that makes it feel native instead of a browser tab.

- [ ] **5.1** Upload the `.aab` to a **Closed testing** track first (Phase 6.1),
      because Play App Signing generates the fingerprint that actually matters.
- [ ] **5.2** In Play Console → **Test and release → Setup → App signing**,
      copy the **SHA-256 certificate fingerprint**.
- [ ] **5.3** Generate the file:
      ```bash
      bubblewrap fingerprint generate-asset-links
      ```
- [ ] **5.4** Edit it to include **both** fingerprints (your upload key *and*
      Google's signing key). Listing both is valid and safest:
      ```json
      [{
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
          "namespace": "android_app",
          "package_name": "app.tripbrief.twa",
          "sha256_cert_fingerprints": ["AA:BB:...upload", "11:22:...google"]
        }
      }]
      ```
- [ ] **5.5** Save it to `public/.well-known/assetlinks.json`, then rebuild and
      redeploy (Vite copies `public/` verbatim into `dist/`).
- [ ] **5.6** Verify:
      ```bash
      npm run check https://your-domain.example
      ```
      and cross-check with Google's own validator:
      `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://your-domain.example&relation=delegate_permission/common.handle_all_urls`
- [ ] **5.7** Reinstall the APK — **the URL bar should now be gone.**

---

## Phase 6 — Closed testing (14 days — the long pole)

Skip to Phase 7 if you have an **Organization** account.

- [ ] **6.1** **Test and release → Testing → Closed testing → Create track.**
- [ ] **6.2** Upload `app-release-bundle.aab`.
- [ ] **6.3** Create an email list of **15–20 testers** (the minimum is 12 — recruit
      extra so one dropout doesn't reset your two weeks).
- [ ] **6.4** Share the opt-in link. Each tester must:
      open it → tap **Become a tester** → install **under that same Google account**.
      A mismatch between the email you listed and the account they use is the
      single most common failure.
- [ ] **6.5** ⏳ **Wait 14 unbroken days** with ≥12 opted in. If the count drops
      below 12 at any point, the clock effectively restarts.
- [ ] **6.6** Google now checks testers **genuinely used** the app, not just
      installed it. Ask for real feedback and ship a fix or two — you'll be asked
      what you learned and what you changed.
- [ ] **6.7** Use the fortnight productively: polish screenshots, refine the
      description, fix bugs testers report.

---

## Phase 7 — Production (≈1 week review)

- [ ] **7.1** **Apply for production access** from the Play Console dashboard.
- [ ] **7.2** Answer the ~10 questions honestly — they ask about your testing
      process, the feedback you gathered, and what you changed as a result.
- [ ] **7.3** ⏳ Wait for approval (Google says ~7 days or less).
- [ ] **7.4** Create a **Production** release, upload the `.aab`, roll out.
- [ ] **7.5** ⏳ Final review, then **you're live.** 🎉

---

## After launch

**Content changes need no Play release at all.** Deploy the website and every
installed app picks it up immediately — that's the core advantage of the TWA approach.

You only ship a new `.aab` when the Android shell itself changes (icon, name,
target SDK, permissions):

```bash
# bump BOTH fields in twa-manifest.json first
#   "appVersionCode": 2      <- must increase every single upload
#   "appVersionName": "1.1.0"
bubblewrap update
bubblewrap build
npm run check          # always re-verify before uploading
```

Set a calendar reminder for **mid-2027** — Google raises the required target API
level every year, and you'll need `bubblewrap update` plus a new build to stay
publishable.

---

## Common rejection reasons, and why you're already clear

| Reason | Status |
|:--|:--|
| Policy 4.3 — "repackaged website" with no added value | ✅ Real PWA: installable, service worker, offline support, app-grade UI |
| No privacy policy | ✅ `/privacy.html` ships with the build |
| Target API below 36 | ✅ Pinned to 36, and `npm run check` fails loudly if it regresses |
| Broken Digital Asset Links (URL bar visible) | ⬜ Phase 5 — verify before submitting |
| Data safety form contradicts actual behaviour | ✅ App genuinely collects nothing; policy documents the third-party calls |
| Missing or low-quality store assets | ✅ Icon + feature graphic generated; screenshots are your one task |
