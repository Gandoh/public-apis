/**
 * Tiny fetch wrapper: timeouts, human-readable errors, and an in-memory +
 * sessionStorage cache so re-comparing destinations doesn't re-hammer the
 * upstream APIs (several of them are politely rate-limited).
 */

const TIMEOUT_MS = 14000;
const memory = new Map();

function cacheGet(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = sessionStorage.getItem('tb:' + key);
    if (!raw) return undefined;
    const { v, exp } = JSON.parse(raw);
    if (exp && Date.now() > exp) {
      sessionStorage.removeItem('tb:' + key);
      return undefined;
    }
    memory.set(key, v);
    return v;
  } catch {
    return undefined;
  }
}

function cacheSet(key, value, ttlMs) {
  memory.set(key, value);
  try {
    sessionStorage.setItem('tb:' + key, JSON.stringify({ v: value, exp: Date.now() + ttlMs }));
  } catch {
    /* quota — memory cache still works */
  }
}

export class ApiError extends Error {
  constructor(message, { status, source } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.source = source;
  }
}

export async function getJSON(url, { ttl = 10 * 60 * 1000, source = '', headers = {} } = {}) {
  const key = url;
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { Accept: 'application/json', ...headers },
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) throw new ApiError(`HTTP ${res.status}`, { status: res.status, source });
      throw new ApiError('Response was not valid JSON', { source });
    }

    if (!res.ok) {
      if (res.status === 429) {
        throw new ApiError('Rate limited — this free API throttles anonymous traffic. Try again shortly.', {
          status: 429,
          source,
        });
      }
      if (res.status === 404) throw new ApiError('Not found', { status: 404, source });
      const msg = data?.message || data?.error || data?.reason || data?.detail || `HTTP ${res.status}`;
      throw new ApiError(typeof msg === 'string' ? msg : `HTTP ${res.status}`, { status: res.status, source });
    }

    cacheSet(key, data, ttl);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError('Request timed out', { source });
    if (e instanceof ApiError) throw e;
    if (e instanceof TypeError) {
      throw new ApiError('Network or CORS failure — the API may be down or blocked by your network.', { source });
    }
    throw new ApiError(e.message || 'Unknown error', { source });
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve a batch of labelled promises without letting one rejection kill the rest. */
export async function settleAll(map) {
  const keys = Object.keys(map);
  const results = await Promise.allSettled(keys.map((k) => map[k]));
  const out = {};
  keys.forEach((k, i) => {
    const r = results[i];
    out[k] = r.status === 'fulfilled' ? { ok: true, data: r.value } : { ok: false, error: r.reason?.message || 'Failed' };
  });
  return out;
}
