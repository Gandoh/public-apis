import { useState } from 'react';
import { Card, Row, Stat, Skeleton, ErrBox, Ring } from './bits.jsx';
import { osmEmbed } from '../api/sources.js';
import {
  wmo, fmt, compact, temp, aqiBand, uvBand, comfortScore, scoreBand,
  MONTHS, localTime, tzOffsetLabel, tzDelta, timeOnly,
} from '../lib/util.js';

export default function Destination({ state, month, unit, homeCurrency, homeCountry }) {
  const [amount, setAmount] = useState(100);
  const { place, loading, forecast, climate, air, country, holidays, wiki, pois, health, rate, rateHistory, destCurrency, errors = {} } = state;

  if (!place) return null;

  const tz = forecast?.timezone;
  const cur = forecast?.current;
  const daily = forecast?.daily;
  const cs = comfortScore(climate);
  const band = scoreBand(cs?.score);
  const aqiVal = air?.current?.european_aqi;
  const aBand = aqiBand(aqiVal);
  const rateVal = rate?.rates?.[destCurrency];
  const delta = tz ? tzDelta(tz) : null;

  const upcoming = (holidays || [])
    .filter((h) => new Date(h.date) >= new Date(new Date().toDateString()))
    .slice(0, 6);
  const monthHolidays = (holidays || []).filter((h) => new Date(h.date).getMonth() + 1 === month);

  const spark = rateHistory?.rates
    ? Object.entries(rateHistory.rates)
        .map(([d, v]) => ({ d, v: v[destCurrency] }))
        .filter((x) => x.v != null)
    : [];
  const sLo = spark.length ? Math.min(...spark.map((s) => s.v)) : 0;
  const sHi = spark.length ? Math.max(...spark.map((s) => s.v)) : 1;
  const trend = spark.length > 1 ? ((spark.at(-1).v - spark[0].v) / spark[0].v) * 100 : null;

  return (
    <div className="col">
      {/* ---------------- hero ---------------- */}
      <Card className="pad0">
        <div className="hero">
          {wiki?.thumbnail?.source ? (
            <img className="hero-img" src={wiki.originalimage?.source || wiki.thumbnail.source} alt={place.name} loading="lazy" />
          ) : (
            <div className="hero-fallback">{country?.flag || '🗺️'}</div>
          )}
          <div className="hero-body">
            <h2 className="hero-title">
              {country?.flag ? country.flag + ' ' : ''}
              {place.name}
            </h2>
            <div className="hero-sub">
              <span>{country?.name?.common || place.countryName || '—'}</span>
              {tz && (
                <>
                  <span>·</span>
                  <span>
                    🕐 {localTime(tz)} {tzOffsetLabel(tz)}
                    {delta != null && delta !== 0 && ` (${delta > 0 ? '+' : ''}${delta}h vs you)`}
                  </span>
                </>
              )}
            </div>
            {loading && !wiki ? (
              <div style={{ marginTop: 12 }}>
                <Skeleton lines={3} />
              </div>
            ) : wiki?.extract ? (
              <p className="hero-extract">{wiki.extract}</p>
            ) : null}
          </div>
        </div>
      </Card>

      {/* ---------------- travel-month verdict ---------------- */}
      <Card title={`Conditions in ${MONTHS[month - 1]}`} source="Open-Meteo Archive" href="https://open-meteo.com/en/docs/historical-weather-api">
        {loading && !climate ? (
          <Skeleton lines={3} />
        ) : errors.climate ? (
          <ErrBox>{errors.climate}</ErrBox>
        ) : cs ? (
          <div className="score-row">
            <Ring value={cs.score} tone={band.tone} />
            <div className="score-meta">
              <div className={`lbl tone-${band.tone}`}>{band.label} time to visit</div>
              <div className="sub">
                Typically {temp(cs.avgMin, unit)} to {temp(cs.avgMax, unit)}, with {cs.wetDays} wet {cs.wetDays === 1 ? 'day' : 'days'} out
                of {cs.days} and {fmt(cs.totalRain)} mm of rain across the month.
              </div>
              {monthHolidays.length > 0 && (
                <div className="sub">
                  🎉 {monthHolidays.length} public {monthHolidays.length === 1 ? 'holiday' : 'holidays'} this month
                  {monthHolidays.length <= 3 ? `: ${monthHolidays.map((h) => h.localName).join(', ')}` : ''}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="tone-neutral" style={{ fontSize: 13 }}>No climate record for this location.</div>
        )}
      </Card>

      {/* ---------------- weather now + 7 day ---------------- */}
      <Card title="Weather right now" source="Open-Meteo" href="https://open-meteo.com/">
        {loading && !forecast ? (
          <Skeleton lines={4} />
        ) : errors.forecast ? (
          <ErrBox>{errors.forecast}</ErrBox>
        ) : cur ? (
          <>
            <div className="now">
              <div className="ico">{wmo(cur.weather_code).icon}</div>
              <div>
                <div className="t">{temp(cur.temperature_2m, unit)}</div>
                <div className="d">
                  {wmo(cur.weather_code).label} · feels {temp(cur.apparent_temperature, unit)} · {cur.relative_humidity_2m}% humidity ·{' '}
                  {fmt(cur.wind_speed_10m)} km/h wind
                </div>
              </div>
            </div>

            <div className="fc">
              {daily?.time?.map((t, i) => (
                <div className="fc-day" key={t}>
                  <div className="dn">{i === 0 ? 'Today' : new Date(t).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                  <div className="di">{wmo(daily.weather_code[i]).icon}</div>
                  <div className="dt">{temp(daily.temperature_2m_max[i], unit)}</div>
                  <div className="dl">{temp(daily.temperature_2m_min[i], unit)}</div>
                  {daily.precipitation_probability_max?.[i] > 20 && <div className="dp">{daily.precipitation_probability_max[i]}%</div>}
                </div>
              ))}
            </div>

            <div className="stat-grid" style={{ marginTop: 14 }}>
              <Stat
                k="Air quality"
                v={aqiVal != null ? `${Math.round(aqiVal)} ${aBand.label}` : '—'}
                n={air?.current?.pm2_5 != null ? `PM2.5 ${fmt(air.current.pm2_5, 1)} µg/m³` : 'European AQI'}
                tone={aBand.tone}
              />
              <Stat
                k="UV index"
                v={daily?.uv_index_max?.[0] != null ? `${fmt(daily.uv_index_max[0], 1)} ${uvBand(daily.uv_index_max[0]).label}` : '—'}
                n="Peak today"
                tone={uvBand(daily?.uv_index_max?.[0]).tone}
              />
              <Stat k="Sunrise" v={daily?.sunrise?.[0] ? timeOnly(daily.sunrise[0], tz) : '—'} n="Local time" />
              <Stat k="Sunset" v={daily?.sunset?.[0] ? timeOnly(daily.sunset[0], tz) : '—'} n="Local time" />
            </div>
          </>
        ) : null}
      </Card>

      {/* ---------------- money ---------------- */}
      <Card title="Money" source="Frankfurter" href="https://www.frankfurter.app/docs">
        {loading && !rate ? (
          <Skeleton lines={3} />
        ) : !destCurrency ? (
          <div className="tone-neutral" style={{ fontSize: 13 }}>Currency unknown for this country.</div>
        ) : errors.rate ? (
          <ErrBox>{errors.rate}</ErrBox>
        ) : rateVal != null ? (
          <>
            <div className="rate-big">
              1 {homeCurrency} = {fmt(rateVal, rateVal < 10 ? 4 : 2)} {destCurrency}
            </div>
            <div className="rate-sub">
              {country?.currencies?.[destCurrency]?.name}
              {country?.currencies?.[destCurrency]?.symbol ? ` (${country.currencies[destCurrency].symbol})` : ''}
              {trend != null && (
                <>
                  {' · '}
                  <span className={trend >= 0 ? 'tone-good' : 'tone-bad'}>
                    {trend >= 0 ? '▲' : '▼'} {fmt(Math.abs(trend), 1)}% in 90 days
                  </span>
                </>
              )}
            </div>

            {spark.length > 3 && (
              <div className="spark" title="90-day exchange rate trend">
                {spark.map((s) => (
                  <i key={s.d} style={{ height: `${sHi === sLo ? 50 : 8 + (92 * (s.v - sLo)) / (sHi - sLo)}%` }} title={`${s.d}: ${s.v}`} />
                ))}
              </div>
            )}

            <div className="conv">
              <input
                type="number"
                value={amount}
                min="0"
                onChange={(e) => setAmount(e.target.value)}
                aria-label={`Amount in ${homeCurrency}`}
              />
              <span className="eq">→</span>
              <span className="out">
                {fmt((Number(amount) || 0) * rateVal, 2)} {destCurrency}
              </span>
            </div>
          </>
        ) : (
          <div className="tone-neutral" style={{ fontSize: 13 }}>
            No ECB rate for {destCurrency}. Frankfurter covers ~30 major currencies.
          </div>
        )}
      </Card>

      {/* ---------------- know before you go ---------------- */}
      <Card title="Know before you go" source="REST Countries" href="https://restcountries.com">
        {loading && !country ? (
          <Skeleton lines={5} />
        ) : errors.country ? (
          <ErrBox>{errors.country}</ErrBox>
        ) : country ? (
          <div className="rows">
            <Row k="Capital" v={(country.capital || []).join(', ') || '—'} />
            <Row k="Languages" v={Object.values(country.languages || {}).join(', ') || '—'} />
            <Row
              k="Dial code"
              v={country.idd?.root ? `${country.idd.root}${(country.idd.suffixes || [])[0] || ''}` : '—'}
            />
            <Row
              k="Driving side"
              v={country.car?.side ? country.car.side[0].toUpperCase() + country.car.side.slice(1) : '—'}
              tone={homeCountry?.car?.side && country.car?.side && homeCountry.car.side !== country.car.side ? 'warn' : undefined}
            />
            <Row k="Population" v={compact(country.population)} />
            <Row k="Region" v={`${country.subregion || country.region || '—'}`} />
            <Row k="Week starts" v={country.startOfWeek ? country.startOfWeek[0].toUpperCase() + country.startOfWeek.slice(1) : '—'} />
            {health?.cases != null && <Row k="Recorded cases (COVID, cumulative)" v={compact(health.cases)} />}
          </div>
        ) : null}
      </Card>

      {/* ---------------- holidays ---------------- */}
      <Card title="Upcoming public holidays" source="Nager.Date" href="https://date.nager.at">
        {loading && !holidays ? (
          <Skeleton lines={4} />
        ) : errors.holidays ? (
          <div className="tone-neutral" style={{ fontSize: 13 }}>
            Nager.Date has no calendar for this country.
          </div>
        ) : upcoming.length ? (
          <div>
            {upcoming.map((h) => (
              <div className="hol" key={h.date + h.name}>
                <span className="hd">
                  {new Date(h.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
                <span>
                  <span className="hn">{h.localName}</span>
                  {h.localName !== h.name && <span className="hy"> · {h.name}</span>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="tone-neutral" style={{ fontSize: 13 }}>No further holidays this year.</div>
        )}
      </Card>

      {/* ---------------- map ---------------- */}
      <Card title="Location" source="OpenStreetMap" href="https://www.openstreetmap.org">
        <iframe className="map" src={osmEmbed(place.lat, place.lon)} title={`Map of ${place.name}`} loading="lazy" />
        <div className="rate-sub" style={{ marginTop: 8 }}>
          {place.lat.toFixed(4)}, {place.lon.toFixed(4)}
        </div>
      </Card>

      {/* ---------------- points of interest ---------------- */}
      <Card title="Nearby landmarks" source="Wikipedia GeoSearch" href="https://www.mediawiki.org/wiki/API:Main_page">
        {loading && !pois ? (
          <Skeleton lines={3} />
        ) : errors.pois ? (
          <ErrBox>{errors.pois}</ErrBox>
        ) : pois?.length ? (
          <div className="poi-grid">
            {pois.slice(0, 9).map((p) => (
              <a className="poi" key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" title={p.description}>
                {p.thumb ? <img src={p.thumb} alt={p.title} loading="lazy" /> : <div className="ph">📍</div>}
                <div className="pt">{p.title}</div>
              </a>
            ))}
          </div>
        ) : (
          <div className="tone-neutral" style={{ fontSize: 13 }}>Nothing catalogued nearby.</div>
        )}
      </Card>
    </div>
  );
}
