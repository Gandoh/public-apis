export function Card({ title, source, href, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-h">
          <h3>{title}</h3>
          {source && (
            <a className="src" href={href} target="_blank" rel="noopener noreferrer">
              {source} ↗
            </a>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export function Row({ k, v, tone }) {
  return (
    <div className="row">
      <span className="rk">{k}</span>
      <span className={`rv ${tone ? 'tone-' + tone : ''}`}>{v}</span>
    </div>
  );
}

export function Stat({ k, v, n, tone }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className={`v ${tone ? 'tone-' + tone : ''}`}>{v}</div>
      {n && <div className="n">{n}</div>}
    </div>
  );
}

export function Skeleton({ lines = 3 }) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="sk sk-line" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrBox({ children }) {
  return (
    <div className="err-box">
      {children}
      <small>Free third-party API — usually a rate limit or a temporary outage.</small>
    </div>
  );
}

export function Ring({ value, tone = 'good' }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const color = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', neutral: 'var(--dim)' }[tone];
  return (
    <div className="ring">
      <svg width="88" height="88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: 'stroke-dashoffset .7s ease' }}
        />
      </svg>
      <div className="val">{value == null ? '—' : value}</div>
    </div>
  );
}
