/* app.js — renders the widget grid and drives the fetches. */

const TIMEOUT_MS = 12000;

async function fetchJSON(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' }, ...opts });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch { throw new Error(`HTTP ${res.status} — response was not JSON`); }
    if (!res.ok) {
      const msg = json.message || json.error || json.detail || `HTTP ${res.status}`;
      if (res.status === 429) throw new Error('429 rate-limited — this API throttles anonymous callers. Wait a minute and retry.');
      throw new Error(typeof msg === 'string' ? msg : `HTTP ${res.status}`);
    }
    return json;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Timed out after ${TIMEOUT_MS / 1000}s`);
    if (e instanceof TypeError) throw new Error('Network/CORS failure — the API may be down or blocked by your network.');
    throw e;
  } finally { clearTimeout(t); }
}

const grid = document.getElementById('grid');
const tpl = document.getElementById('card-tpl');
const cards = new Map();

function buildCard(w) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.hidden = false;
  node.dataset.cat = w.cat;
  node.dataset.id = w.id;
  node.querySelector('.card-title').textContent = w.title;
  node.querySelector('.card-desc').textContent = w.desc;
  node.querySelector('.cat-badge').textContent = w.cat;
  const docs = node.querySelector('.docs');
  docs.href = w.docs;

  const controls = node.querySelector('.controls');
  const inputs = {};
  for (const c of w.controls) {
    let el;
    if (c.type === 'select') {
      el = document.createElement('select');
      for (const o of c.options) {
        const opt = document.createElement('option');
        opt.value = opt.textContent = o;
        el.appendChild(opt);
      }
    } else {
      el = document.createElement('input');
      el.placeholder = c.placeholder || '';
    }
    el.value = c.value ?? '';
    el.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
    controls.appendChild(el);
    inputs[c.key] = el;
  }
  const btn = document.createElement('button');
  btn.className = 'run';
  btn.textContent = '▶ Run';
  btn.addEventListener('click', () => run());
  controls.appendChild(btn);

  const out = node.querySelector('.output');
  const reqEl = node.querySelector('.req');
  const jsonEl = node.querySelector('.json');

  async function run() {
    btn.disabled = true;
    out.innerHTML = '<div class="spinner">⏳ calling the API…</div>';
    const params = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value]));
    const t0 = performance.now();
    try {
      const { url, data } = await w.run(params);
      const ms = Math.round(performance.now() - t0);
      reqEl.textContent = 'GET ' + url;
      jsonEl.textContent = JSON.stringify(data, null, 2).slice(0, 20000);
      out.innerHTML = w.render(data);
      const stamp = document.createElement('div');
      stamp.className = 'muted';
      stamp.style.marginTop = '8px';
      stamp.textContent = `✓ ${ms} ms · ${new Date().toLocaleTimeString()}`;
      out.appendChild(stamp);
      node.dataset.state = 'ok';
      return true;
    } catch (e) {
      out.innerHTML = `<div class="err">✗ ${String(e.message || e)}
        <small>Live third-party API — failures usually mean rate limiting, a temporary outage, or a network filter.</small></div>`;
      node.dataset.state = 'bad';
      return false;
    } finally { btn.disabled = false; }
  }

  cards.set(w.id, { node, run, title: w.title });
  grid.appendChild(node);
}

WIDGETS.forEach(buildCard);
document.getElementById('stat-widgets').textContent = WIDGETS.length;

/* ---- category filter chips ---- */
const cats = ['All', ...[...new Set(WIDGETS.map(w => w.cat))].sort()];
const filters = document.getElementById('filters');
cats.forEach((c, i) => {
  const b = document.createElement('button');
  b.className = 'chip' + (i === 0 ? ' on' : '');
  b.textContent = c;
  b.onclick = () => {
    [...filters.children].forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    for (const { node } of cards.values())
      node.style.display = (c === 'All' || node.dataset.cat === c) ? '' : 'none';
  };
  filters.appendChild(b);
});

/* ---- bulk actions ---- */
async function runAll() {
  const btn = document.getElementById('run-all');
  btn.disabled = true;
  const visible = [...cards.values()].filter(c => c.node.style.display !== 'none');
  // small concurrency limit so we don't hammer everything at once
  const queue = [...visible];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) await queue.shift().run();
  });
  await Promise.all(workers);
  btn.disabled = false;
}
document.getElementById('run-all').onclick = runAll;

document.getElementById('health').onclick = async () => {
  const box = document.getElementById('health-report');
  box.hidden = false;
  box.innerHTML = '<span class="hr-item">Running every widget and reporting reachability…</span>';
  await runAll();
  const items = [...cards.values()].map(c => {
    const ok = c.node.dataset.state === 'ok';
    return `<span class="hr-item ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${c.title}</span>`;
  });
  const okN = [...cards.values()].filter(c => c.node.dataset.state === 'ok').length;
  box.innerHTML = `<span class="hr-item"><b>${okN}/${cards.size} live</b></span>` + items.join('');
};

/* auto-run a handful of cheap, reliable ones on load */
['catfact', 'geojs', 'open-meteo', 'jokeapi'].forEach(id => cards.get(id)?.run());
