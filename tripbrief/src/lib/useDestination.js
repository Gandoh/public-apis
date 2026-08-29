import { useEffect, useState, useCallback, useRef } from 'react';
import * as api from '../api/sources.js';
import { settleAll } from '../api/client.js';
import { sliceMonth, monthlyScores, bestWindow } from './insights.js';

const EMPTY = {
  loading: false,
  place: null,
  forecast: null,
  yearClimate: null,
  climate: null,
  scores: null,
  window: null,
  air: null,
  country: null,
  destCurrency: null,
  holidays: null,
  wiki: null,
  pois: null,
  health: null,
  rate: null,
  rateHistory: null,
  errors: {},
};

/**
 * Loads the full dossier for one destination. Fires everything in parallel and
 * degrades gracefully — a single failed source never blanks the panel.
 */
export function useDestination(place, month, homeCurrency) {
  const [state, setState] = useState(EMPTY);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!place) {
      setState(EMPTY);
      return;
    }
    const id = ++reqId.current;
    setState({ ...EMPTY, place, loading: true });

    const { lat, lon, countryCode, name } = place;
    const year = new Date().getFullYear();

    // Round 1: everything that only needs coordinates / country code.
    const first = await settleAll({
      forecast: api.getForecast(lat, lon),
      yearClimate: api.getYearClimate(lat, lon),
      air: api.getAirQuality(lat, lon),
      country: countryCode ? api.getCountry(countryCode) : Promise.reject(new Error('No country code')),
      holidays: countryCode ? api.getHolidays(countryCode, year) : Promise.reject(new Error('No country code')),
      wiki: api.getWikiSummary(name),
      pois: api.getNearbyPOIs(lat, lon),
      health: countryCode ? api.getHealth(countryCode) : Promise.reject(new Error('No country code')),
    });

    if (id !== reqId.current) return;

    const country = first.country.ok ? first.country.data : null;
    const destCurrency = country?.currencies ? Object.keys(country.currencies)[0] : null;

    const errors = {};
    Object.entries(first).forEach(([k, v]) => {
      if (!v.ok) errors[k] = v.error;
    });

    // Round 2: currency work depends on the country lookup resolving.
    let rate = null;
    let rateHistory = null;
    if (destCurrency && homeCurrency) {
      const second = await settleAll({
        rate: api.getRate(homeCurrency, destCurrency),
        hist: api.getRateHistory(homeCurrency, destCurrency),
      });
      if (id !== reqId.current) return;
      if (second.rate.ok) rate = second.rate.data;
      else errors.rate = second.rate.error;
      if (second.hist.ok) rateHistory = second.hist.data;
    }

    const yearClimate = first.yearClimate.ok ? first.yearClimate.data : null;
    const scores = yearClimate ? monthlyScores(yearClimate) : null;

    setState({
      loading: false,
      place,
      forecast: first.forecast.ok ? first.forecast.data : null,
      yearClimate,
      climate: yearClimate ? sliceMonth(yearClimate, month) : null,
      scores,
      window: scores ? bestWindow(scores) : null,
      air: first.air.ok ? first.air.data : null,
      country,
      destCurrency,
      holidays: first.holidays.ok ? first.holidays.data : null,
      wiki: first.wiki.ok ? first.wiki.data : null,
      pois: first.pois.ok ? first.pois.data : null,
      health: first.health.ok ? first.health.data : null,
      rate,
      rateHistory,
      errors,
    });
    // month intentionally excluded — changing it re-slices locally, see below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, homeCurrency]);

  useEffect(() => {
    load();
  }, [load]);

  // Changing the travel month must not refetch a year of data we already hold.
  useEffect(() => {
    setState((s) => (s.yearClimate ? { ...s, climate: sliceMonth(s.yearClimate, month) } : s));
  }, [month]);

  return [state, load];
}
