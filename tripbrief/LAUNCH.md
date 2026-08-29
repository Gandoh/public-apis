# Trip Brief — Launch Checklist

Your step-by-step path from this repo to a live Play Store listing.
Tick each box as you go. **Total elapsed time: ~3 weeks**, but only about
half a day of that is actual work — the rest is Google's mandatory waiting.

`PUBLISHING.md` has the deep reference. This file is the running order.

---

## Decisions — already made for you

| Decision | Choice | Why |
|:--|:--|:--|
| **Host** | **Netlify** | Gives you a real subdomain (`your-app.netlify.app`), not a subpath. Digital Asset Links must live at a domain **root** with no redirects, so subpath hosts like GitHub Pages project sites break the TWA. Free tier, HTTPS included, `netlify.toml` already committed. |
| **Domain** | **Skip it for now** | `*.netlify.app` is a valid origin root, so Asset Links work without buying anything. Total launch cost: just Google's $25. Add a custom domain later if you want — redeploy and regenerate one file. |
| **Account type** | **Personal** | Organization skips the 12-tester rule but needs a D-U-N-S number (up to 30 days) and a registered legal entity. Not worth it unless you already have a company. |
| **Package ID** | `app.tripbrief.twa` | **Permanent — can never be changed after first publish.** Already set in `twa-manifest.json`. |

> **One thing to check yourself:** search Play for "Trip Brief" and make sure the
> name isn't taken by something prominent. If it is, change `name` in
> `public/manifest.webmanifest` and `twa-manifest.json` before Phase 3.

---

## Phase 1 — Deploy to Netlify ✅ DONE

> **Live at https://tripbrief.netlify.app** since 29 Aug 2026, deploying from
> `arena/01a04e2c-public-apis` on every push. Verified: manifest served as
> `application/manifest+json`, service worker registers with a fetch handler,
> all six icons resolve, SPA fallback works, privacy policy reachable.
> `twa-manifest.json` already carries this host — **skip to Phase 2.**

<details><summary>Original Phase 1 instructions (kept for reference)</summary>


The Android app is a thin shell around your live site, so the site goes first.

- [ ] **1.1** Create a free account at [netlify.com](https://netlify.com) (sign in with GitHub).
- [ ] **1.2** Deploy from your machine:
      ```bash
      cd tripbrief
      npm install
      npm run build
      npx netlify-cli deploy --prod --dir=dist
      ```
      First run opens a browser to authorise, then asks to link or create a site —
      choose **create a new site**. It prints your live URL when it finishes.

      <details>
      <summary>Prefer continuous deploys from GitHub?</summary>

      In Netlify: **Add new site → Import an existing project → GitHub →**
      pick this repo. Then set **Base directory** to `tripbrief`. The committed
      `netlify.toml` supplies the build command and publish directory. Every push
      to your branch then redeploys automatically.
      </details>

- [ ] **1.3** Rename the site to something memorable:
      **Site configuration → Change site name** → e.g. `tripbrief`
      → your URL becomes `https://tripbrief.netlify.app`.
- [ ] **1.4** **Write your final URL down.** Phases 3 and 5 both need it verbatim.
- [ ] **1.5** Validate the deployment:
      ```bash
      npm run check https://tripbrief.netlify.app
      ```
      Everything should pass except `assetlinks.json` — that arrives in Phase 5.
- [ ] **1.6** Confirm the critical headers landed (`netlify.toml` sets these):
      ```bash
      curl -sI https://tripbrief.netlify.app/manifest.webmanifest | grep -i content-type
      # expect: application/manifest+json
      curl -sI https://tripbrief.netlify.app/sw.js | grep -i cache-control
      # expect: max-age=0, must-revalidate
      ```
- [ ] **1.7** Open the site on your **phone** and actually use it. Search two
      cities, tap a month on the "Best time to visit" chart, star a trip.
      Chrome should offer **Add to Home screen**.
- [ ] **1.8** In desktop Chrome DevTools → **Application**, confirm:
      Manifest shows no errors, Service Worker is "activated and running",
      and an install icon appears in the address bar.

---

</details>

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
- [ ] **3.2** Edit `twa-manifest.json` — replace all five occurrences of
      `REPLACE_WITH_YOUR_DOMAIN` with your Netlify host, **hostname only, no
      `https://` and no trailing slash** (e.g. `tripbrief.netlify.app`).
- [ ] **3.3** Initialise:
      ```bash
      bubblewrap init --manifest https://tripbrief.netlify.app/manifest.webmanifest
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
- [ ] **4.5** Privacy policy URL → `https://tripbrief.netlify.app/privacy.html` ✅
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

This is the step that makes it feel native instead of a browser tab. Android
fetches this file over HTTPS and **will not follow redirects**, which is exactly
why we chose a root-domain host.

- [ ] **5.1** Upload the `.aab` to a **Closed testing** track first (Phase 6.1) and
      opt into **Play App Signing** when offered. Google then generates the
      fingerprint that actually matters.
- [ ] **5.2** Collect **both** fingerprints:
      - **Google's**: Play Console → **Test and release → Setup → App signing**
        → *SHA-256 certificate fingerprint*
      - **Yours**: `bubblewrap fingerprint list`
- [ ] **5.3** Generate the file (validates format, reads your package id automatically):
      ```bash
      npm run assetlinks -- <GOOGLE_SHA256> <YOUR_UPLOAD_SHA256>
      ```
      Writes `public/.well-known/assetlinks.json` with both fingerprints — the
      safest setup, since sideloaded and Play-distributed builds will both verify.
- [ ] **5.4** Rebuild and redeploy:
      ```bash
      npm run build && npx netlify-cli deploy --prod --dir=dist
      ```
- [ ] **5.5** Confirm it is served directly, as JSON, with **no redirect**:
      ```bash
      curl -sI https://tripbrief.netlify.app/.well-known/assetlinks.json
      # expect: HTTP/2 200  and  content-type: application/json
      ```
      A `301`/`302` here means the TWA will fail — `netlify.toml` is configured
      to prevent that.
- [ ] **5.6** Verify with Google's own validator:
      ```
      https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://tripbrief.netlify.app&relation=delegate_permission/common.handle_all_urls
      ```
      You want `"maxAge"` and your statement echoed back, with no error.
- [ ] **5.7** Reinstall the app on your phone — **the URL bar should now be gone.**
      If it persists, wait a few minutes (Google caches this) and reinstall.

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
