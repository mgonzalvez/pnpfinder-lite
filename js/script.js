/* PnPFinder — client app
   - Loads /data/games.csv
   - Builds filters (dropdowns) for all CSV columns
   - Live filters + search with debounce
   - Card/List view toggle (persisted)
   - Pagination (25 per page)
   - Accessible and responsive
*/

const CSV_URL = "/data/games.csv";
const PAGE_SIZE = 25;

// Columns as provided
const COLUMNS = [
  "Game Title","Designer","Publisher","Free or Paid","Price","Number of Players","Playtime","Age Range",
  "Theme","Main Mechanism","Secondary Mechanism","Gameplay Complexity","Gameplay Mode","Game Category",
  "PnP Crafting Challenge Level","One-Sentence Short Description","Long Description","Download Link",
  "Secondary Download Link","Print Components","Other Components","Languages","Release Year","Game Image",
  "Curated Lists","Report Dead Link"
];

// Which columns get text search hits
const SEARCH_FIELDS = [
  "Game Title","Designer","Publisher","One-Sentence Short Description","Long Description","Theme","Main Mechanism","Secondary Mechanism","Curated Lists"
];

// Which columns are “categorical” and best suited for dropdown exact/contains matching.
// We’ll build dropdowns for ALL columns, but some get special normalization (numbers, ranges, lists).
const MULTIVALUE_SEP = /[;,|]/; // split on ; , or |
const MULTIVALUE_FIELDS = new Set(["Languages","Curated Lists","Game Category"]); // fields that may contain multiple values
const URL_FIELDS = new Set(["Download Link","Secondary Download Link","Game Image"]);
const NUMERIC_FIELDS = new Set(["Price","Release Year"]);
const RANGEISH_FIELDS = new Set(["Number of Players","Playtime","Age Range"]); // may contain ranges like "1-4", "30–60", "12+"
const FREEPAID_FIELD = "Free or Paid";

// State
let rawRows = [];
let filteredRows = [];
let currentPage = 1;
let currentView = localStorage.getItem("viewMode") || "cards";
let searchTerm = "";
let activeFilters = {}; // { column: value }

// Elements
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const cardsEl = $("#cards");
const pagerEl = $("#pager");
const pageNumsEl = $("#pageNumbers");
const resultsMetaEl = $("#resultsMeta");
const filtersGridEl = $("#filtersGrid");
const filtersForm = $("#filtersForm");
const qEl = $("#q");
const viewCardsBtn = $("#viewCards");
const viewListBtn = $("#viewList");
const clearBtn = $("#clearFilters");
const applyBtn = $("#applyFilters");
const mainEl = $("#main");

// Utilities
const debounce = (fn, ms=250) => {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

function normalizeStr(v) {
  return (v ?? "").toString().trim();
}
function isEmpty(v) { return v == null || String(v).trim() === ""; }

function parseNumber(v) {
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function parseRangeish(value) {
  // Accept patterns: "1-4", "1 – 4", "30–60", "12+", "2 to 5", "up to 6", "3+" etc.
  const s = String(value || "").toLowerCase().trim();
  if (!s) return null;

  // 12+ => [12, Infinity]
  const plus = s.match(/^(\d+)\s*\+$/);
  if (plus) return [parseInt(plus[1],10), Infinity];

  // 1-4 or 1 – 4 or "2 to 5"
  const dash = s.match(/^(\d+)\s*[-–to]+\s*(\d+)$/);
  if (dash) return [parseInt(dash[1],10), parseInt(dash[2],10)];

  // single number
  const single = s.match(/^(\d+)$/);
  if (single) {
    const n = parseInt(single[1],10);
    return [n, n];
  }

  return null; // fallback to string contains
}

function rangeMatches(value, query) {
  // query is a string selected from dropdown; we do simple contains if not a range
  if (isEmpty(query)) return true;
  const vr = parseRangeish(value);
  const qr = parseRangeish(query);
  if (vr && qr) {
    // overlapping ranges?
    const [a1, a2] = vr;
    const [b1, b2] = qr;
    const hi = Math.min(a2, b2);
    const lo = Math.max(a1, b1);
    return lo <= hi;
  }
  // fallback: string normalize + includes
  return String(value || "").toLowerCase().includes(String(query).toLowerCase());
}

function multivalueContains(value, needle) {
  if (isEmpty(needle)) return true;
  const parts = String(value || "").split(MULTIVALUE_SEP).map(s => s.trim().toLowerCase()).filter(Boolean);
  return parts.includes(String(needle).toLowerCase());
}

function exactOrContains(value, needle) {
  if (isEmpty(needle)) return true;
  return String(value || "").toLowerCase().includes(String(needle).toLowerCase());
}

function numberEquals(value, needle) {
  if (isEmpty(needle)) return true;
  const v = parseNumber(value);
  const n = parseNumber(needle);
  return v !== null && n !== null ? v === n : exactOrContains(value, needle);
}

function freePaidMatch(value, needle) {
  if (isEmpty(needle)) return true;
  const v = String(value || "").toLowerCase();
  if (needle === "Free") return v.includes("free") || parseNumber($("#Price")?.value) === 0;
  if (needle === "Paid") return !v.includes("free");
  return exactOrContains(value, needle);
}

// Build dropdowns from unique values per column
function collectUniqueOptions(rows, column) {
  const set = new Set();
  for (const r of rows) {
    const v = normalizeStr(r[column]);
    if (!v) continue;
    if (MULTIVALUE_FIELDS.has(column)) {
      v.split(MULTIVALUE_SEP).forEach(p => {
        const s = p.trim();
        if (s) set.add(s);
      });
    } else if (RANGEISH_FIELDS.has(column)) {
      // Keep raw strings; many CSVs store common presets ("1-4", "30-60", "12+")
      set.add(v);
    } else if (NUMERIC_FIELDS.has(column)) {
      const n = parseNumber(v);
      if (n !== null) set.add(String(n));
    } else {
      set.add(v);
    }
  }
  // Sort: numbers numerically; years descending; others alpha
  const arr = [...set];
  if (NUMERIC_FIELDS.has(column) || column === "Release Year") {
    return arr.map(parseFloat).filter(n => !Number.isNaN(n)).sort((a,b)=>a-b).map(String);
  }
  return arr.sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));
}

function createSelect(column, options) {
  const id = column.replace(/\s+/g, "_");
  const wrap = document.createElement("div");
  wrap.className = "select";
  const label = document.createElement("label");
  label.setAttribute("for", id);
  label.textContent = column;
  const select = document.createElement("select");
  select.id = id;
  select.name = column;
  const any = document.createElement("option");
  any.value = "";
  any.textContent = "Any";
  select.appendChild(any);

  if (column === FREEPAID_FIELD) {
    ["Free","Paid"].forEach(v => {
      const o = document.createElement("option");
      o.value = v; o.textContent = v;
      select.appendChild(o);
    });
  } else {
    for (const v of options) {
      const o = document.createElement("option");
      o.value = v; o.textContent = v;
      select.appendChild(o);
    }
  }

  wrap.append(label, select);
  return wrap;
}

function buildFiltersUI(rows) {
  filtersGridEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const col of COLUMNS) {
    // We don’t create dropdowns for URL columns
    if (URL_FIELDS.has(col)) continue;
    const opts = collectUniqueOptions(rows, col);
    const sel = createSelect(col, opts);
    frag.appendChild(sel);
  }
  filtersGridEl.appendChild(frag);

  // Wire change handlers for live update
  $$("#filtersGrid select").forEach(sel => {
    sel.addEventListener("change", handleFilterChange);
  });

  clearBtn.addEventListener("click", () => {
    $$("#filtersGrid select").forEach(s => s.value = "");
    activeFilters = {};
    currentPage = 1;
    applyFiltersNow();
  });

  filtersForm.addEventListener("submit", (e) => {
    e.preventDefault();
    // Explicit Apply (redundant with live update, but requested)
    readFiltersFromUI();
    currentPage = 1;
    applyFiltersNow();
  });
}

function readFiltersFromUI() {
  const newFilters = {};
  $$("#filtersGrid select").forEach(sel => {
    const col = sel.name;
    const val = sel.value;
    if (!isEmpty(val)) newFilters[col] = val;
  });
  activeFilters = newFilters;
}

function handleFilterChange() {
  readFiltersFromUI();
  currentPage = 1;
  applyFiltersNow();
}

const handleSearch = debounce(() => {
  searchTerm = qEl.value.trim();
  currentPage = 1;
  applyFiltersNow();
}, 220);

// Filtering logic
function rowMatchesFilters(row) {
  // Per-column dropdowns
  for (const [col, val] of Object.entries(activeFilters)) {
    const cell = row[col];

    if (col === FREEPAID_FIELD) {
      if (!freePaidMatch(cell, val)) return false;
      continue;
    }
    if (MULTIVALUE_FIELDS.has(col)) {
      if (!multivalueContains(cell, val)) return false;
      continue;
    }
    if (NUMERIC_FIELDS.has(col)) {
      if (!numberEquals(cell, val)) return false;
      continue;
    }
    if (RANGEISH_FIELDS.has(col)) {
      if (!rangeMatches(cell, val)) return false;
      continue;
    }
    if (!exactOrContains(cell, val)) return false;
  }

  // Text search across several fields
  if (!isEmpty(searchTerm)) {
    const q = searchTerm.toLowerCase();
    const hit = SEARCH_FIELDS.some(f => String(row[f] || "").toLowerCase().includes(q));
    if (!hit) return false;
  }

  return true;
}

function paginate(rows) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);
  return { total, totalPages, pageRows };
}

function renderCards(rows) {
  const asList = currentView === "list";
  cardsEl.classList.toggle("list", asList);
  cardsEl.innerHTML = "";

  const frag = document.createDocumentFragment();
  for (const r of rows) {
    const li = document.createElement("article");
    li.className = "card";
    li.setAttribute("role", "listitem");

    const title = normalizeStr(r["Game Title"]) || "Untitled";
    const mechanism = normalizeStr(r["Main Mechanism"]);
    const shortDesc = normalizeStr(r["One-Sentence Short Description"]);
    const category = normalizeStr(r["Game Category"]);
    const players = normalizeStr(r["Number of Players"]);

    const h = document.createElement("h3");
    h.textContent = title;

    const subtitle = document.createElement("div");
    subtitle.className = "subtitle";
    subtitle.textContent = mechanism ? mechanism : "—";

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = shortDesc || normalizeStr(r["Long Description"]).slice(0, 180);

    const meta = document.createElement("div");
    meta.className = "meta";
    if (category) meta.appendChild(badge(category));
    if (players) meta.appendChild(badge(`${players} players`));

    const links = document.createElement("div");
    links.className = "links";
    const dl1 = normalizeStr(r["Download Link"]);
    const dl2 = normalizeStr(r["Secondary Download Link"]);
    if (dl1) links.appendChild(linkBtn(dl1, "Download"));
    if (dl2) links.appendChild(linkBtn(dl2, "Alt link"));

    li.append(h, subtitle, desc, meta, links);
    frag.appendChild(li);
  }
  cardsEl.appendChild(frag);
}

function badge(text) {
  const b = document.createElement("span");
  b.className = "badge";
  b.textContent = text;
  return b;
}
function linkBtn(href, label) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = label;
  return a;
}

function renderPager(total, totalPages) {
  resultsMetaEl.textContent = `${total.toLocaleString()} game${total===1?"":"s"} • Page ${currentPage} of ${totalPages}`;
  pagerEl.hidden = totalPages <= 1;

  pageNumsEl.innerHTML = "";
  const front = Math.max(1, currentPage - 2);
  const back = Math.min(totalPages, currentPage + 2);
  for (let p = front; p <= back; p++) {
    const btn = document.createElement("button");
    btn.textContent = String(p);
    if (p === currentPage) btn.setAttribute("aria-current", "page");
    btn.addEventListener("click", () => {
      currentPage = p;
      applyFiltersNow(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    pageNumsEl.appendChild(btn);
  }
}

function wirePagerButtons(totalPages) {
  pagerEl.querySelector('[data-page="prev"]').onclick = () => {
    if (currentPage > 1) { currentPage--; applyFiltersNow(false); window.scrollTo({top:0, behavior:"smooth"}); }
  };
  pagerEl.querySelector('[data-page="next"]').onclick = () => {
    if (currentPage < totalPages) { currentPage++; applyFiltersNow(false); window.scrollTo({top:0, behavior:"smooth"}); }
  };
}

function applyFiltersNow(showBusy=true) {
  if (showBusy) mainEl.setAttribute("aria-busy", "true");
  filteredRows = rawRows.filter(rowMatchesFilters);

  const { total, totalPages, pageRows } = paginate(filteredRows);
  renderCards(pageRows);
  renderPager(total, totalPages);
  wirePagerButtons(totalPages);

  mainEl.setAttribute("aria-busy", "false");
}

function setView(mode) {
  currentView = mode;
  localStorage.setItem("viewMode", mode);
  if (mode === "list") {
    viewListBtn.classList.add("active"); viewListBtn.setAttribute("aria-pressed","true");
    viewCardsBtn.classList.remove("active"); viewCardsBtn.setAttribute("aria-pressed","false");
  } else {
    viewCardsBtn.classList.add("active"); viewCardsBtn.setAttribute("aria-pressed","true");
    viewListBtn.classList.remove("active"); viewListBtn.setAttribute("aria-pressed","false");
  }
  applyFiltersNow(false);
}

// Initialize
(async function init() {
  $("#year").textContent = new Date().getFullYear();

  viewCardsBtn.addEventListener("click", () => setView("cards"));
  viewListBtn.addEventListener("click", () => setView("list"));
  setView(currentView === "list" ? "list" : "cards");

  qEl.addEventListener("input", handleSearch);

  // Load CSV
  const csv = await fetch(CSV_URL).then(r => r.text());
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  // Ensure columns exist even if CSV missing some headers
  rawRows = parsed.data.map(row => {
    const obj = {};
    for (const c of COLUMNS) obj[c] = row[c] ?? "";
    return obj;
  });

  buildFiltersUI(rawRows);
  applyFiltersNow();
})();
