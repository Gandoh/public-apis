/* ------------------------------------------------------------------
   widgets.js — one entry per public API taken from this repo's README.
   Every API here is listed with Auth: No and HTTPS: Yes, and answers
   with permissive CORS headers, so the browser can call it directly.
   ------------------------------------------------------------------ */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const num = (n, d = 2) => (n === null || n === undefined || isNaN(n)) ? '—'
  : Number(n).toLocaleString(undefined, { maximumFractionDigits: d });

const WMO = {
  0: ['Clear sky', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'], 51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'],
  55: ['Dense drizzle', '🌧️'], 61: ['Slight rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  71: ['Slight snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 80: ['Rain showers', '🌦️'],
  81: ['Rain showers', '🌧️'], 82: ['Violent showers', '⛈️'], 95: ['Thunderstorm', '⛈️'],
  96: ['Thunder + hail', '⛈️'], 99: ['Thunder + hail', '⛈️']
};
const wmo = c => WMO[c] || ['—', '🌡️'];

const rows = list => `<div class="rows">${list.map(([k, v]) =>
  `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;

const WIDGETS = [
  /* ------------------------------------------------------ WEATHER */
  {
    id: 'open-meteo',
    title: 'Open-Meteo',
    desc: 'Global weather forecast — geocode a city name, then read live conditions + 5-day outlook.',
    cat: 'Weather',
    docs: 'https://open-meteo.com/',
    controls: [{ type: 'text', key: 'city', value: 'Freetown', placeholder: 'City' }],
    async run(p) {
      const g = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(p.city)}&count=1`);
      if (!g.results || !g.results.length) throw new Error(`No place called "${p.city}"`);
      const { latitude, longitude, name, country } = g.results[0];
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
        `&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=5`;
      const w = await fetchJSON(url);
      return { url, data: { place: `${name}, ${country}`, ...w } };
    },
    render(d) {
      const c = d.current, [txt, ico] = wmo(c.weather_code);
      const days = d.daily.time.map((t, i) => {
        const [, di] = wmo(d.daily.weather_code[i]);
        return `<div class="row"><span>${di} ${new Date(t).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <b>${Math.round(d.daily.temperature_2m_min[i])}° / ${Math.round(d.daily.temperature_2m_max[i])}°</b></div>`;
      }).join('');
      return `<div class="big">${ico} ${Math.round(c.temperature_2m)}°C <small>${esc(txt)}</small></div>
        <div class="muted">${esc(d.place)} · humidity ${c.relative_humidity_2m}% · wind ${c.wind_speed_10m} km/h</div>
        <div class="rows" style="margin-top:10px">${days}</div>`;
    }
  },

  /* ------------------------------------------------------ CURRENCY */
  {
    id: 'frankfurter',
    title: 'Frankfurter',
    desc: 'ECB reference exchange rates — live conversion plus a 30-day trend sparkline.',
    cat: 'Currency Exchange',
    docs: 'https://www.frankfurter.app/docs',
    controls: [
      { type: 'text', key: 'amount', value: '100', placeholder: 'Amount' },
      { type: 'select', key: 'from', value: 'USD', options: ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'ZAR', 'NGN', 'CAD', 'AUD', 'INR', 'BRL'] },
      { type: 'select', key: 'to', value: 'EUR', options: ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'ZAR', 'NGN', 'CAD', 'AUD', 'INR', 'BRL'] }
    ],
    async run(p) {
      const url = `https://api.frankfurter.dev/v1/latest?base=${p.from}&symbols=${p.to},USD,EUR,GBP,JPY`;
      const latest = await fetchJSON(url);
      const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const hist = await fetchJSON(`https://api.frankfurter.dev/v1/${since}..?base=${p.from}&symbols=${p.to}`);
      return { url, data: { latest, hist, ...p } };
    },
    render(d) {
      const r = d.latest.rates[d.to];
      const series = Object.entries(d.hist.rates).map(([k, v]) => [k, v[d.to]]).filter(x => x[1]);
      const vals = series.map(x => x[1]), lo = Math.min(...vals), hi = Math.max(...vals);
      const bars = series.map(([k, v], i) => {
        const h = hi === lo ? 60 : 10 + 90 * (v - lo) / (hi - lo);
        const lbl = (i === 0 || i === series.length - 1) ? `<span>${k.slice(5)}</span>` : '';
        return `<div style="height:${h}%" title="${k}: ${v}">${lbl}</div>`;
      }).join('');
      const others = Object.entries(d.latest.rates).filter(([k]) => k !== d.to)
        .map(([k, v]) => [`1 ${d.from} →`, `${num(v, 4)} ${k}`]);
      return `<div class="big">${num(d.amount * r, 2)} <small>${esc(d.to)}</small></div>
        <div class="muted">${esc(d.amount)} ${esc(d.from)} · rate ${num(r, 4)} · ECB fix ${d.latest.date}</div>
        <div class="barwrap"><div class="bars">${bars}</div></div>
        <div style="margin-top:8px">${rows(others)}</div>`;
    }
  },

  /* ------------------------------------------------------ CRYPTO */
  {
    id: 'coingecko',
    title: 'CoinGecko',
    desc: 'Live crypto prices, 24h change and market caps. (Public tier rate-limits hard — a 429 here is normal.)',
    cat: 'Cryptocurrency',
    docs: 'http://www.coingecko.com/api',
    controls: [{ type: 'text', key: 'ids', value: 'bitcoin,ethereum,solana,dogecoin', placeholder: 'coin ids' }],
    async run(p) {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(p.ids)}` +
        `&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      const keys = Object.keys(d);
      if (!keys.length) throw new Error('No coins matched those ids');
      return rows(keys.map(k => {
        const c = d[k], ch = c.usd_24h_change ?? 0;
        return [`${k}<br><span class="muted">mcap $${num(c.usd_market_cap / 1e9, 1)}B</span>`,
        `$${num(c.usd, c.usd < 1 ? 5 : 2)} <span class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'} ${num(Math.abs(ch), 2)}%</span>`];
      }));
    }
  },

  /* ------------------------------------------------------ SPACE */
  {
    id: 'launchlibrary',
    title: 'Launch Library 2',
    desc: 'Every upcoming orbital rocket launch on Earth, with pads, providers and T-0 countdowns.',
    cat: 'Science & Math',
    docs: 'https://thespacedevs.com/llapi',
    controls: [{ type: 'select', key: 'limit', value: '5', options: ['3', '5', '8'] }],
    async run(p) {
      const url = `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=${p.limit}&mode=list`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      return rows(d.results.map(l => {
        const t = new Date(l.net), days = Math.round((t - Date.now()) / 864e5);
        return [`🚀 ${esc(l.name)}<br><span class="muted">${esc(l.launch_service_provider?.name || '')}</span>`,
        `${t.toLocaleDateString()}<br><span class="muted">T‑${days}d</span>`];
      }));
    }
  },

  /* ------------------------------------------------------ EARTH */
  {
    id: 'usgs',
    title: 'USGS Earthquakes',
    desc: 'Real-time seismic feed from the US Geological Survey — the last quakes above your magnitude threshold.',
    cat: 'Science & Math',
    docs: 'https://earthquake.usgs.gov/fdsnws/event/1/',
    controls: [{ type: 'select', key: 'mag', value: '4.5', options: ['2.5', '4.5', '6'] }],
    async run(p) {
      const start = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}` +
        `&minmagnitude=${p.mag}&orderby=time&limit=6`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      if (!d.features.length) return '<div class="muted">Quiet week — nothing above that magnitude.</div>';
      return rows(d.features.map(f => {
        const m = f.properties.mag;
        return [`${esc(f.properties.place)}<br><span class="muted">${new Date(f.properties.time).toLocaleString()}</span>`,
        `<span class="${m >= 6 ? 'down' : ''}">M ${num(m, 1)}</span>`];
      }));
    }
  },

  /* ------------------------------------------------------ GEO / IP */
  {
    id: 'geojs',
    title: 'GeoJS',
    desc: 'Where does the internet think you are? Geolocates the IP address this page is calling from.',
    cat: 'Geocoding',
    docs: 'https://www.geojs.io/',
    controls: [],
    async run() {
      const url = 'https://get.geojs.io/v1/ip/geo.json';
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      return `<div class="big">${esc(d.city || '—')} <small>${esc(d.country)}</small></div>
        ${rows([['IP', esc(d.ip)], ['Region', esc(d.region || '—')], ['Coords', `${d.latitude}, ${d.longitude}`],
        ['Timezone', esc(d.timezone || '—')], ['Network', esc(d.organization_name || '—')]])}`;
    }
  },

  {
    id: 'nominatim',
    title: 'Nominatim (OpenStreetMap)',
    desc: 'Free worldwide forward geocoding — turn any address or landmark into coordinates.',
    cat: 'Geocoding',
    docs: 'https://nominatim.org/release-docs/latest/api/Overview/',
    controls: [{ type: 'text', key: 'q', value: 'Cotton Tree, Freetown', placeholder: 'Address or landmark' }],
    async run(p) {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&q=${encodeURIComponent(p.q)}`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      if (!d.length) return '<div class="muted">No match. Try a broader query.</div>';
      return rows(d.map(r => [`📍 ${esc(r.display_name.split(',').slice(0, 3).join(','))}<br>
        <span class="muted">${esc(r.type)}</span>`, `${num(+r.lat, 4)}<br>${num(+r.lon, 4)}`]));
    }
  },

  {
    id: 'restcountries',
    title: 'REST Countries',
    desc: 'Flags, capitals, currencies, languages and population for any country on Earth.',
    cat: 'Geocoding',
    docs: 'https://restcountries.com',
    controls: [{ type: 'text', key: 'name', value: 'Sierra Leone', placeholder: 'Country' }],
    async run(p) {
      const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(p.name)}` +
        `?fields=name,capital,region,population,currencies,languages,flag,area,timezones`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      const c = d[0];
      if (!c) throw new Error('Country not found');
      return `<div class="flex"><div class="flag">${c.flag || '🏳️'}</div>
        <div><div class="big" style="font-size:22px">${esc(c.name.common)}</div>
        <div class="muted">${esc(c.name.official)}</div></div></div>
        <div style="margin-top:10px">${rows([
        ['Capital', esc((c.capital || []).join(', '))],
        ['Region', esc(c.region)],
        ['Population', num(c.population, 0)],
        ['Area', num(c.area, 0) + ' km²'],
        ['Currency', esc(Object.values(c.currencies || {}).map(x => `${x.name} (${x.symbol || ''})`).join(', '))],
        ['Languages', esc(Object.values(c.languages || {}).join(', '))]
      ])}</div>`;
    }
  },

  /* ------------------------------------------------------ KNOWLEDGE */
  {
    id: 'wikipedia',
    title: 'Wikipedia REST',
    desc: 'Article summaries straight from MediaWiki — the fastest way to add an encyclopedia to an app.',
    cat: 'Open Data',
    docs: 'https://www.mediawiki.org/wiki/API:Main_page',
    controls: [{ type: 'text', key: 'q', value: 'Public-domain software', placeholder: 'Article title' }],
    async run(p) {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.q.replace(/ /g, '_'))}`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      return `${d.thumbnail ? `<img class="hero" src="${esc(d.thumbnail.source)}" alt="">` : ''}
        <div class="big" style="font-size:19px;margin-top:8px">${esc(d.title)}</div>
        <p style="font-size:13.5px;color:#c6d0f5">${esc(d.extract)}</p>
        <a class="badge link" target="_blank" href="${esc(d.content_urls?.desktop?.page || '#')}">Read on Wikipedia ↗</a>`;
    }
  },

  {
    id: 'openalex',
    title: 'OpenAlex',
    desc: 'Open catalog of 250M+ scholarly works. Search papers by topic, sorted by citation count.',
    cat: 'Science & Math',
    docs: 'https://docs.openalex.org/',
    controls: [{ type: 'text', key: 'q', value: 'malaria vaccine', placeholder: 'Research topic' }],
    async run(p) {
      const url = `https://api.openalex.org/works?search=${encodeURIComponent(p.q)}` +
        `&per-page=5&sort=cited_by_count:desc&select=title,publication_year,cited_by_count,doi`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      if (!d.results.length) return '<div class="muted">No papers found.</div>';
      return rows(d.results.map(w => [
        `${w.doi ? `<a href="${esc(w.doi)}" target="_blank">${esc((w.title || '').slice(0, 90))}</a>` : esc((w.title || '').slice(0, 90))}
         <br><span class="muted">${w.publication_year || ''}</span>`,
        `${num(w.cited_by_count, 0)}<br><span class="muted">cites</span>`]));
    }
  },

  {
    id: 'dictionary',
    title: 'Free Dictionary',
    desc: 'Definitions, phonetics, parts of speech and synonyms for any English word.',
    cat: 'Dictionaries',
    docs: 'https://dictionaryapi.dev/',
    controls: [{ type: 'text', key: 'word', value: 'serendipity', placeholder: 'Word' }],
    async run(p) {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(p.word.trim())}`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      const e = d[0];
      const phon = e.phonetic || (e.phonetics.find(x => x.text) || {}).text || '';
      const defs = e.meanings.slice(0, 3).map(m =>
        `<div class="row"><span><i>${esc(m.partOfSpeech)}</i> — ${esc(m.definitions[0].definition)}</span></div>`).join('');
      const syn = [...new Set(e.meanings.flatMap(m => m.synonyms).slice(0, 8))];
      return `<div class="big" style="font-size:24px">${esc(e.word)} <small>${esc(phon)}</small></div>
        <div class="rows" style="margin-top:8px">${defs}</div>
        ${syn.length ? `<div style="margin-top:8px">${syn.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</div>` : ''}`;
    }
  },

  {
    id: 'openlibrary',
    title: 'Open Library',
    desc: 'Internet Archive\'s book database — search millions of titles and pull cover art.',
    cat: 'Books',
    docs: 'https://openlibrary.org/developers/api',
    controls: [{ type: 'text', key: 'q', value: 'things fall apart', placeholder: 'Book title' }],
    async run(p) {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(p.q)}&limit=4&fields=title,author_name,first_publish_year,cover_i`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      if (!d.docs.length) return '<div class="muted">No books found.</div>';
      const covers = d.docs.filter(b => b.cover_i).slice(0, 4)
        .map(b => `<img src="https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg" alt="${esc(b.title)}" loading="lazy">`).join('');
      return `<div class="thumbs">${covers}</div>
        <div style="margin-top:10px">${rows(d.docs.map(b =>
        [`${esc(b.title)}<br><span class="muted">${esc((b.author_name || ['—'])[0])}</span>`, b.first_publish_year || '—']))}</div>`;
    }
  },

  /* ------------------------------------------------------ ART & IMAGES */
  {
    id: 'artic',
    title: 'Art Institute of Chicago',
    desc: 'Search a world-class museum collection and render public-domain artwork via their IIIF image server.',
    cat: 'Art & Design',
    docs: 'https://api.artic.edu/docs/',
    controls: [{ type: 'text', key: 'q', value: 'starry night', placeholder: 'Search the collection' }],
    async run(p) {
      const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(p.q)}&limit=4` +
        `&fields=id,title,artist_title,date_display,image_id`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      const hits = d.data.filter(a => a.image_id);
      if (!hits.length) return '<div class="muted">No images for that search.</div>';
      const a = hits[0];
      return `<img class="hero" src="https://www.artic.edu/iiif/2/${a.image_id}/full/600,/0/default.jpg" alt="${esc(a.title)}" loading="lazy">
        <div class="big" style="font-size:17px;margin-top:8px">${esc(a.title)}</div>
        <div class="muted">${esc(a.artist_title || 'Unknown artist')} · ${esc(a.date_display || '')}</div>
        <div class="thumbs" style="margin-top:10px">${hits.slice(1).map(x =>
        `<img src="https://www.artic.edu/iiif/2/${x.image_id}/full/200,/0/default.jpg" title="${esc(x.title)}" loading="lazy">`).join('')}</div>`;
    }
  },

  {
    id: 'dogceo',
    title: 'Dog CEO',
    desc: 'The Stanford Dogs Dataset as an API — pick a breed, get photographs.',
    cat: 'Animals',
    docs: 'https://dog.ceo/dog-api/',
    controls: [{ type: 'text', key: 'breed', value: 'shiba', placeholder: 'Breed (blank = random)' }],
    async run(p) {
      const b = p.breed.trim().toLowerCase();
      const url = b ? `https://dog.ceo/api/breed/${encodeURIComponent(b)}/images/random/4`
        : 'https://dog.ceo/api/breeds/image/random/4';
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      if (d.status !== 'success') throw new Error(d.message || 'Unknown breed');
      return `<div class="thumbs">${d.message.map(u => `<img src="${esc(u)}" alt="dog" loading="lazy">`).join('')}</div>`;
    }
  },

  {
    id: 'catfact',
    title: 'Cat Facts',
    desc: 'The canonical "hello world" of public APIs. Random feline trivia, no key required.',
    cat: 'Animals',
    docs: 'https://catfact.ninja/',
    controls: [],
    async run() {
      const url = 'https://catfact.ninja/fact';
      return { url, data: await fetchJSON(url) };
    },
    render(d) { return `<div class="quote">🐈 ${esc(d.fact)}</div>`; }
  },

  /* ------------------------------------------------------ FUN */
  {
    id: 'jokeapi',
    title: 'JokeAPI',
    desc: 'Filterable jokes by category and language, with a safe-mode flag.',
    cat: 'Entertainment',
    docs: 'https://v2.jokeapi.dev/',
    controls: [{ type: 'select', key: 'cat', value: 'Programming', options: ['Programming', 'Pun', 'Misc', 'Spooky', 'Christmas', 'Any'] }],
    async run(p) {
      const url = `https://v2.jokeapi.dev/joke/${p.cat}?safe-mode&type=single,twopart`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      if (d.error) throw new Error(d.message || 'JokeAPI error');
      return d.type === 'single'
        ? `<div class="quote">${esc(d.joke)}</div>`
        : `<div class="quote">${esc(d.setup)}</div><div class="quote" style="margin-top:8px;color:var(--acc)">${esc(d.delivery)}</div>`;
    }
  },

  {
    id: 'pokeapi',
    title: 'PokéAPI',
    desc: 'Complete Pokémon dataset: types, stats, abilities and sprites for all generations.',
    cat: 'Games & Comics',
    docs: 'https://pokeapi.co',
    controls: [{ type: 'text', key: 'name', value: 'gengar', placeholder: 'Pokémon name or id' }],
    async run(p) {
      const url = `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(p.name.trim().toLowerCase())}`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      const sprite = d.sprites.other?.['official-artwork']?.front_default || d.sprites.front_default;
      const stats = d.stats.map(s => [s.stat.name, `${s.base_stat}`]);
      return `<div class="flex"><img class="sprite" src="${esc(sprite)}" alt="${esc(d.name)}">
        <div><div class="big" style="font-size:20px;text-transform:capitalize">${esc(d.name)} <small>#${d.id}</small></div>
        <div>${d.types.map(t => `<span class="pill">${esc(t.type.name)}</span>`).join('')}</div>
        <div class="muted">${(d.height / 10).toFixed(1)} m · ${(d.weight / 10).toFixed(1)} kg</div></div></div>
        <div style="margin-top:10px">${rows(stats)}</div>`;
    }
  },

  {
    id: 'jikan',
    title: 'Jikan (MyAnimeList)',
    desc: 'Unofficial MyAnimeList API — search anime with scores, episode counts and cover art.',
    cat: 'Anime',
    docs: 'https://jikan.moe',
    controls: [{ type: 'text', key: 'q', value: 'cowboy bebop', placeholder: 'Anime title' }],
    async run(p) {
      const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(p.q)}&limit=4&sfw=true`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      if (!d.data.length) return '<div class="muted">No anime matched.</div>';
      const covers = d.data.map(a => `<img src="${esc(a.images.jpg.image_url)}" title="${esc(a.title)}" loading="lazy">`).join('');
      return `<div class="thumbs">${covers}</div>
        <div style="margin-top:10px">${rows(d.data.map(a =>
        [`${esc(a.title)}<br><span class="muted">${a.type || ''} · ${a.episodes || '?'} eps</span>`,
        `⭐ ${a.score ?? '—'}`]))}</div>`;
    }
  },

  {
    id: 'rickmorty',
    title: 'Rick and Morty',
    desc: 'A tidy REST + pagination reference implementation. Search characters, get status and origin.',
    cat: 'Games & Comics',
    docs: 'https://rickandmortyapi.com',
    controls: [{ type: 'text', key: 'name', value: 'morty', placeholder: 'Character name' }],
    async run(p) {
      const url = `https://rickandmortyapi.com/api/character/?name=${encodeURIComponent(p.name)}`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      if (!d.results) return '<div class="muted">No characters found.</div>';
      const four = d.results.slice(0, 4);
      return `<div class="thumbs">${four.map(c => `<img src="${esc(c.image)}" title="${esc(c.name)}" loading="lazy">`).join('')}</div>
        <div style="margin-top:10px">${rows(four.map(c =>
        [`${esc(c.name)}<br><span class="muted">${esc(c.species)} · ${esc(c.origin.name)}</span>`,
        `<span class="${c.status === 'Alive' ? 'up' : c.status === 'Dead' ? 'down' : ''}">${esc(c.status)}</span>`]))}</div>
        <div class="muted" style="margin-top:6px">${d.info.count} total matches</div>`;
    }
  },

  {
    id: 'ghibli',
    title: 'Studio Ghibli',
    desc: 'Films, people and locations from the Ghibli catalogue.',
    cat: 'Anime',
    docs: 'https://ghibliapi.vercel.app',
    controls: [],
    async run() {
      const url = 'https://ghibliapi.vercel.app/films?limit=6&fields=title,release_date,rt_score,director';
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      return rows(d.slice(0, 6).map(f =>
        [`${esc(f.title)}<br><span class="muted">dir. ${esc(f.director)} · ${f.release_date}</span>`, `🍅 ${f.rt_score}`]));
    }
  },

  /* ------------------------------------------------------ DEV / DATA */
  {
    id: 'agify',
    title: 'Agify · Genderize · Nationalize',
    desc: 'Three sibling APIs that statistically guess age, gender and nationality from a first name.',
    cat: 'Development',
    docs: 'https://agify.io',
    controls: [{ type: 'text', key: 'name', value: 'aminata', placeholder: 'First name' }],
    async run(p) {
      const n = encodeURIComponent(p.name.trim());
      const url = `https://api.agify.io?name=${n}`;
      const [age, gen, nat] = await Promise.all([
        fetchJSON(url),
        fetchJSON(`https://api.genderize.io?name=${n}`),
        fetchJSON(`https://api.nationalize.io?name=${n}`)
      ]);
      return { url, data: { age, gen, nat } };
    },
    render(d) {
      const countries = (d.nat.country || []).slice(0, 3)
        .map(c => [`🌍 ${esc(c.country_id)}`, `${num(c.probability * 100, 1)}%`]);
      return `<div class="big">${d.age.age ?? '—'} <small>estimated age</small></div>
        ${rows([['Gender guess', `${esc(d.gen.gender || '—')} (${num((d.gen.probability || 0) * 100, 0)}%)`],
        ['Sample size', num(d.age.count, 0) + ' records'], ...countries])}`;
    }
  },

  {
    id: 'httpcat',
    title: 'HTTP Cats',
    desc: 'Every HTTP status code, illustrated by a cat. Genuinely useful for API error docs.',
    cat: 'Animals',
    docs: 'https://http.cat/',
    controls: [{ type: 'select', key: 'code', value: '418', options: ['200', '301', '400', '401', '403', '404', '418', '429', '500', '503'] }],
    async run(p) {
      const url = `https://http.cat/${p.code}`;
      return { url, data: { code: p.code }, skipJSON: true };
    },
    render(d) {
      return `<img class="hero" src="https://http.cat/${esc(d.code)}" alt="HTTP ${esc(d.code)}" loading="lazy">
        <div class="muted" style="margin-top:6px">Image endpoint — returns a PNG, not JSON.</div>`;
    }
  },

  {
    id: 'disease',
    title: 'Open Disease',
    desc: 'Aggregated public-health case data by country — a good example of a well-versioned open dataset API.',
    cat: 'Health',
    docs: 'https://disease.sh/',
    controls: [{ type: 'text', key: 'country', value: 'Sierra Leone', placeholder: 'Country' }],
    async run(p) {
      const url = `https://disease.sh/v3/covid-19/countries/${encodeURIComponent(p.country)}`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      if (d.message) throw new Error(d.message);
      return `<div class="flex"><img src="${esc(d.countryInfo.flag)}" style="width:46px;border-radius:5px" alt="">
        <div class="big" style="font-size:20px">${esc(d.country)}</div></div>
        <div style="margin-top:10px">${rows([
        ['Total cases', num(d.cases, 0)], ['Recovered', num(d.recovered, 0)],
        ['Deaths', num(d.deaths, 0)], ['Tests', num(d.tests, 0)],
        ['Population', num(d.population, 0)]])}</div>`;
    }
  },

  {
    id: 'openf1',
    title: 'OpenF1',
    desc: 'Formula 1 timing, telemetry and session data — free and unauthenticated.',
    cat: 'Sports & Fitness',
    docs: 'https://openf1.org/',
    controls: [{ type: 'select', key: 'year', value: '2024', options: ['2026', '2025', '2024', '2023'] }],
    async run(p) {
      const url = `https://api.openf1.org/v1/sessions?year=${p.year}&session_name=Race`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      if (!d.length) return '<div class="muted">No race sessions for that season yet.</div>';
      return rows(d.slice(-6).reverse().map(s =>
        [`🏁 ${esc(s.location)}<br><span class="muted">${esc(s.country_name)}</span>`,
        new Date(s.date_start).toLocaleDateString()]));
    }
  },

  {
    id: 'randomuser',
    title: 'Random User',
    desc: 'Generate realistic fake people — the go-to fixture generator for seeding UIs and tests.',
    cat: 'Test Data',
    docs: 'https://randomuser.me',
    controls: [{ type: 'select', key: 'results', value: '3', options: ['1', '3', '5'] }],
    async run(p) {
      const url = `https://randomuser.me/api/?results=${p.results}&inc=name,email,location,picture,dob,nat`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      return `<div class="thumbs">${d.results.map(u => `<img src="${esc(u.picture.large)}" alt="" loading="lazy">`).join('')}</div>
        <div style="margin-top:10px">${rows(d.results.map(u =>
        [`${esc(u.name.first)} ${esc(u.name.last)}<br><span class="muted">${esc(u.email)}</span>`,
        `${esc(u.location.country)}<br><span class="muted">age ${u.dob.age}</span>`]))}</div>`;
    }
  },

  {
    id: 'github',
    title: 'GitHub REST',
    desc: 'Unauthenticated GitHub calls still work at 60 req/hr — here are this very repository\'s live stats.',
    cat: 'Development',
    docs: 'https://docs.github.com/en/rest',
    controls: [{ type: 'text', key: 'repo', value: 'public-apis/public-apis', placeholder: 'owner/repo' }],
    async run(p) {
      const url = `https://api.github.com/repos/${p.repo.trim()}`;
      return { url, data: await fetchJSON(url) };
    },
    render(d) {
      if (d.message) throw new Error(d.message);
      return `<div class="big" style="font-size:20px">${esc(d.full_name)}</div>
        <div class="muted">${esc(d.description || '')}</div>
        <div style="margin-top:10px">${rows([
        ['⭐ Stars', num(d.stargazers_count, 0)], ['🍴 Forks', num(d.forks_count, 0)],
        ['👀 Watchers', num(d.subscribers_count, 0)], ['🐛 Open issues', num(d.open_issues_count, 0)],
        ['Last push', new Date(d.pushed_at).toLocaleDateString()]])}</div>`;
    }
  },

  {
    id: 'ipify-uuid',
    title: 'Bored + Advice',
    desc: 'Two tiny single-endpoint APIs mashed together: something to do, and unsolicited advice about it.',
    cat: 'Entertainment',
    docs: 'https://api.adviceslip.com/',
    controls: [],
    async run() {
      const url = 'https://api.adviceslip.com/advice';
      const [advice, quote] = await Promise.all([
        fetchJSON(url + '?t=' + Date.now()),
        fetchJSON('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en').catch(() => null)
      ]);
      return { url, data: { advice, quote } };
    },
    render(d) {
      return `<div class="quote">💡 ${esc(d.advice.slip.advice)}</div>
        ${d.quote ? `<div class="quote" style="margin-top:12px;color:var(--acc)">🤓 ${esc(d.quote.text)}</div>` : ''}`;
    }
  }
];
