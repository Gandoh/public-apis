import { useEffect, useRef, useState } from 'react';
import { searchPlaces } from '../api/sources.js';

/**
 * Place search input.
 *
 * IMPORTANT — Nominatim usage policy compliance.
 * https://operations.osmfoundation.org/policies/nominatim/
 *
 * The policy lists under "Unacceptable Use":
 *
 *   "Auto-complete search — This is not yet supported by Nominatim and you
 *    must not implement such a service on the client side using the API."
 *
 * So this component MUST NOT issue a request as a side effect of typing, no
 * matter how generously debounced. A request is only ever sent in response to
 * an explicit user submission: pressing Enter, or activating the search
 * button. If you refactor this file, do not reintroduce a fetch inside the
 * input's onChange handler.
 *
 * The policy also requires that results are cached and that clients do not
 * repeatedly send the same query. searchPlaces() caches for 7 days, and
 * `lastSubmitted` below short-circuits a resubmission of the identical string.
 */
export default function SearchBox({ label, value, onPick, placeholder }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [hint, setHint] = useState(false);
  const box = useRef(null);
  const lastSubmitted = useRef('');

  useEffect(() => {
    if (value) setQ(value.name);
  }, [value]);

  useEffect(() => {
    function away(e) {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  /**
   * Typing only updates local state. No network call here — see the note at
   * the top of this file.
   */
  function change(text) {
    setQ(text);
    setHint(text.trim().length >= 2);
    if (list) {
      setList(null);
      setOpen(false);
    }
  }

  /** The only place a Nominatim request is issued. User-initiated. */
  async function submit() {
    const term = q.trim();
    if (term.length < 2 || busy) return;

    // Don't re-send an identical query (policy: repeated identical queries
    // may be classified as faulty and blocked).
    if (term === lastSubmitted.current && list) {
      setOpen(true);
      return;
    }

    setBusy(true);
    setHint(false);
    setOpen(true);
    try {
      const r = await searchPlaces(term);
      lastSubmitted.current = term;
      setList(r);
      setActive(0);
    } catch {
      setList([]);
    } finally {
      setBusy(false);
    }
  }

  function pick(p) {
    onPick(p);
    setQ(p.name);
    setOpen(false);
    setList(null);
    setHint(false);
  }

  function key(e) {
    // Enter submits the search when there are no results to choose from yet.
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && list?.length) pick(list[active]);
      else submit();
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || !list?.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
  }

  const canSearch = q.trim().length >= 2 && !busy;

  return (
    <div className="field search" ref={box}>
      <label>{label}</label>
      <div className="search-in">
        <input
          value={q}
          placeholder={placeholder}
          onChange={(e) => change(e.target.value)}
          onFocus={() => list && setOpen(true)}
          onKeyDown={key}
          enterKeyHint="search"
          aria-label={label}
        />
        {q && !busy && (
          <button
            className="clear"
            onClick={() => {
              setQ('');
              setList(null);
              setHint(false);
              lastSubmitted.current = '';
              onPick(null);
            }}
            aria-label="Clear"
          >
            ×
          </button>
        )}
        <button
          className="go"
          onClick={submit}
          disabled={!canSearch}
          aria-label={`Search for ${label}`}
          title="Search"
        >
          {busy ? '⏳' : '🔍'}
        </button>
      </div>

      {hint && !open && (
        <div className="search-hint">Press Enter or tap 🔍 to search</div>
      )}

      {open && list && (
        <div className="results">
          {list.length === 0 ? (
            <div className="r-empty">No places matched “{q}”. Try a city name.</div>
          ) : (
            list.map((p, i) => (
              <button
                key={p.id}
                className={i === active ? 'active' : ''}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
              >
                <div className="r-name">
                  {p.name}
                  {p.countryName ? `, ${p.countryName}` : ''}
                </div>
                <div className="r-sub">{p.display}</div>
              </button>
            ))
          )}
          {/* Policy: "Clearly display attribution as suitable for your medium." */}
          <div className="r-attrib">
            Search by{' '}
            <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noreferrer">
              Nominatim
            </a>{' '}
            · data ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>{' '}
            contributors
          </div>
        </div>
      )}
    </div>
  );
}
