import { useEffect, useMemo, useState } from 'react';
import SearchBox from './components/SearchBox.jsx';
import Destination from './components/Destination.jsx';
import Verdict from './components/Verdict.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import { useDestination } from './lib/useDestination.js';
import { getMyLocation, getCountry, SOURCES } from './api/sources.js';
import { MONTHS } from './lib/util.js';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'CNY', 'INR', 'BRL', 'ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'TRY', 'MXN', 'SGD', 'HKD', 'KRW', 'NZD', 'THB', 'IDR', 'ILS', 'PHP', 'MYR', 'RON', 'HUF', 'BGN', 'ISK'];

const PRESETS = [
  { label: 'Lisbon vs Barcelona', sub: 'Iberian city break', a: { name: 'Lisbon', lat: 38.7071, lon: -9.1355, countryCode: 'PT', countryName: 'Portugal', id: 'p1' }, b: { name: 'Barcelona', lat: 41.3874, lon: 2.1686, countryCode: 'ES', countryName: 'Spain', id: 'p2' } },
  { label: 'Tokyo vs Seoul', sub: 'East Asia', a: { name: 'Tokyo', lat: 35.6762, lon: 139.6503, countryCode: 'JP', countryName: 'Japan', id: 'p3' }, b: { name: 'Seoul', lat: 37.5665, lon: 126.978, countryCode: 'KR', countryName: 'South Korea', id: 'p4' } },
  { label: 'Cape Town vs Nairobi', sub: 'Africa', a: { name: 'Cape Town', lat: -33.9249, lon: 18.4241, countryCode: 'ZA', countryName: 'South Africa', id: 'p5' }, b: { name: 'Nairobi', lat: -1.2864, lon: 36.8172, countryCode: 'KE', countryName: 'Kenya', id: 'p6' } },
  { label: 'Freetown vs Accra', sub: 'West Africa', a: { name: 'Freetown', lat: 8.4844, lon: -13.2344, countryCode: 'SL', countryName: 'Sierra Leone', id: 'p7' }, b: { name: 'Accra', lat: 5.6037, lon: -0.187, countryCode: 'GH', countryName: 'Ghana', id: 'p8' } },
];

/* --------- URL state so a comparison is shareable --------- */
function encodePlace(p) {
  if (!p) return '';
  return [p.name, p.lat.toFixed(4), p.lon.toFixed(4), p.countryCode || '', p.countryName || ''].join('~');
}
function decodePlace(s) {
  if (!s) return null;
  const [name, lat, lon, countryCode, countryName] = s.split('~');
  if (!name || !lat || !lon) return null;
  return { id: s, name, lat: Number(lat), lon: Number(lon), countryCode, countryName, display: name };
}

function readURL() {
  const q = new URLSearchParams(location.search);
  return {
    a: decodePlace(q.get('a')),
    b: decodePlace(q.get('b')),
    month: Number(q.get('m')) || new Date().getMonth() + 1,
    cur: q.get('c') || localStorage.getItem('tb:cur') || 'USD',
    unit: q.get('u') || localStorage.getItem('tb:unit') || 'C',
  };
}

export default function App() {
  const initial = useMemo(readURL, []);
  const [a, setA] = useState(initial.a);
  const [b, setB] = useState(initial.b);
  const [month, setMonth] = useState(initial.month);
  const [homeCurrency, setHomeCurrency] = useState(initial.cur);
  const [unit, setUnit] = useState(initial.unit);
  const [theme, setTheme] = useState(() => localStorage.getItem('tb:theme') || 'dark');
  const [homeCountry, setHomeCountry] = useState(null);
  const [detected, setDetected] = useState(null);

  const [stateA] = useDestination(a, month, homeCurrency);
  const [stateB] = useDestination(b, month, homeCurrency);

  /* theme */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('tb:theme', theme);
    // Keep the Android/TWA system bar in sync with the app theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#070b16' : '#f4f6fc');
  }, [theme]);

  useEffect(() => localStorage.setItem('tb:cur', homeCurrency), [homeCurrency]);
  useEffect(() => localStorage.setItem('tb:unit', unit), [unit]);

  /* detect the traveller's own country/currency once */
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const geo = await getMyLocation();
        if (dead || !geo?.country_code) return;
        setDetected(geo);
        const c = await getCountry(geo.country_code);
        if (dead) return;
        setHomeCountry(c);
        const cc = c?.currencies ? Object.keys(c.currencies)[0] : null;
        // only auto-set if the user hasn't already chosen one
        if (cc && CURRENCIES.includes(cc) && !new URLSearchParams(location.search).get('c') && !localStorage.getItem('tb:cur')) {
          setHomeCurrency(cc);
        }
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  /* keep the URL in sync — makes any comparison shareable */
  useEffect(() => {
    const q = new URLSearchParams();
    if (a) q.set('a', encodePlace(a));
    if (b) q.set('b', encodePlace(b));
    q.set('m', String(month));
    q.set('c', homeCurrency);
    q.set('u', unit);
    const url = `${location.pathname}?${q.toString()}`;
    history.replaceState(null, '', url);
  }, [a, b, month, homeCurrency, unit]);

  useEffect(() => {
    document.title = a && b ? `${a.name} vs ${b.name} · Trip Brief` : a ? `${a.name} · Trip Brief` : 'Trip Brief';
  }, [a, b]);

  function swap() {
    setA(b);
    setB(a);
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      alert('Shareable link copied to clipboard.');
    } catch {
      prompt('Copy this link:', location.href);
    }
  }

  const empty = !a && !b;

  return (
    <div className="app">
      <header className="topbar">
        <div className="wrap topbar-in">
          <div className="brand">
            <span className="mark">✈</span>
            <span>
              Trip Brief
              <small>Destination research on free public APIs</small>
            </span>
          </div>
          <span className="spacer" />

          <div className="seg" role="group" aria-label="Temperature unit">
            <button className={unit === 'C' ? 'on' : ''} onClick={() => setUnit('C')}>°C</button>
            <button className={unit === 'F' ? 'on' : ''} onClick={() => setUnit('F')}>°F</button>
          </div>
          <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme" aria-label="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="wrap deck">
        <div className="deck-grid">
          <SearchBox label="Destination A" value={a} onPick={setA} placeholder="Search a city — e.g. Lisbon" />
          <SearchBox label="Destination B" value={b} onPick={setB} placeholder="Compare against — e.g. Barcelona" />
          <div className="opts">
            <div className="field">
              <label>Travelling in</label>
              <select className="select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Your currency</label>
              <select className="select" value={homeCurrency} onChange={(e) => setHomeCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button className="btn" onClick={swap} disabled={!a || !b} title="Swap A and B">⇄</button>
            <button className="btn" onClick={share} disabled={!a} title="Copy shareable link">🔗</button>
          </div>
        </div>
        {detected && (
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 8 }}>
            Detected your location as {detected.city ? detected.city + ', ' : ''}
            {detected.country} via GeoJS — used to set your home currency and flag driving-side differences.
          </div>
        )}
      </div>

      {empty ? (
        <div className="wrap empty">
          <h2>Compare any two destinations, side by side.</h2>
          <p>
            Weather for your travel month, exchange rates, public holidays, air quality, landmarks and country
            essentials — assembled live from eleven free APIs listed in this repository. No accounts, no API keys.
          </p>
          <div className="presets">
            {PRESETS.map((p) => (
              <button
                className="preset"
                key={p.label}
                onClick={() => {
                  setA(p.a);
                  setB(p.b);
                }}
              >
                <b>{p.label}</b>
                <span>{p.sub}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <Verdict a={stateA} b={stateB} month={month} unit={unit} />
          <main className="wrap compare">
            <Destination state={stateA} month={month} unit={unit} homeCurrency={homeCurrency} homeCountry={homeCountry} />
            <Destination state={stateB} month={month} unit={unit} homeCurrency={homeCurrency} homeCountry={homeCountry} />
          </main>
        </>
      )}

      <footer className="foot">
        <div className="wrap">
          <h4>Data sources — every one from this repository's README</h4>
          <div className="srcs">
            {SOURCES.map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer">
                <i>{s.cat}</i>
                <b> {s.name}</b>
                <p>{s.use}</p>
              </a>
            ))}
          </div>
          <p style={{ margin: 0 }}>
            All sources are listed with <b>Auth: No</b> and <b>HTTPS: Yes</b>, so this app runs entirely in your
            browser with no backend and no keys. Comfort scores are a heuristic over last year's reanalysis data,
            not a forecast. Be kind to these free services.
          </p>
          <p style={{ margin: '10px 0 0' }}>
            <a href="/privacy.html">Privacy policy</a> · No accounts, no analytics, no tracking.
          </p>
        </div>
      </footer>

      <InstallPrompt />
    </div>
  );
}
