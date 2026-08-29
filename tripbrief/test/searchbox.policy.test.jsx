/**
 * Nominatim usage-policy regression test.
 *
 * The policy forbids client-side autocomplete, so this asserts that typing
 * never issues a request and that only an explicit submit does. Run with a
 * jsdom harness; see MONETISATION.md and the header of SearchBox.jsx.
 *
 * Renders the real SearchBox against a stubbed fetch and asserts that typing
 * never triggers a network request — the Nominatim policy requirement.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import SearchBox from '../src/components/SearchBox.jsx';

const calls = [];
globalThis.fetch = async (url) => {
  calls.push(String(url));
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify([
        {
          osm_type: 'N', osm_id: 1, lat: '8.4844', lon: '-13.2344',
          display_name: 'Freetown, Sierra Leone', name: 'Freetown', type: 'city',
          address: { city: 'Freetown', country: 'Sierra Leone', country_code: 'sl' },
        },
      ]),
  };
};

const el = document.createElement('div');
document.body.appendChild(el);
const root = createRoot(el);

const results = [];
const check = (name, pass, detail = '') =>
  results.push({ name, pass, detail });

await act(async () => {
  root.render(<SearchBox label="Destination A" value={null} onPick={() => {}} placeholder="City" />);
});

const input = el.querySelector('input');

// --- Type a full city name, one character at a time -----------------------
const word = 'Freetown';
for (const ch of word) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      globalThis.HTMLInputElement.prototype, 'value').set;
    setter.call(input, input.value + ch);
    input.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
  });
}

check('Typing 8 characters issues ZERO requests', calls.length === 0,
  `fetch called ${calls.length} time(s)`);

// Wait well past the old 550ms debounce to be certain nothing is queued.
await new Promise((r) => setTimeout(r, 1200));
await act(async () => {});
check('Still zero requests 1.2s after typing stops', calls.length === 0,
  `fetch called ${calls.length} time(s)`);

check('Hint prompts the user to submit',
  /Press Enter or tap/.test(el.textContent), el.textContent.slice(0, 80));

// --- Explicit submit via the button ---------------------------------------
const goBtn = el.querySelector('button.go');
check('Search button is present and enabled', !!goBtn && !goBtn.disabled);

await act(async () => {
  goBtn.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }));
});
await act(async () => {});

check('Clicking search issues exactly ONE request', calls.length === 1,
  `fetch called ${calls.length} time(s)`);
check('Request went to Nominatim /search',
  (calls[0] || '').includes('nominatim.openstreetmap.org/search'), calls[0] || '(none)');
check('Results rendered', /Freetown/.test(el.textContent));
check('Attribution shown with results',
  /OpenStreetMap/.test(el.textContent) && /Nominatim/.test(el.textContent));

// --- Resubmitting the identical term must not re-hit the network ----------
await act(async () => {
  goBtn.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }));
});
await act(async () => {});
check('Re-submitting the same term sends NO extra request', calls.length === 1,
  `fetch called ${calls.length} time(s)`);

// --- Enter key submits a new term -----------------------------------------
await act(async () => {
  const setter = Object.getOwnPropertyDescriptor(
    globalThis.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'Accra');
  input.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
});
check('Editing the term still issues no request', calls.length === 1,
  `fetch called ${calls.length} time(s)`);

await act(async () => {
  input.dispatchEvent(new globalThis.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
});
await act(async () => {});
check('Enter submits, issuing one further request', calls.length === 2,
  `fetch called ${calls.length} time(s)`);

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? '  \x1b[32m✓\x1b[0m' : '  \x1b[31m✗\x1b[0m'} ${r.name}${r.detail ? `  \x1b[90m${r.detail}\x1b[0m` : ''}`);
}
console.log(`\n  ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
