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

## What it does

Type two cities. Trip Brief fires ~10 APIs in parallel per destination and assembles a dossier:

- **Comfort score** — a 0–100 heuristic for how pleasant your chosen travel month usually is,
  computed from last year's reanalysis data (temperature distance from 22 °C, plus a rain penalty).
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
│   └── useDestination.js  loads a full dossier in parallel; stale-response
│                          guard via a request-id ref
├── components/
│   ├── SearchBox.jsx   debounced autocomplete with keyboard navigation
│   ├── Destination.jsx one destination column (8 cards)
│   ├── Verdict.jsx     head-to-head comparison strip
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
brief can be copied and sent. Theme, units and currency persist in `localStorage`.

## Notes and limits

- The comfort score is a heuristic over one year of reanalysis data, not a forecast or a
  climatological normal. It's for comparing two places, not for planning around.
- Frankfurter covers ~30 ECB-tracked currencies. Destinations outside that set show a note
  instead of a rate.
- Nager.Date covers 90+ countries; others show an empty-state message.
- Nominatim requests are debounced to ~1/second per their usage policy. If you deploy this
  publicly, set a descriptive `User-Agent` and consider self-hosting.
- These are free, community-run services. Be kind to them.
