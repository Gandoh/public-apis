import { Card } from './bits.jsx';
import { packingList } from '../lib/insights.js';
import { MONTHS } from '../lib/util.js';

/** A packing list derived from the actual forecast and climate, not a template. */
export default function Packing({ state, month, homeCountry }) {
  const items = packingList({
    climate: state.climate,
    forecast: state.forecast,
    country: state.country,
    homeCountry,
  });

  return (
    <Card title={`What to pack for ${MONTHS[month - 1]}`}>
      <ul className="pack">
        {items.map((i, n) => (
          <li key={n}>
            <span className="pk-ico" aria-hidden="true">{i.icon}</span>
            <span className="pk-body">
              <b>{i.label}</b>
              <span className="muted">{i.why}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
