/**
 * Every data source below is an entry in this repository's README.md.
 * All are free and require no API key.
 *
 *  Nominatim (OpenStreetMap) .. Geocoding      | Auth No  | HTTPS Yes | CORS Yes
 *  Open-Meteo ................. Weather        | Auth No  | HTTPS Yes | CORS Yes
 *  REST Countries ............. Geocoding      | Auth No  | HTTPS Yes | CORS Yes
 *  Frankfurter ................ Currency Exch. | Auth No  | HTTPS Yes | CORS Yes
 *  Nager.Date ................. Calendar       | Auth No  | HTTPS Yes | CORS listed "No"
 *  Wikipedia (MediaWiki) ...... Open Data      | Auth No  | HTTPS Yes | CORS via origin=*
 *  Open Disease ............... Health         | Auth No  | HTTPS Yes | CORS Yes
 *  GeoJS ...................... Geocoding      | Auth No  | HTTPS Yes | CORS Yes
 */

import { getJSON } from './client.js';

const day = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Geocoding — Nominatim                                               */
/* ------------------------------------------------------------------ */

export async function searchPlaces(query, limit = 6) {
  if (!query || query.trim().length < 2) return [];
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}` +
    `&q=${encodeURIComponent(query.trim())}`;
  const raw = await getJSON(url, { ttl: 7 * day, source: 'Nominatim' });
  return raw
    .filter((r) => r.lat && r.lon)
    .map((r) => {
      const a = r.address || {};
      const city = a.city || a.town || a.village || a.municipality || a.county || r.name;
      return {
        id: `${r.osm_type}${r.osm_id}`,
        name: city || r.display_name.split(',')[0],
        display: r.display_name,
        lat: Number(r.lat),
        lon: Number(r.lon),
        countryName: a.country || '',
        countryCode: (a.country_code || '').toUpperCase(),
        type: r.type,
      };
    });
}

/* ------------------------------------------------------------------ */
/* Weather — Open-Meteo (forecast + historical climate + air quality)  */
/* ------------------------------------------------------------------ */

export function getForecast(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,` +
    `uv_index_max,sunrise,sunset,wind_speed_10m_max` +
    `&timezone=auto&forecast_days=7`;
  return getJSON(url, { ttl: 30 * 60 * 1000, source: 'Open-Meteo' });
}

/**
 * A full year of daily reanalysis in a single request. We derive both the
 * selected month's climate and the 12-month "best time to visit" chart from
 * this one payload rather than making twelve calls.
 */
export function getYearClimate(lat, lon) {
  const year = new Date().getFullYear() - 1;
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${year}-01-01&end_date=${year}-12-31` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  return getJSON(url, { ttl: 30 * day, source: 'Open-Meteo Archive' });
}

export function getAirQuality(lat, lon) {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=european_aqi,us_aqi,pm2_5,pm10&timezone=auto`;
  return getJSON(url, { ttl: 60 * 60 * 1000, source: 'Open-Meteo Air Quality' });
}

/* ------------------------------------------------------------------ */
/* Country profile — REST Countries                                    */
/* ------------------------------------------------------------------ */

export async function getCountry(code) {
  if (!code) throw new Error('No country code');
  const url =
    `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}` +
    `?fields=name,cca2,cca3,capital,region,subregion,population,area,currencies,languages,flags,flag,` +
    `timezones,idd,car,continents,maps,borders,startOfWeek`;
  const data = await getJSON(url, { ttl: 30 * day, source: 'REST Countries' });
  return Array.isArray(data) ? data[0] : data;
}

/* ------------------------------------------------------------------ */
/* Money — Frankfurter (ECB reference rates)                           */
/* ------------------------------------------------------------------ */

export function getRate(base, symbol) {
  if (!base || !symbol) throw new Error('Missing currency');
  if (base === symbol) return Promise.resolve({ base, rates: { [symbol]: 1 }, date: 'same currency' });
  const url = `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${symbol}`;
  return getJSON(url, { ttl: 6 * 60 * 60 * 1000, source: 'Frankfurter' });
}

export function getRateHistory(base, symbol) {
  if (base === symbol) return Promise.resolve({ rates: {} });
  const since = new Date(Date.now() - 90 * day).toISOString().slice(0, 10);
  const url = `https://api.frankfurter.dev/v1/${since}..?base=${base}&symbols=${symbol}`;
  return getJSON(url, { ttl: 12 * 60 * 60 * 1000, source: 'Frankfurter' });
}

export function getSupportedCurrencies() {
  return getJSON('https://api.frankfurter.dev/v1/currencies', { ttl: 30 * day, source: 'Frankfurter' });
}

/* ------------------------------------------------------------------ */
/* Public holidays — Nager.Date                                        */
/* ------------------------------------------------------------------ */

export function getHolidays(countryCode, year) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
  return getJSON(url, { ttl: 30 * day, source: 'Nager.Date' });
}

/* ------------------------------------------------------------------ */
/* Encyclopedia + points of interest — Wikipedia / MediaWiki           */
/* ------------------------------------------------------------------ */

export function getWikiSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  return getJSON(url, { ttl: 7 * day, source: 'Wikipedia' });
}

/** Geosearch: notable Wikipedia articles within a radius, with thumbnails. */
export async function getNearbyPOIs(lat, lon, radius = 10000, limit = 24) {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=geosearch&ggscoord=${lat}%7C${lon}&ggsradius=${radius}&ggslimit=${limit}` +
    `&prop=pageimages%7Cdescription%7Ccoordinates&piprop=thumbnail&pithumbsize=400&pilimit=${limit}`;
  const data = await getJSON(url, { ttl: 7 * day, source: 'Wikipedia GeoSearch' });
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  return pages
    .map((p) => ({
      id: p.pageid,
      title: p.title,
      description: p.description || '',
      thumb: p.thumbnail?.source || null,
      lat: p.coordinates?.[0]?.lat,
      lon: p.coordinates?.[0]?.lon,
      url: `https://en.wikipedia.org/?curid=${p.pageid}`,
    }))
    .sort((a, b) => (b.thumb ? 1 : 0) - (a.thumb ? 1 : 0));
}

/* ------------------------------------------------------------------ */
/* Health signals — Open Disease                                       */
/* ------------------------------------------------------------------ */

export function getHealth(countryCode) {
  const url = `https://disease.sh/v3/covid-19/countries/${encodeURIComponent(countryCode)}?strict=false`;
  return getJSON(url, { ttl: day, source: 'Open Disease' });
}

/* ------------------------------------------------------------------ */
/* Traveller's own location — GeoJS                                    */
/* ------------------------------------------------------------------ */

export function getMyLocation() {
  return getJSON('https://get.geojs.io/v1/ip/geo.json', { ttl: day, source: 'GeoJS' });
}

/** Static OSM map tile embed URL (no API, no key). */
export function osmEmbed(lat, lon, zoomPad = 0.06) {
  const bbox = [lon - zoomPad, lat - zoomPad / 2, lon + zoomPad, lat + zoomPad / 2].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
}

export const SOURCES = [
  { name: 'Nominatim', cat: 'Geocoding', use: 'Place search & coordinates', url: 'https://nominatim.org/release-docs/latest/api/Overview/' },
  { name: 'Open-Meteo', cat: 'Weather', use: '7-day forecast, sunrise/sunset, UV', url: 'https://open-meteo.com/' },
  { name: 'Open-Meteo Archive', cat: 'Weather', use: 'Historical climate for your travel month', url: 'https://open-meteo.com/en/docs/historical-weather-api' },
  { name: 'Open-Meteo Air Quality', cat: 'Environment', use: 'PM2.5, PM10 and AQI', url: 'https://open-meteo.com/en/docs/air-quality-api' },
  { name: 'REST Countries', cat: 'Geocoding', use: 'Currency, languages, driving side, dial code', url: 'https://restcountries.com' },
  { name: 'Frankfurter', cat: 'Currency Exchange', use: 'ECB exchange rates & 90-day trend', url: 'https://www.frankfurter.app/docs' },
  { name: 'Nager.Date', cat: 'Calendar', use: 'Public holidays in 90+ countries', url: 'https://date.nager.at' },
  { name: 'Wikipedia', cat: 'Open Data', use: 'Destination briefing & nearby landmarks', url: 'https://www.mediawiki.org/wiki/API:Main_page' },
  { name: 'Open Disease', cat: 'Health', use: 'Country public-health statistics', url: 'https://disease.sh/' },
  { name: 'GeoJS', cat: 'Geocoding', use: 'Detects your home country & currency', url: 'https://www.geojs.io/' },
  { name: 'OpenStreetMap', cat: 'Geocoding', use: 'Embedded maps', url: 'https://www.openstreetmap.org' },
];
