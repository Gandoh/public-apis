import { comfortScore, MONTHS } from './util.js';

/**
 * Slice a full year of daily reanalysis down to one calendar month, in the
 * same shape comfortScore() expects.
 */
export function sliceMonth(yearClimate, month) {
  const d = yearClimate?.daily;
  if (!d?.time?.length) return null;
  const idx = [];
  d.time.forEach((t, i) => {
    if (Number(t.slice(5, 7)) === month) idx.push(i);
  });
  if (!idx.length) return null;
  return {
    daily: {
      time: idx.map((i) => d.time[i]),
      temperature_2m_max: idx.map((i) => d.temperature_2m_max[i]),
      temperature_2m_min: idx.map((i) => d.temperature_2m_min[i]),
      precipitation_sum: idx.map((i) => d.precipitation_sum[i]),
    },
  };
}

/** Comfort score for each of the 12 months. */
export function monthlyScores(yearClimate) {
  if (!yearClimate?.daily?.time?.length) return null;
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const slice = sliceMonth(yearClimate, m);
    const cs = slice ? comfortScore(slice) : null;
    out.push({ month: m, name: MONTHS[m - 1], short: MONTHS[m - 1].slice(0, 3), ...(cs || { score: null }) });
  }
  return out;
}

/** The best contiguous stretch of months to visit. */
export function bestWindow(scores) {
  if (!scores) return null;
  const valid = scores.filter((s) => s.score != null);
  if (valid.length < 3) return null;
  const best = Math.max(...valid.map((s) => s.score));
  const threshold = Math.max(best - 12, 45);

  // walk the year circularly to find the longest good run
  let bestRun = [];
  let run = [];
  for (let i = 0; i < 24; i++) {
    const s = scores[i % 12];
    if (s.score != null && s.score >= threshold) {
      run.push(s);
      if (run.length > bestRun.length && run.length <= 12) bestRun = [...run];
    } else {
      run = [];
    }
  }
  if (!bestRun.length) return null;
  return {
    from: bestRun[0].name,
    to: bestRun[bestRun.length - 1].name,
    length: bestRun.length,
    peak: valid.reduce((a, b) => (b.score > a.score ? b : a)),
  };
}

/**
 * Turn the forecast + climate into an actual packing list.
 * Every item carries the reason it was suggested.
 */
export function packingList({ climate, forecast, country, homeCountry }) {
  const items = [];
  const cs = climate ? comfortScore(climate) : null;
  const daily = forecast?.daily;

  if (cs) {
    const { avgMax, avgMin, wetDays, days, totalRain } = cs;
    const wetRatio = days ? wetDays / days : 0;

    if (avgMax >= 28) {
      items.push({ icon: '👕', label: 'Lightweight, breathable clothing', why: `Highs average ${Math.round(avgMax)}°C` });
      items.push({ icon: '🧴', label: 'Sunscreen SPF 30+', why: 'Sustained high temperatures' });
      items.push({ icon: '🧢', label: 'Hat and sunglasses', why: 'Strong midday sun likely' });
    } else if (avgMax >= 20) {
      items.push({ icon: '👕', label: 'Light layers', why: `Comfortable highs around ${Math.round(avgMax)}°C` });
    }

    if (avgMin <= 5) {
      items.push({ icon: '🧥', label: 'Insulated coat', why: `Lows average ${Math.round(avgMin)}°C` });
      items.push({ icon: '🧤', label: 'Gloves, scarf and warm hat', why: 'Near or below freezing at night' });
    } else if (avgMin <= 12) {
      items.push({ icon: '🧥', label: 'Warm jacket for evenings', why: `Drops to about ${Math.round(avgMin)}°C after dark` });
    }

    if (avgMax - avgMin >= 13) {
      items.push({ icon: '🧦', label: 'Layers you can shed', why: `${Math.round(avgMax - avgMin)}°C swing between day and night` });
    }

    if (wetRatio >= 0.4) {
      items.push({ icon: '🌂', label: 'Waterproof jacket and umbrella', why: `Rain on roughly ${Math.round(wetRatio * 100)}% of days` });
      items.push({ icon: '🥾', label: 'Water-resistant footwear', why: `${Math.round(totalRain)} mm of rain that month` });
    } else if (wetRatio >= 0.2) {
      items.push({ icon: '🌂', label: 'Packable rain layer', why: `Showers on about ${Math.round(wetRatio * 100)}% of days` });
    }
  }

  const uv = daily?.uv_index_max?.length ? Math.max(...daily.uv_index_max.filter((x) => x != null)) : null;
  if (uv != null && uv >= 8) {
    items.push({ icon: '🕶️', label: 'High-protection sunglasses', why: `UV index peaks at ${uv.toFixed(1)}` });
  }

  if (country?.car?.side && homeCountry?.car?.side && country.car.side !== homeCountry.car.side) {
    items.push({
      icon: '🚗',
      label: `Remember: they drive on the ${country.car.side}`,
      why: `You're used to the ${homeCountry.car.side}`,
    });
  }

  const idd = country?.idd?.root ? `${country.idd.root}${(country.idd.suffixes || [])[0] || ''}` : null;
  if (idd) items.push({ icon: '📱', label: `Save the dial code ${idd}`, why: 'For local numbers and emergencies' });

  if (country?.currencies) {
    const c = Object.values(country.currencies)[0];
    if (c?.name) items.push({ icon: '💳', label: `Some ${c.name} in cash`, why: 'Small vendors may not take cards' });
  }

  if (!items.length) {
    items.push({ icon: '🎒', label: 'Nothing unusual needed', why: 'Mild, stable conditions expected' });
  }
  return items;
}
