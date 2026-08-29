import { comfortScore, temp, fmt, haversine, tzDelta, MONTHS } from '../lib/util.js';

function Item({ k, v, n }) {
  return (
    <div className="vitem">
      <div className="vk">{k}</div>
      <div className="vv">{v}</div>
      {n && <div className="vn">{n}</div>}
    </div>
  );
}

export default function Verdict({ a, b, month, unit }) {
  if (!a?.place || !b?.place) return null;
  if (a.loading || b.loading) return null;

  const csA = comfortScore(a.climate);
  const csB = comfortScore(b.climate);
  const nameA = a.place.name;
  const nameB = b.place.name;

  const items = [];

  // Weather verdict
  if (csA && csB) {
    const win = csA.score === csB.score ? null : csA.score > csB.score ? nameA : nameB;
    items.push(
      <Item
        key="w"
        k={`Best weather in ${MONTHS[month - 1]}`}
        v={win || 'Tied'}
        n={`${csA.score} vs ${csB.score} comfort score`}
      />
    );
  }

  // Warmth
  if (csA && csB) {
    const warmer = csA.mid > csB.mid ? nameA : nameB;
    items.push(
      <Item
        key="t"
        k="Warmer"
        v={warmer}
        n={`${temp(Math.max(csA.mid, csB.mid), unit)} vs ${temp(Math.min(csA.mid, csB.mid), unit)} average`}
      />
    );
  }

  // Drier
  if (csA && csB) {
    const drier = csA.totalRain < csB.totalRain ? nameA : nameB;
    items.push(
      <Item
        key="r"
        k="Drier"
        v={drier}
        n={`${fmt(Math.min(csA.totalRain, csB.totalRain))} vs ${fmt(Math.max(csA.totalRain, csB.totalRain))} mm`}
      />
    );
  }

  // Air quality
  const aqA = a.air?.current?.european_aqi;
  const aqB = b.air?.current?.european_aqi;
  if (aqA != null && aqB != null) {
    items.push(
      <Item key="aq" k="Cleaner air" v={aqA < aqB ? nameA : nameB} n={`AQI ${Math.round(Math.min(aqA, aqB))} vs ${Math.round(Math.max(aqA, aqB))}`} />
    );
  }

  // Distance apart
  items.push(
    <Item
      key="d"
      k="Distance apart"
      v={`${fmt(haversine(a.place, b.place))} km`}
      n="Great-circle distance"
    />
  );

  // Jet lag
  const dA = a.forecast?.timezone ? tzDelta(a.forecast.timezone) : null;
  const dB = b.forecast?.timezone ? tzDelta(b.forecast.timezone) : null;
  if (dA != null && dB != null) {
    const easier = Math.abs(dA) <= Math.abs(dB) ? nameA : nameB;
    items.push(
      <Item
        key="tz"
        k="Less jet lag"
        v={Math.abs(dA) === Math.abs(dB) ? 'Same' : easier}
        n={`${dA > 0 ? '+' : ''}${dA}h vs ${dB > 0 ? '+' : ''}${dB}h from you`}
      />
    );
  }

  // Cheaper money — compare only if both share your home currency base
  const rA = a.rate?.rates?.[a.destCurrency];
  const rB = b.rate?.rates?.[b.destCurrency];
  if (rA && rB && a.destCurrency !== b.destCurrency) {
    items.push(
      <Item
        key="c"
        k="Currencies"
        v={`${a.destCurrency} / ${b.destCurrency}`}
        n={`${fmt(rA, rA < 10 ? 3 : 1)} vs ${fmt(rB, rB < 10 ? 3 : 1)} per unit`}
      />
    );
  }

  if (!items.length) return null;

  return (
    <div className="wrap">
      <div className="verdict">
        <h3>Head to head · {nameA} vs {nameB}</h3>
        <div className="verdict-grid">{items}</div>
      </div>
    </div>
  );
}
