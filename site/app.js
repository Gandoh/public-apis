/*
 * API Scout — a zero-dependency catalog experience.
 *
 * Monetization hook: set partnerEmail below before launch, then the provider
 * CTA can open a real sales inbox. The current build intentionally ships with
 * a copyable sponsor pitch instead of pretending a lead form has a backend.
 */
const config = {
  partnerEmail: "",
  pageSize: 12,
};

const state = {
  catalog: [],
  categories: [],
  query: "",
  category: "All",
  auth: "All",
  https: false,
  cors: false,
  sort: "relevance",
  page: 1,
  saved: new Set(loadSaved()),
  activeDetails: null,
};

const elements = {};
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function loadSaved() {
  try {
    const value = JSON.parse(localStorage.getItem("api-scout-shortlist") || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function persistSaved() {
  localStorage.setItem("api-scout-shortlist", JSON.stringify([...state.saved]));
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[character]));
}

function safeURL(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function titleInitial(name) {
  return escapeHTML((name || "A").trim().charAt(0).toUpperCase());
}

function countLabel(number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2800);
}

function getFilteredAPIs() {
  const queryTerms = state.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let items = state.catalog.filter((api) => {
    const searchable = `${api.name} ${api.description} ${api.category} ${api.host}`.toLowerCase();
    const queryMatches = queryTerms.every((term) => searchable.includes(term));
    return queryMatches
      && (state.category === "All" || api.category === state.category)
      && (state.auth === "All" || api.auth === state.auth)
      && (!state.https || api.https === "Yes")
      && (!state.cors || api.cors === "Yes");
  });

  if (state.sort === "name") {
    items.sort((a, b) => a.name.localeCompare(b.name));
  } else if (state.sort === "category") {
    items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  } else if (state.query) {
    const query = state.query.toLowerCase();
    items.sort((a, b) => relevanceScore(b, query) - relevanceScore(a, query));
  }
  return items;
}

function relevanceScore(api, query) {
  let score = 0;
  if (api.name.toLowerCase() === query) score += 100;
  if (api.name.toLowerCase().startsWith(query)) score += 45;
  if (api.category.toLowerCase() === query) score += 35;
  if (api.name.toLowerCase().includes(query)) score += 25;
  if (api.description.toLowerCase().includes(query)) score += 9;
  if (api.auth === "No") score += 1;
  if (api.https === "Yes") score += 1;
  return score;
}

function renderMetrics() {
  const noAuth = state.catalog.filter((api) => api.auth === "No").length;
  const https = state.catalog.filter((api) => api.https === "Yes").length;
  elements.metricApis.textContent = countLabel(state.catalog.length);
  elements.metricCategories.textContent = state.categories.length;
  elements.metricNoAuth.textContent = countLabel(noAuth);
  elements.metricHttps.textContent = `${Math.round((https / state.catalog.length) * 100)}%`;
}

function setSelectOptions(select, options, firstLabel) {
  select.innerHTML = `<option value="All">${escapeHTML(firstLabel)}</option>`;
  options.forEach((option) => {
    const value = typeof option === "string" ? option : option.name;
    const label = typeof option === "string" ? option : `${option.name} (${option.count})`;
    select.insertAdjacentHTML("beforeend", `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`);
  });
}

function renderCategoryControls() {
  setSelectOptions(elements.categoryFilter, state.categories, "All categories");
  setSelectOptions(elements.matchCategory, state.categories, "Anything / I am exploring");
  const popular = state.categories.slice(0, 7);
  elements.categoryStrip.innerHTML = [
    `<button class="category-pill active" data-category-pill="All" type="button">All APIs</button>`,
    ...popular.map((category) => `<button class="category-pill" data-category-pill="${escapeHTML(category.name)}" type="button">${escapeHTML(category.name)}</button>`),
  ].join("");
}

function renderResults() {
  const items = getFilteredAPIs();
  const totalPages = Math.max(1, Math.ceil(items.length / config.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * config.pageSize;
  const pageItems = items.slice(start, start + config.pageSize);

  elements.resultsCount.textContent = `${items.length.toLocaleString()} ${items.length === 1 ? "API" : "APIs"}`;
  elements.resultsContext.textContent = state.query || state.category !== "All" || state.auth !== "All" || state.https || state.cors
    ? "matching your current filters"
    : "across the open catalog";

  if (!pageItems.length) {
    elements.apiGrid.innerHTML = `<div class="empty-state"><strong>No exact matches yet.</strong><span>Try a broader search or reset the filters to see more of the catalog.</span><br /><button class="button button-primary button-small" type="button" data-action="reset" style="margin-top:18px">Reset the hunt</button></div>`;
    elements.pagination.innerHTML = "";
    return;
  }

  const cards = pageItems.map(renderAPICard);
  // This is the intentionally visible revenue slot: it is labeled and can be
  // replaced with a real sponsor once the owner has a partner agreement.
  if (state.page === 1 && !state.query && state.category === "All") cards.splice(4, 0, renderSponsorCard());
  elements.apiGrid.innerHTML = cards.join("");
  renderPagination(totalPages);
}

function renderAPICard(api) {
  const saved = state.saved.has(api.id);
  const url = safeURL(api.url);
  return `<article class="api-card">
    <div class="card-top"><span class="category-label">${escapeHTML(api.category)}</span><button class="save-button ${saved ? "saved" : ""}" type="button" data-save="${escapeHTML(api.id)}" aria-label="${saved ? "Remove" : "Save"} ${escapeHTML(api.name)}">${saved ? "♥" : "♡"}</button></div>
    <h3><a href="${escapeHTML(url)}" target="_blank" rel="noreferrer">${escapeHTML(api.name)}</a></h3>
    <p>${escapeHTML(api.description || "No description supplied.")}</p>
    <div class="tag-row"><span class="tag ${api.auth === "No" ? "good" : ""}">${escapeHTML(api.auth)} auth</span><span class="tag ${api.https === "Yes" ? "good" : "neutral"}">${api.https === "Yes" ? "HTTPS" : "No HTTPS"}</span><span class="tag ${api.cors === "Yes" ? "good" : "neutral"}>${api.cors === "Yes" ? "CORS" : "CORS ${escapeHTML(api.cors)}"}</span></div>
    <div class="card-bottom"><span class="domain">${escapeHTML(api.host)}</span><button class="details-button" type="button" data-details="${escapeHTML(api.id)}">Details →</button></div>
  </article>`;
}

function renderSponsorCard() {
  return `<article class="sponsor-card"><div><div class="sponsor-eyebrow">PARTNER FEATURE / CLEARLY LABELED</div><h3>Reach developers at the exact moment they need your API.</h3><p>One thoughtful placement can fund the catalog while helping builders find a production-ready shortcut.</p></div><button class="sponsor-action" type="button" data-action="partner">Explore partner placements ↗</button></article>`;
}

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    elements.pagination.innerHTML = "";
    return;
  }
  const buttons = [`<button class="page-button" type="button" data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""}>←</button>`];
  for (let page = 1; page <= totalPages; page += 1) {
    if (totalPages > 7 && page > 2 && page < totalPages - 1 && Math.abs(page - state.page) > 1) {
      if (!buttons.some((button) => button.includes("ellipsis"))) buttons.push(`<span class="page-button" style="display:grid;place-items:center;border:0;background:transparent" data-ellipsis>…</span>`);
      continue;
    }
    buttons.push(`<button class="page-button ${page === state.page ? "active" : ""}" type="button" data-page="${page}">${page}</button>`);
  }
  buttons.push(`<button class="page-button" type="button" data-page="${state.page + 1}" ${state.page === totalPages ? "disabled" : ""}>→</button>`);
  elements.pagination.innerHTML = buttons.join("");
}

function renderShortlist() {
  const savedAPIs = state.catalog.filter((api) => state.saved.has(api.id));
  elements.savedCount.textContent = savedAPIs.length;
  elements.shortlistCaption.textContent = savedAPIs.length ? `${savedAPIs.length} saved ${savedAPIs.length === 1 ? "option" : "options"} · kept locally in this browser` : "Your saved APIs will appear here.";
  if (!savedAPIs.length) {
    elements.shortlistGrid.innerHTML = `<div class="shortlist-empty"><p>Nothing saved yet. When an API looks promising, tap its bookmark and build your own mini-stack.</p><a class="button button-dark button-small" href="#explore">Browse the catalog <span class="button-arrow">↓</span></a></div>`;
    return;
  }
  elements.shortlistGrid.innerHTML = savedAPIs.slice(0, 6).map((api) => `<article class="saved-card"><span class="saved-card-mark">${titleInitial(api.name)}</span><div><h3>${escapeHTML(api.name)}</h3><p>${escapeHTML(api.category)} · ${escapeHTML(api.host)}</p></div><button type="button" data-details="${escapeHTML(api.id)}">Open →</button></article>`).join("");
}

function openDetails(id) {
  const api = state.catalog.find((item) => item.id === id);
  if (!api) return;
  state.activeDetails = api;
  const saved = state.saved.has(api.id);
  const url = safeURL(api.url);
  elements.detailsContent.innerHTML = `<div class="details-hero"><div><div class="details-category">${escapeHTML(api.category)}</div><h2 id="details-title">${escapeHTML(api.name)}</h2><p class="details-host">${escapeHTML(api.host)}</p></div><button class="save-button ${saved ? "saved" : ""}" type="button" data-save="${escapeHTML(api.id)}" aria-label="${saved ? "Remove" : "Save"} ${escapeHTML(api.name)}">${saved ? "♥" : "♡"}</button></div><p class="details-description">${escapeHTML(api.description || "No description supplied.")}</p><div class="details-tags"><span class="tag ${api.auth === "No" ? "good" : ""}">${escapeHTML(api.auth)} auth</span><span class="tag ${api.https === "Yes" ? "good" : "neutral"}">${api.https === "Yes" ? "HTTPS available" : "HTTPS not listed"}</span><span class="tag ${api.cors === "Yes" ? "good" : "neutral"}>CORS: ${escapeHTML(api.cors)}</span></div><div class="details-actions"><a class="button button-primary" href="${escapeHTML(url)}" target="_blank" rel="noreferrer">Visit provider <span class="button-arrow">↗</span></a><button class="button button-secondary" type="button" data-copy-url="${escapeHTML(url)}">Copy link</button></div>`;
  elements.detailsModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModals() {
  $$(".modal-backdrop").forEach((modal) => { modal.hidden = true; });
  document.body.style.overflow = "";
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    showToast("Copy is unavailable here — select the text manually.");
  }
}

function sponsorPitch() {
  return `Subject: API Scout partner placement\n\nHi,\n\nI run API Scout, a developer-focused directory built on the public-apis catalog. I am opening a small number of clearly labeled partner placements for API providers.\n\nThe placement is designed to appear alongside relevant discovery results, with useful context rather than interruption. Interested in seeing the audience, format, and launch options?\n\nBest,\n[Your name]`;
}

function handlePartnerAction() {
  if (config.partnerEmail) {
    window.location.href = `mailto:${config.partnerEmail}?subject=${encodeURIComponent("API Scout partner placement")}&body=${encodeURIComponent(sponsorPitch())}`;
    return;
  }
  copyText(sponsorPitch(), "Sponsor pitch copied. Add your email in site/app.js, then send it to a relevant API provider.");
}

function resetFilters() {
  state.query = "";
  state.category = "All";
  state.auth = "All";
  state.https = false;
  state.cors = false;
  state.sort = "relevance";
  state.page = 1;
  elements.searchInput.value = "";
  elements.categoryFilter.value = "All";
  elements.noAuthFilter.checked = false;
  elements.httpsFilter.checked = false;
  elements.corsFilter.checked = false;
  elements.sortFilter.value = "relevance";
  $$("[data-category-pill]").forEach((pill) => pill.classList.toggle("active", pill.dataset.categoryPill === "All"));
  renderResults();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => { state.query = event.target.value; state.page = 1; renderResults(); });
  elements.categoryFilter.addEventListener("change", (event) => { state.category = event.target.value; state.page = 1; syncCategoryPills(); renderResults(); });
  elements.sortFilter.addEventListener("change", (event) => { state.sort = event.target.value; state.page = 1; renderResults(); });
  elements.noAuthFilter.addEventListener("change", (event) => { state.auth = event.target.checked ? "No" : "All"; state.page = 1; renderResults(); });
  elements.httpsFilter.addEventListener("change", (event) => { state.https = event.target.checked; state.page = 1; renderResults(); });
  elements.corsFilter.addEventListener("change", (event) => { state.cors = event.target.checked; state.page = 1; renderResults(); });

  document.addEventListener("click", (event) => {
    const save = event.target.closest("[data-save]");
    if (save) {
      const id = save.dataset.save;
      if (state.saved.has(id)) state.saved.delete(id); else state.saved.add(id);
      persistSaved();
      renderResults();
      renderShortlist();
      if (!elements.detailsModal.hidden && state.activeDetails?.id === id) openDetails(id);
      showToast(state.saved.has(id) ? "Added to your shortlist." : "Removed from your shortlist.");
      return;
    }

    const details = event.target.closest("[data-details]");
    if (details) { openDetails(details.dataset.details); return; }

    const page = event.target.closest("[data-page]");
    if (page && !page.disabled) {
      state.page = Number(page.dataset.page);
      renderResults();
      elements.apiGrid.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const pill = event.target.closest("[data-category-pill]");
    if (pill) {
      state.category = pill.dataset.categoryPill;
      state.page = 1;
      elements.categoryFilter.value = state.category;
      syncCategoryPills();
      renderResults();
      return;
    }

    const action = event.target.closest("[data-action]");
    if (action) {
      const type = action.dataset.action;
      if (type === "match") openMatchModal();
      if (type === "partner" || type === "copy-pitch") handlePartnerAction();
      if (type === "reset") resetFilters();
    }

    if (event.target.matches("[data-close-modal]") || event.target.classList.contains("modal-backdrop")) closeModals();

    const copy = event.target.closest("[data-copy-url]");
    if (copy) copyText(copy.dataset.copyUrl, "Provider link copied.");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModals();
    if ((event.key === "/" || (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey))) && document.activeElement.tagName !== "INPUT") {
      event.preventDefault();
      elements.searchInput.focus();
    }
    if (event.key.toLowerCase() === "j" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); openMatchModal(); }
  });

  elements.clearFilters.addEventListener("click", resetFilters);
  elements.matchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.category = elements.matchCategory.value;
    state.auth = elements.matchAuth.value;
    state.https = elements.matchHttps.checked;
    state.cors = elements.matchCors.checked;
    state.query = "";
    state.page = 1;
    elements.searchInput.value = "";
    elements.categoryFilter.value = state.category;
    elements.noAuthFilter.checked = state.auth === "No";
    elements.httpsFilter.checked = state.https;
    elements.corsFilter.checked = state.cors;
    syncCategoryPills();
    closeModals();
    renderResults();
    document.querySelector("#explore").scrollIntoView({ behavior: "smooth" });
    showToast("Your tailored shortlist is ready.");
  });
}

function syncCategoryPills() {
  $$("[data-category-pill]").forEach((pill) => pill.classList.toggle("active", pill.dataset.categoryPill === state.category));
}

function openMatchModal() {
  elements.matchModal.hidden = false;
  document.body.style.overflow = "hidden";
  elements.matchCategory.focus();
}

function cacheElements() {
  elements.toast = $("#toast");
  elements.metricApis = $("#metric-apis");
  elements.metricCategories = $("#metric-categories");
  elements.metricNoAuth = $("#metric-no-auth");
  elements.metricHttps = $("#metric-https");
  elements.searchInput = $("#search-input");
  elements.categoryFilter = $("#category-filter");
  elements.sortFilter = $("#sort-filter");
  elements.noAuthFilter = $("#no-auth-filter");
  elements.httpsFilter = $("#https-filter");
  elements.corsFilter = $("#cors-filter");
  elements.categoryStrip = $("#category-strip");
  elements.apiGrid = $("#api-grid");
  elements.pagination = $("#pagination");
  elements.resultsCount = $("#results-count");
  elements.resultsContext = $("#results-context");
  elements.savedCount = $("#saved-count");
  elements.shortlistCaption = $("#shortlist-caption");
  elements.shortlistGrid = $("#shortlist-grid");
  elements.clearFilters = $("#clear-filters");
  elements.detailsModal = $("#details-modal");
  elements.detailsContent = $("#details-content");
  elements.matchModal = $("#match-modal");
  elements.matchForm = $("#match-form");
  elements.matchCategory = $("#match-category");
  elements.matchAuth = $("#match-auth");
  elements.matchHttps = $("#match-https");
  elements.matchCors = $("#match-cors");
}

async function init() {
  cacheElements();
  bindEvents();
  renderShortlist();
  try {
    const response = await fetch("data/apis.json");
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const payload = await response.json();
    state.catalog = payload.apis || [];
    state.categories = (payload.categories || []).map((category) => ({ ...category }));
    renderMetrics();
    renderCategoryControls();
    renderResults();
    renderShortlist();
  } catch (error) {
    elements.resultsCount.textContent = "Catalog unavailable";
    elements.resultsContext.textContent = "Run the site through a local web server";
    elements.apiGrid.innerHTML = `<div class="empty-state"><strong>We could not load the catalog.</strong><span>Try <code>python3 -m http.server 8000 --directory site</code> and open the local address.</span></div>`;
    console.error(error);
  }
}

document.addEventListener("DOMContentLoaded", init);
