import { useCallback, useEffect, useState } from 'react';

const KEY = 'tb:saved';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function useSavedTrips() {
  const [trips, setTrips] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(trips));
    } catch {
      /* quota */
    }
  }, [trips]);

  const idOf = (a, b, month) =>
    [a?.name, b?.name, month].join('|').toLowerCase();

  const save = useCallback((a, b, month) => {
    if (!a) return;
    const entry = {
      id: idOf(a, b, month),
      a: { name: a.name, lat: a.lat, lon: a.lon, countryCode: a.countryCode, countryName: a.countryName },
      b: b ? { name: b.name, lat: b.lat, lon: b.lon, countryCode: b.countryCode, countryName: b.countryName } : null,
      month,
      at: Date.now(),
    };
    setTrips((t) => [entry, ...t.filter((x) => x.id !== entry.id)].slice(0, 12));
  }, []);

  const remove = useCallback((id) => setTrips((t) => t.filter((x) => x.id !== id)), []);

  const isSaved = useCallback((a, b, month) => trips.some((t) => t.id === idOf(a, b, month)), [trips]);

  return { trips, save, remove, isSaved };
}
