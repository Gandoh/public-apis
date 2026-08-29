import { useEffect, useRef, useState } from 'react';
import { searchPlaces } from '../api/sources.js';

export default function SearchBox({ label, value, onPick, placeholder }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef(null);
  const timer = useRef(null);

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

  function change(text) {
    setQ(text);
    setOpen(true);
    clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setList(null);
      return;
    }
    // Nominatim asks for max ~1 req/sec — debounce generously.
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await searchPlaces(text);
        setList(r);
        setActive(0);
      } catch {
        setList([]);
      } finally {
        setBusy(false);
      }
    }, 550);
  }

  function pick(p) {
    onPick(p);
    setQ(p.name);
    setOpen(false);
    setList(null);
  }

  function key(e) {
    if (!open || !list?.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(list[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="field search" ref={box}>
      <label>{label}</label>
      <div className="search-in">
        <span className="glyph">🔍</span>
        <input
          value={q}
          placeholder={placeholder}
          onChange={(e) => change(e.target.value)}
          onFocus={() => list && setOpen(true)}
          onKeyDown={key}
          aria-label={label}
        />
        {busy && <span className="glyph">⏳</span>}
        {!busy && q && (
          <button
            className="clear"
            onClick={() => {
              setQ('');
              setList(null);
              onPick(null);
            }}
            aria-label="Clear"
          >
            ×
          </button>
        )}
      </div>

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
        </div>
      )}
    </div>
  );
}
