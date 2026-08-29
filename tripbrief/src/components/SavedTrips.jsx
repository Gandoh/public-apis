import { MONTHS } from '../lib/util.js';

export default function SavedTrips({ trips, onOpen, onRemove }) {
  if (!trips.length) return null;
  return (
    <div className="saved">
      <span className="saved-lbl">Saved</span>
      <div className="saved-list">
        {trips.map((t) => (
          <span className="saved-chip" key={t.id}>
            <button onClick={() => onOpen(t)} title={`Open ${t.a.name}${t.b ? ' vs ' + t.b.name : ''} in ${MONTHS[t.month - 1]}`}>
              {t.a.name}
              {t.b ? ` vs ${t.b.name}` : ''}
              <em> · {MONTHS[t.month - 1].slice(0, 3)}</em>
            </button>
            <button className="x" onClick={() => onRemove(t.id)} aria-label="Remove saved trip">×</button>
          </span>
        ))}
      </div>
    </div>
  );
}
