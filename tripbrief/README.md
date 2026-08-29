# ✈️ Trip Brief

Compare any two destinations side by side — weather for your travel month, exchange rates,
public holidays, air quality, landmarks and country essentials.

**Every data source is an entry in this repository's `README.md`, and every one is free with
no API key.** The whole app runs in the browser: no backend, no proxy, no secrets.

```bash
cd tripbrief
npm install
npm run dev      # http://localhost:5173
```

**Live at [tripbrief.netlify.app](https://tripbrief.netlify.app)** — deployed from
this branch, rebuilds automatically on push.

**Thinking about monetising?** Read
[`MONETISATION.md`](./MONETISATION.md) first — Open-Meteo's free tier forbids
advertising and subscriptions, so ads on the current stack would breach its terms.

**Publishing?** [`DEPLOY-WEB.md`](./DEPLOY-WEB.md) gets the website live for free
in ~10 minutes (or [`DEPLOY-FROM-PHONE.md`](./DEPLOY-FROM-PHONE.md) if you're on
mobile). [`LAUNCH.md`](./LAUNCH.md) then takes it to the Google Play Store.

## What it does

Type two cities. Trip Brief fires ~10 APIs in parallel per destination and assembles a dossier:

- **Comfort score** — a 0–100 heuristic for how pleasant your chosen travel month usually is,
  computed from last year's reanalysis data (temperature distance from 22 °C, plus a rain penalty).
- **Best time to visit** — all twelve months scored and charted, with the sweet-spot window
  called out. Click any month to re-run the whole comparison for it.
- **Packing list** — generated from the actual forecast and climate, with the reason attached
  to each item ("rain on 60% of days", "18 °C swing between day and night").
- **Saved trips** — star a comparison and it's one tap away next time.
- **Head-to-head verdict** — which destination has better weather, is warmer, drier, has cleaner
  air, causes less jet lag, and how far apart they are.
- **Live weather** — current conditions plus a 7-day forecast with precipitation probability,
  UV index, sunrise and sunset in local time.
- **Money** — ECB exchange rate from your currency, a 90-day trend sparkline, and an inline converter.
- **Know before you go** — capital, languages, dial code, driving side (highlighted when it differs
  from your home country), population, week start.
- **Public holidays** — what's closed while you're there, and a count for your travel month.
- **Map & landmarks** — embedded OpenStreetMap plus notable Wikipedia articles within 10 km.

## Data sources

| API | README category | Used for |
|:--|:--|:--|
| [Nominatim](https://nominatim.org/release-docs/latest/api/Overview/) | Geocoding | Place search, coordinates, country code |
| [Open-Meteo](https://open-meteo.com/) | Weather | Current conditions + 7-day forecast |
| [Open-Meteo Archive](https://open-meteo.com/en/docs/historical-weather-api) | Weather | Historical climate for the comfort score |
| [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | Environment | European AQI, PM2.5, PM10 |
| [REST Countries](https://restcountries.com) | Geocoding | Currency, languages, driving side, dial code |
| [Frankfurter](https://www.frankfurter.app/docs) | Currency Exchange | ECB rates + 90-day history |
| [Nager.Date](https://date.nager.at) | Calendar | Public holidays for 90+ countries |
| [Wikipedia](https://www.mediawiki.org/wiki/API:Main_page) | Open Data | Destination briefing, hero image |
| Wikipedia GeoSearch | Open Data | Nearby landmarks with thumbnails |
| [Open Disease](https://disease.sh/) | Health | Country public-health statistics |
| [GeoJS](https://www.geojs.io/) | Geocoding | Detects your home country → default currency |
| [OpenStreetMap](https://www.openstreetmap.org) | Geocoding | Embedded map tiles |

## Architecture

```
src/
├── api/
│   ├── client.js       fetch wrapper: 14s timeout, error normalisation,
│   │                   two-tier cache (memory + sessionStorage with TTLs)
│   └── sources.js      one function per API; the only place URLs live
├── lib/
│   ├── util.js         WMO weather codes, unit conversion, comfort scoring,
│   │                   timezone maths, formatters
│   ├── insights.js     month slicing, 12-month scores, best window, packing
│   ├── useSavedTrips.js  localStorage-backed saved comparisons
│   └── useDestination.js  loads a full dossier in parallel; stale-response
│                          guard via a request-id ref
├── components/
│   ├── SearchBox.jsx   debounced autocomplete with keyboard navigation
│   ├── Destination.jsx one destination column (10 cards)
│   ├── BestTime.jsx    twelve-month comfort chart, click to change month
│   ├── Packing.jsx     forecast-derived packing list
│   ├── Verdict.jsx     head-to-head comparison strip
│   ├── SavedTrips.jsx  starred comparisons
│   ├── InstallPrompt.jsx  PWA install banner
│   └── bits.jsx        Card, Row, Stat, Ring, Skeleton, ErrBox
└── App.jsx             shell, URL state, theme, preferences
```

**Resilience.** Sources are fetched with `Promise.allSettled`, so one failing API degrades a single
card instead of blanking the panel. Every card renders its own loading skeleton, error box or
empty state. Failures are mapped to readable messages (429 rate limit, timeout, CORS/network).

**Caching.** Responses are cached in memory and `sessionStorage` with per-source TTLs — 30 days for
country profiles, 30 minutes for forecasts. Re-comparing destinations is instant and doesn't
re-hit the upstream services.

**Shareable state.** The current comparison lives in the URL (`?a=…&b=…&m=8&c=USD&u=C`), so any
brief can be copied and sent. Theme, units, currency and saved trips persist in `localStorage`.

**Efficient by design.** One request fetches a full year of daily climate data; the selected
month and the twelve-month chart are both derived from it locally. Changing the travel month
re-slices cached data instead of hitting the network.

**Installable.** Ships as a PWA — web app manifest, service worker with offline support,
maskable icons — which is also what makes the Google Play path possible.

**Deploys to root or subpath.** `npm run build` targets a root origin;
`BASE_PATH=/repo/ npm run build` rewrites asset URLs, manifest scope and
service-worker scope for GitHub project pages. See
[`DEPLOY-WEB.md`](./DEPLOY-WEB.md), then [`LAUNCH.md`](./LAUNCH.md) for the
Play Store checklist and [`PUBLISHING.md`](./PUBLISHING.md) for full reference.

## Notes and limits

- The comfort score is a heuristic over one year of reanalysis data, not a forecast or a
  climatological normal. It's for comparing two places, not for planning around.
- Frankfurter covers ~30 ECB-tracked currencies. Destinations outside that set show a note
  instead of a rate.
- Nager.Date covers 90+ countries; others show an empty-state message.
- Nominatim requests are debounced to ~1/second per their usage policy. If you deploy this
  publicly, set a descriptive `User-Agent` and consider self-hosting.
- These are free, community-run services. Be kind to them.
