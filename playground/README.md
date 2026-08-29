# Public APIs · Live Playground

A zero-dependency, zero-backend page that actually **calls** APIs listed in this repository's
`README.md` and renders the responses.

Every API used here satisfies all three conditions from the README table:

| Column | Required value |
|:--|:--|
| Auth  | `No` |
| HTTPS | `Yes` |
| CORS  | `Yes` |

That combination is what makes a browser-only demo possible — no key, no proxy, no server-side
secret. Of the ~1,706 entries in the README, 797 need no auth and 312 satisfy all three.

## Run it

```bash
python3 -m http.server 3000 --directory playground
# then open http://localhost:3000
```

Or just open `playground/index.html` directly in a browser — there is no build step.

## What's wired up

| Widget | API | Category |
|:--|:--|:--|
| Weather + 5-day forecast | Open-Meteo (+ its geocoder) | Weather |
| FX conversion + 30-day sparkline | Frankfurter (ECB rates) | Currency Exchange |
| Crypto prices & 24h change | CoinGecko | Cryptocurrency |
| Upcoming rocket launches | Launch Library 2 | Science & Math |
| Live earthquake feed | USGS Earthquake Hazards | Science & Math |
| Your IP geolocation | GeoJS | Geocoding |
| Address → coordinates | Nominatim (OpenStreetMap) | Geocoding |
| Country profile | REST Countries | Geocoding |
| Article summary | Wikipedia REST | Open Data |
| Scholarly paper search | OpenAlex | Science & Math |
| Word definitions | Free Dictionary | Dictionaries |
| Book search + covers | Open Library | Books |
| Museum artwork (IIIF) | Art Institute of Chicago | Art & Design |
| Dog photos by breed | Dog CEO | Animals |
| Random cat fact | Cat Facts | Animals |
| Status-code cats | HTTP Cats | Animals |
| Jokes by category | JokeAPI | Entertainment |
| Pokémon stats & sprites | PokéAPI | Games & Comics |
| Anime search | Jikan (MyAnimeList) | Anime |
| Character search | Rick and Morty API | Games & Comics |
| Film catalogue | Studio Ghibli | Anime |
| Name → age/gender/nationality | Agify · Genderize · Nationalize | Development |
| Public-health country stats | Open Disease | Health |
| F1 race sessions | OpenF1 | Sports & Fitness |
| Fake user fixtures | Random User | Test Data |
| Repository stats | GitHub REST (unauthenticated) | Development |
| Advice + useless facts | Advice Slip · Useless Facts | Entertainment |

## Features

- **Run every widget** — fires all cards with a concurrency limit of 4.
- **Health check** — runs everything and prints a ✓/✗ reachability report, i.e. a crude
  liveness test of these README entries.
- **Category chips** — filter the grid.
- **Request & raw JSON** — every card exposes the exact `GET` URL it called plus the
  unformatted response, so you can copy the endpoint into `curl` or your own code.
- Every `fetch` has a 12s timeout and human-readable error mapping (429 rate limits,
  CORS/network failures, non-JSON responses).

## Adding a widget

Append an object to the `WIDGETS` array in `widgets.js`:

```js
{
  id: 'my-api',
  title: 'My API',
  desc: 'One-line description.',
  cat: 'Development',              // README section name
  docs: 'https://example.com/docs',
  controls: [{ type: 'text', key: 'q', value: 'default', placeholder: 'Query' }],
  async run(p) {
    const url = `https://api.example.com/search?q=${encodeURIComponent(p.q)}`;
    return { url, data: await fetchJSON(url) };
  },
  render(d) { return `<div class="big">${esc(d.result)}</div>`; }
}
```

`render` receives the parsed JSON and returns an HTML string. Helpers available:
`esc()` (HTML-escape), `num()` (locale number formatting) and `rows([[label, value], …])`.

## Caveats

These are free, community-run services. Failures you may see are upstream, not local:

- **CoinGecko** rate-limits anonymous callers aggressively (`429`).
- **Jikan** allows ~3 req/s; hitting "Run every widget" repeatedly will trip it.
- **Nominatim** asks that you not hammer it — one request per second, and set a real
  `User-Agent` if you build on it for anything beyond a demo.
- **GitHub** unauthenticated is 60 requests/hour per IP.
