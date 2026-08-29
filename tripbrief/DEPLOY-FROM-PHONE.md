# Deploying from your phone

You're already signed in to Netlify and looking at the **"Drag and drop your
project folder here"** box. That box is all you need — no terminal required.

There are two ways to finish. **Route A is the better one** because it also
gives you automatic redeploys forever.

---

## Route A — Connect GitHub (recommended, ~3 minutes, all in the browser)

Everything is already pushed to GitHub, so Netlify can build it for you.
No file uploads, and every future change redeploys itself.

1. Tap **Add new project** (the teal button, top right).
2. Choose **Import an existing project**.
3. Pick **GitHub**, and authorise Netlify if it asks.
4. Search for and select **`Gandoh/public-apis`**.
5. On the settings screen, set these three fields:

   | Field | Value |
   |:--|:--|
   | **Branch to deploy** | `arena/01a04e2c-public-apis` |
   | **Base directory** | `tripbrief` |
   | **Publish directory** | `tripbrief/dist` |

   Build command should auto-fill as `npm run build`. If it's blank, type it in.

   > ⚠️ **Branch matters.** Netlify defaults to `master`, which does *not*
   > contain the app. You must change it to `arena/01a04e2c-public-apis`.

6. Tap **Deploy**. First build takes ~2 minutes.
7. When it finishes, open **Site configuration → Change site name** and set
   something clean like `tripbrief` → `https://tripbrief.netlify.app`.

**Send me the URL and I'll verify it end to end.**

---

## Route B — Drag and drop the zip (if Route A gives you trouble)

I've prepared a ready-to-upload bundle. It has the correct structure
(`index.html` at the top level, not nested in a folder) and includes `_headers`
and `_redirects` so the PWA headers apply even on a manual upload.

1. Get **`tripbrief-site.zip`** onto your phone — download it from this
   workspace's file list.
2. In Netlify, tap **browse files to upload** inside the drag-and-drop box.
3. Select the zip. Netlify unpacks and publishes it in about 30 seconds.
4. Rename the site under **Site configuration → Change site name**.

**Downside:** manual uploads don't auto-update. Every change means building a
new zip and re-uploading. Route A avoids that entirely — which is why I'd
switch to it when convenient.

To regenerate the zip later:

```bash
cd tripbrief
npm run zip
```

---

## What about those two existing sites?

Your dashboard already lists `silver-syrniki-9350f3` and
`thriving-truffle-e69d0d`. **Leave them alone** — creating a new project won't
touch them. Netlify's free tier allows plenty of sites.

---

## After it's live

1. **Open the URL on your phone.**
2. Chrome menu (⋮) → **Add to Home screen**. It installs like a real app:
   own icon, no browser chrome, works offline for places you've already viewed.
3. Try it properly — search two cities, tap a month on the "Best time to visit"
   chart, star a trip.

Then send me the link and I'll run the full check: manifest content type,
service worker caching headers, icons, privacy page, and installability.

---

## If something goes wrong

| Symptom | Cause | Fix |
|:--|:--|:--|
| Page loads blank / white | Publish directory wrong | Must be `tripbrief/dist` (Route A) |
| 404 on every page | Zip was nested in a folder | Use my `tripbrief-site.zip`, don't re-zip the `dist` folder itself |
| Build fails: "no package.json" | Base directory missing | Set **Base directory** to `tripbrief` |
| Deployed but it's the API list, not the app | Branch is `master` | Change branch to `arena/01a04e2c-public-apis` |
| No "Add to Home screen" option | Manifest served as plain text | `_headers` fixes this — confirm you deployed the latest build |
