# Can Trip Brief make money?

Yes — but **not in its current form**, and the reason is licensing, not traffic.

---

## The blocker

Open-Meteo powers five of the app's features (current weather, 7-day forecast,
historical climate, the "best time to visit" chart, air quality). Its terms are
unambiguous:

> **Non-commercial use.** You may only use the free API services for
> non-commercial purposes.
>
> The following examples are considered **commercial use**:
> - Operating websites or apps that **have subscriptions or display advertisements**
> - Integrating our service into commercial products or promotional activities
>
> — [open-meteo.com/en/terms](https://open-meteo.com/en/terms)

Putting a single AdSense unit on the current site breaches that clause. Not a
grey area — advertising is named explicitly.

**Nominatim** (place search) is stricter still. Its policy says commercial
applications "should keep in mind" access can be withdrawn without notice, bans
reselling geocoding results, and requires you to be able to switch provider on
request without shipping an update.

**Frankfurter, REST Countries, Nager.Date, Wikipedia, disease.sh, GeoJS** are all
fine commercially — open licences, attribution only.

---

## ⚠️ An existing compliance problem, independent of money

The Nominatim usage policy lists under **Unacceptable Use**:

> **Auto-complete search.** This is not yet supported by Nominatim and you must
> not implement such a service on the client side using the API.

`SearchBox.jsx` fires a request 550 ms after typing stops. That is
auto-complete, and it is explicitly forbidden — the stated penalty is a ban.
The debounce reduces load but does not make it permitted.

### ✅ Fixed — 29 Aug 2026

`SearchBox.jsx` no longer issues any request from the input's `onChange`
handler. A Nominatim call happens only on an explicit user submit: pressing
Enter, or activating the 🔍 button. Also added:

- an identical-term guard, so resubmitting the same query does not re-hit the
  network (the policy warns that repeated identical queries may be blocked);
- visible OpenStreetMap / Nominatim attribution beneath the results, which the
  policy requires;
- `test/searchbox.policy.test.jsx`, a jsdom regression test asserting that
  typing eight characters produces **zero** requests.

Existing compliance already in place: results cached 7 days, and the app is
well under 1 request/second because requests are now user-initiated.

---

## What monetising actually requires

### Route 1 — Pay for a commercial weather licence

| Item | Cost |
|:--|:--|
| Open-Meteo API Standard | **$29/mo** |
| Open-Meteo API Professional (needed for the historical/climate endpoints) | **$99/mo** |

The "best time to visit" chart uses the **Historical Weather API**, which
Standard excludes. So a faithful commercial version of *this* app is $99/mo.

That is the number to beat before any revenue is profit. Ad revenue on a niche
travel site at low traffic is typically **$1–5 per 1,000 visits**. You would
need roughly **20,000–100,000 monthly visits** just to cover the licence.

### Route 2 — Swap in commercially-licensed free APIs

Cheaper and more realistic:

- **Weather:** MET Norway Locationforecast (`api.met.no`) — free, commercial use
  permitted, CC BY 4.0, requires an identifying User-Agent. Or NWS for US-only.
- **Geocoding:** self-host Nominatim, or use a provider with a commercial free
  tier.
- **Historical climate:** this is the hard one. ERA5 via Open-Meteo is the easy
  source; alternatives mean heavier data work.

Effort: roughly a day of rework. Ongoing cost: $0.

### Route 3 — Don't monetise the site; monetise around it

Fully compliant today, because the site itself stays non-commercial:

- **Portfolio piece.** A live, polished app with 11 integrated APIs, offline
  support and a real PWA install flow is a strong hiring signal.
- **Content / affiliate on a *separate* property.** A travel blog that links to
  Trip Brief can carry affiliate links; the tool stays ad-free.
- **Consulting funnel.** "I built this" → paid client work.

---

## Honest assessment of the ad-revenue path

Even with licensing solved, consider:

- **No moat.** Every data source is public and free. The work is the interface.
- **Search traffic is hard.** "Lisbon vs Barcelona weather" is contested by
  established travel sites with domain authority built over years.
- **Utility apps have low ad yield.** Visitors compare two cities and leave —
  one or two page views, little dwell time, weak intent signals.

Realistic outcome for a site like this without a serious distribution effort:
**a few dollars a month.** Not zero, but well below the $99 licence.

---

## Recommendation

1. **Fix the autocomplete issue now** — it's a live ban risk regardless of money.
2. **Keep the site non-commercial** and treat it as a portfolio and utility piece.
   It's genuinely good; it doesn't need to be a business to be worth having.
3. **If you do want revenue**, take Route 2 — swap to commercially-licensed
   sources first, *then* add monetisation. Never the other way round: adding ads
   to the current stack is a terms breach on day one, and getting your IP blocked
   by Open-Meteo or Nominatim takes the site down entirely.

The most valuable thing here is not ad income — it's that you now have a
deployed, installable, real application with your name on it.
