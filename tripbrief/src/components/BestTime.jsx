import { Card } from './bits.jsx';
import { scoreBand, MONTHS } from '../lib/util.js';

/**
 * Twelve-month comfort chart. Clicking a bar changes the trip month, which
 * is the fastest way to answer "so when should I actually go?".
 */
export default function BestTime({ scores, window: win, month, onPickMonth }) {
  if (!scores) return null;
  const valid = scores.filter((s) => s.score != null);
  if (valid.length < 6) return null;

  return (
    <Card title="Best time to visit" source="Open-Meteo Archive" href="https://open-meteo.com/en/docs/historical-weather-api">
      {win && (
        <div className="bt-lede">
          Sweet spot: <b>{win.length >= 12 ? 'good all year' : win.from === win.to ? win.from : `${win.from} – ${win.to}`}</b>
          {win.peak && <span className="muted"> · peaks in {win.peak.name}</span>}
        </div>
      )}
      <div className="bt-chart" role="group" aria-label="Comfort score by month">
        {scores.map((s) => {
          const tone = scoreBand(s.score).tone;
          const sel = s.month === month;
          return (
            <button
              key={s.month}
              className={`bt-col ${sel ? 'sel' : ''}`}
              onClick={() => onPickMonth(s.month)}
              title={`${s.name}: ${s.score ?? '—'}/100 — click to compare this month`}
              aria-label={`${s.name}, score ${s.score ?? 'unknown'}`}
              aria-pressed={sel}
            >
              <span className="bt-bar-wrap">
                <span className={`bt-bar tone-bg-${tone}`} style={{ height: `${Math.max(4, s.score ?? 0)}%` }} />
              </span>
              <span className="bt-lbl">{s.short}</span>
            </button>
          );
        })}
      </div>
      <div className="bt-foot muted">
        Comfort score for {MONTHS[month - 1]} highlighted. Click any month to re-run the comparison.
      </div>
    </Card>
  );
}
