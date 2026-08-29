export const WMO = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Rime fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Dense drizzle', icon: '🌧️' },
  56: { label: 'Freezing drizzle', icon: '🌧️' },
  57: { label: 'Freezing drizzle', icon: '🌧️' },
  61: { label: 'Slight rain', icon: '🌦️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  66: { label: 'Freezing rain', icon: '🌧️' },
  67: { label: 'Freezing rain', icon: '🌧️' },
  71: { label: 'Slight snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '🌨️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  77: { label: 'Snow grains', icon: '🌨️' },
  80: { label: 'Rain showers', icon: '🌦️' },
  81: { label: 'Rain showers', icon: '🌧️' },
  82: { label: 'Violent showers', icon: '⛈️' },
  85: { label: 'Snow showers', icon: '🌨️' },
  86: { label: 'Snow showers', icon: '❄️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunder + hail', icon: '⛈️' },
  99: { label: 'Thunder + hail', icon: '⛈️' },
};

export const wmo = (c) => WMO[c] || { label: '—', icon: '🌡️' };

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function fmt(n, d = 0) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

export function compact(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export const cToF = (c) => (c * 9) / 5 + 32;
export const temp = (c, unit) => (unit === 'F' ? `${Math.round(cToF(c))}°F` : `${Math.round(c)}°C`);

export function aqiBand(aqi) {
  if (aqi == null) return { label: 'Unknown', tone: 'neutral' };
  if (aqi <= 20) return { label: 'Good', tone: 'good' };
  if (aqi <= 40) return { label: 'Fair', tone: 'good' };
  if (aqi <= 60) return { label: 'Moderate', tone: 'warn' };
  if (aqi <= 80) return { label: 'Poor', tone: 'warn' };
  if (aqi <= 100) return { label: 'Very poor', tone: 'bad' };
  return { label: 'Extremely poor', tone: 'bad' };
}

export function uvBand(uv) {
  if (uv == null) return { label: '—', tone: 'neutral' };
  if (uv < 3) return { label: 'Low', tone: 'good' };
  if (uv < 6) return { label: 'Moderate', tone: 'good' };
  if (uv < 8) return { label: 'High', tone: 'warn' };
  if (uv < 11) return { label: 'Very high', tone: 'bad' };
  return { label: 'Extreme', tone: 'bad' };
}

/**
 * Comfort score 0-100 for a travel month, from historical climate.
 * Rewards temperatures near 22°C and penalises rain.
 */
export function comfortScore(climate) {
  if (!climate?.daily?.temperature_2m_max?.length) return null;
  const maxes = climate.daily.temperature_2m_max.filter((x) => x != null);
  const mins = climate.daily.temperature_2m_min.filter((x) => x != null);
  const rain = climate.daily.precipitation_sum.filter((x) => x != null);
  if (!maxes.length) return null;

  const avgMax = maxes.reduce((a, b) => a + b, 0) / maxes.length;
  const avgMin = mins.reduce((a, b) => a + b, 0) / mins.length;
  const mid = (avgMax + avgMin) / 2;
  const totalRain = rain.reduce((a, b) => a + b, 0);
  const wetDays = rain.filter((x) => x >= 1).length;

  // temperature component: perfect at 22°C, falls off ~4 points per degree away
  const tempPenalty = Math.min(55, Math.abs(mid - 22) * 4);
  // rain component
  const rainPenalty = Math.min(35, (wetDays / rain.length) * 45 + totalRain / 40);

  const score = Math.max(0, Math.min(100, Math.round(100 - tempPenalty - rainPenalty)));
  return { score, avgMax, avgMin, mid, totalRain, wetDays, days: rain.length };
}

export function scoreBand(s) {
  if (s == null) return { label: '—', tone: 'neutral' };
  if (s >= 75) return { label: 'Excellent', tone: 'good' };
  if (s >= 55) return { label: 'Good', tone: 'good' };
  if (s >= 35) return { label: 'Mixed', tone: 'warn' };
  return { label: 'Challenging', tone: 'bad' };
}

export function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function localTime(timezone) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    }).format(new Date());
  } catch {
    return '—';
  }
}

export function tzOffsetLabel(timezone) {
  try {
    const now = new Date();
    const tz = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName');
    return tz?.value || '';
  } catch {
    return '';
  }
}

/** Hours difference between the user's timezone and a destination timezone. */
export function tzDelta(timezone) {
  try {
    const now = new Date();
    const there = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const here = new Date(now.toLocaleString('en-US'));
    return Math.round((there - here) / 3600000);
  } catch {
    return null;
  }
}

export function timeOnly(iso, timezone) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}
