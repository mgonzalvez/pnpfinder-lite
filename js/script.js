/* PnPFinder — Games page (robust script.js)
   - Loads /data/games.csv (auto-injects Papa Parse if missing)
   - Card/List views, live search (+ clear ×), dropdown filters, pagination w/ ellipses
   - Sorting: Relevance (CSV order), Newest (CSV row index desc), A–Z, Release Year (oldest)
   - Dark/Light toggle (persisted)
   - Safer DOM targeting (works if some IDs/classes differ)
   - Helpful console logs if something goes wrong
*/

(() => {
  const CSV_PRIMARY = "/data/games.csv";
  const CSV_FALLBACK = "data/games.csv"; // in case your host serves relative path
  const PAGE_SIZE = 25;

  const STORAGE = {
    view: "pnp_view_mode",
    sort: "pnp_sort_by",
    theme: "theme",
  };

  // Canonical column names
  const COLS = {
    TITLE: "Game Title",
    DESIGNER: "Designer",
    PUBLISHER: "Publisher",
    FREEPAID: "Free or Paid",
    PRICE: "Price",
    PLAYERS: "Number of Players",
    PLAYTIME: "Playtime",
    AGE: "Age Range",
    THEME: "Theme",
    MAIN_MECH: "Main Mechanism",
    SECOND_MECH: "Secondary Mechanism",
    COMPLEXITY: "Gameplay Complexity",
    MODE: "Gameplay Mode",
    CATEGORY: "Game Category",
    CRAFT: "PnP Crafting Challenge Level",
    SHORT: "One-Sentence Short Description",
    LONG: "Long Description",
    DL1: "Download Link",
    DL2: "Secondary Download Link",
    PRINT_COMP: "Print Components",
    OTHER_COMP: "Other Components",
    LANG: "Languages",
    YEAR: "Release Year",
    IMAGE: "Game Image",
    LISTS: "Curated Lists",
    REPORT: "Report Dead Link"
  };

  // Filters shown at top
  const FILTERS = [
    { key: "curated",  col: COLS.LISTS,        label: "Curated Lists" },
    { key: "craft",    col: COLS.CRAFT,        label: "PnP Crafting Challenge" },
    { key: "players",  col: COLS.PLAYERS,      label: "Number of Players" },
    { key: "time",     col: COLS.PLAYTIME,     label: "Playtime" },
    { key: "age",      col: COLS.AGE,          label: "Age Range" },
    { key: "mech",     col: COLS.MAIN_MECH,    label: "Main Mechanism" },
    { key: "complex",  col: COLS.COMPLEXITY,   label: "Gameplay Complexity" },
    { key: "theme",    col: COLS.THEME,        label: "Theme" },
    { key: "price",    col: COLS.FREEPAID,     label: "Free or Paid" },
    { key: "year",     col: COLS.YEAR,         label: "Release Year" },
    { key: "lang",     col: COLS.LANG,         label: "Languages" },
  ];

  // ---------- DOM helpers ----------
  const pick = (...sels) => {
    for (const s of sels) {
      if (!s) continue;
      const el = typeof s === "string" ? document.querySelector(s) : s;
      if (el) return el;
    }
    return null;
  };

  const els = {
    results:     pick("#results", "#gameResults", ".results", ".results-grid"),
    pagination:  pick("#pagination", ".pagination"),
    resultsMeta: pick("#resultsMeta", ".results-meta"),
    search:      pick("#searchInput", 'input[type="search"]', '#q'),
    sort:        pick("#sortSelect", "#sort", "[data-sort]"),
    viewCards:   pick("#viewCards", '[data-view="cards"]'),
    viewList:    pick("#viewList",  '[data-view="list"]'),
    filtersWrap: pick("#filters", ".filters"),
    applyBtn:    pick("#applyFilters", ".filters-apply"),
    clearBtn:    pick("#clearFilters", ".filters-clear"),
    themeToggle: pick("#themeToggle", ".theme .toggle"),
    header:      pick(".site-header"),
  };

  // Create a fallback results container if missing (prevents "nothing shows")
  if (!els.results) {
    const main = pick("main", "#main", "body");
    const div = document.createElement("div");
    div.id = "results";
    div.className = "results-grid";
    main.appendChild(div);
    els.results = div;
    console.warn("[PnPFinder] #results container was missing; created a fallback.");
  }

  // ---------- State ----------
  let allGames = [];
  let currentPage = 1;
  let viewMode = localStorage.getItem(STORAGE.view) || "cards";
  let sortBy   = localStorage.getItem(STORAGE.sort) || "relevance";
  let searchTerm = "";
  const activeFilters = {};

  // ---------- Utils ----------
  const MULTI_SEP = /[;|,]/;
  const TRIM = (s) => String(s ?? "").trim();

  function htmlEscape(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function normalizeImageUrl(url) {
    const s = TRIM(url);
    if (!s) return "";
    // Google Drive
    const driveIdMatch = s.match(/(?:\/d\/|id=)([A-Za-z0-9_-]{10,})/);
    if (driveIdMatch) return `https://drive.google.com/uc?export=view&id=${driveIdMatch[1]}`;
    // Dropbox
    if (/dropbox\.com/.test(s) && !/dl=1/.test(s)) return s.replace(/(\?dl=\d)?$/, "?dl=1");
    return s;
  }

  function getTitle(g) { return TRIM(g[COLS.TITLE] || g.Title); }
  function getYear(g)  { const y = parseInt(TRIM(g[COLS.YEAR])); return Number.isFinite(y) ? y : -Infinity; }

  function parseRange(value) {
    const v = TRIM(value).replace(/[–—]/g, "-"); // unify dash
    if (!v) return null;
    if (/^\d+\+$/.test(v)) return { min: parseInt(v), max: Infinity };
    if (/^\d+$/.test(v))   return { min: parseInt(v), max: parseInt(v) };
    const m = v.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) return { min: parseInt(m[1]), max: parseInt(m[2]) };
    return null;
  }
  function rangesIntersect(a, b) {
    if (!a || !b) return false;
    return a.min <= b.max && b.min <= a.max;
  }

  // ---------- Sorting ----------
  function sortGames(list, sortKey) {
    const byIdxAsc  = (a, b) => (a._idx ?? 0) - (b._idx ?? 0);
    const byIdxDesc = (a, b) => (b._idx ?? 0) - (a._idx ?? 0);
    switch (sortKey) {
      case "newest":   return list.slice().sort(byIdxDesc); // last rows appended first
      case "az":       return list.slice().sort((a,b)=>getTitle(a).localeCompare(getTitle(b), undefined, {sensitivity:"base"}));
      case "year":     return list.slice().sort((a,b)=>getYear(a) - getYear(b)); // oldest first
      case "relevance":
      default:         return list.slice().sort(byIdxAsc);   // original CSV order
    }
  }

  // ---------- Render helpers ----------
  function renderImage(src, alt, mode="card") {
    const url = normalizeImageUrl(src);
    const a = htmlEscape(alt || "");
    if (!url) return `<div class="thumb thumb--placeholder" aria-hidden="true"></div>`;
    const cls = mode === "list" ? "thumb thumb--sm" : "thumb";
    return `<img class="${cls}" src="${htmlEscape(url)}" alt="${a}" referrerpolicy="no-referrer" loading="lazy" decoding="async" />`;
  }

  function renderCard(g) {
    const title   = htmlEscape(getTitle(g));
    const mech    = htmlEscape(TRIM(g[COLS.MAIN_MECH]));
    const short   = htmlEscape(TRIM(g[COLS.SHORT]));
    const cat     = htmlEscape(TRIM(g[COLS.CATEGORY] || g[COLS.MODE]));
    const players = htmlEscape(TRIM(g[COLS.PLAYERS]));
    const img     = TRIM(g[COLS.IMAGE]);
    const href    = `/game.html?id=${encodeURIComponent(g._idx)}`;
    return `
      <a class="card" href="${href}">
        <div class="card-media">${renderImage(img, title, "card")}</div>
        <div class="card-body">
          <h3 class="card-title">${title}</h3>
          <p class="card-subtitle">${mech || "&nbsp;"}</p>
          <p class="card-desc">${short || ""}</p>
          <div class="card-meta">
            ${cat ? `<span class="badge">${cat}</span>` : ""}
            ${players ? `<span class="badge badge-alt">${players}</span>` : ""}
          </div>
        </div>
      </a>
    `;
  }

  function renderListItem(g) {
    const title   = htmlEscape(getTitle(g));
    const mech    = htmlEscape(TRIM(g[COLS.MAIN_MECH]));
    const short   = htmlEscape(TRIM(g[COLS.SHORT]));
    const players = htmlEscape(TRIM(g[COLS.PLAYERS]));
    const img     = TRIM(g[COLS.IMAGE]);
    const href    = `/game.html?id=${encodeURIComponent(g._idx)}`;
    const dl      = TRIM(g[COLS.DL1]);
    return `
      <div class="list-item">
        <a class="list-media" href="${href}" aria-label="${title}">
          ${renderImage(img, title, "list")}
        </a>
        <div class="list-body">
          <div class="list-headline">
            <a class="list-title" href="${href}">${title}</a>
            <div class="list-subtitle">${mech || "&nbsp;"}</div>
          </div>
          <p class="list-desc">${short || ""}</p>
          <div class="list-meta">
            ${players ? `<span class="badge badge-alt">${players}</span>` : ""}
            ${dl ? `<a class="btn tiny" href="${htmlEscape(dl)}" target="_blank" rel="noopener">Download</a>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function renderPagination(totalPages) {
    if (!els.pagination) return;
    if (totalPages <= 1) { els.pagination.innerHTML = ""; return; }

    const parts = [];
    const windowSize = 2;
    const btn = (n, label=n, active=false) =>
      `<button class="page ${active?"active":""}" data-page="${n}">${label}</button>`;

    parts.push(btn(1, "1", currentPage === 1));
    if (currentPage - windowSize > 2) parts.push(`<span class="ellipsis">…</span>`);
    const start = Math.max(2, currentPage - windowSize);
    const end   = Math.min(totalPages - 1, currentPage + windowSize);
    for (let i = start; i <= end; i++) parts.push(btn(i, String(i), currentPage === i));
    if (currentPage + windowSize < totalPages - 1) parts.push(`<span class="ellipsis">…</span>`);
    if (totalPages > 1) parts.push(btn(totalPages, String(totalPages), currentPage === totalPages));

    els.pagination.innerHTML = parts.join("");
  }

  function paginate(list) {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    return { pageItems: list.slice(start, start + PAGE_SIZE), totalPages, total };
  }

  function applySearch(items, q) {
    q = TRIM(q).toLowerCase();
    if (!q) return items;
    const fields = [
      COLS.TITLE, COLS.SHORT, COLS.LONG,
      COLS.DESIGNER, COLS.PUBLISHER,
      COLS.THEME, COLS.MAIN_MECH, COLS.SECOND_MECH,
      COLS.CATEGORY, COLS.MODE, COLS.LANG, COLS.LISTS
    ];
    return items.filter(g => fields.some(f => TRIM(g[f]).toLowerCase().includes(q)));
  }

  function applyFilters(items) {
    if (!Object.keys(activeFilters).length) return items;

    return items.filter(g => {
      for (const f of FILTERS) {
        const sel = activeFilters[f.key];
        if (!sel) continue;
        const raw = TRIM(g[f.col]);
        if (!raw) return false;

        if (f.key === "players" || f.key === "time" || f.key === "age") {
          const r1 = parseRange(sel);
          const r2 = parseRange(raw);
          if (r1 && r2) { if (!rangesIntersect(r1, r2)) return false; continue; }
        }
        if (MULTI_SEP.test(raw)) {
          const parts = raw.split(MULTI_SEP).map(TRIM);
          if (!parts.includes(sel)) return false;
          continue;
        }
        if (raw.toLowerCase() !== sel.toLowerCase()) return false;
      }
      return true;
    });
  }

  function render() {
    const filtered = applyFilters(allGames);
    const searched = applySearch(filtered, searchTerm);
    const sorted   = sortGames(searched, sortBy);
    const { pageItems, totalPages, total } = paginate(sorted);

    if (els.resultsMeta) {
      const start = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
      const end = Math.min(currentPage * PAGE_SIZE, total);
      els.resultsMeta.textContent = `${start}-${end} of ${total} games`;
    }

    if (els.results) {
      els.results.setAttribute("data-view", viewMode);
      els.results.innerHTML = (viewMode === "list")
        ? pageItems.map(renderListItem).join("")
        : pageItems.map(renderCard).join("");
    }

    renderPagination(totalPages);
  }

  // ---------- UI wiring ----------
  function setViewMode(mode) {
    viewMode = mode === "list" ? "list" : "cards";
    localStorage.setItem(STORAGE.view, viewMode);
    els.viewCards && els.viewCards.setAttribute("aria-pressed", String(viewMode === "cards"));
    els.viewList  && els.viewList.setAttribute("aria-pressed", String(viewMode === "list"));
    render();
  }
  function setSort(val) {
    sortBy = val || "relevance";
    localStorage.setItem(STORAGE.sort, sortBy);
    currentPage = 1;
    render();
  }

  function buildSearchClearButton() {
    if (!els.search) return;
    let wrap = els.search.parentElement;
    if (!wrap || !wrap.classList.contains("search-wrap")) {
      const w = document.createElement("div");
      w.className = "search-wrap";
      els.search.replaceWith(w);
      w.appendChild(els.search);
      wrap = w;
    }
    let clearBtn = wrap.querySelector(".search-clear");
    if (!clearBtn) {
      clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "search-clear";
      clearBtn.setAttribute("aria-label", "Clear search");
      clearBtn.textContent = "×";
      wrap.appendChild(clearBtn);
    }
    const sync = () => { clearBtn.style.visibility = els.search.value ? "visible" : "hidden"; };
    els.search.addEventListener("input", () => { searchTerm = els.search.value; currentPage = 1; render(); sync(); });
    els.search.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { els.search.value = ""; searchTerm = ""; currentPage = 1; render(); sync(); }
    });
    clearBtn.addEventListener("click", () => {
      els.search.value = ""; searchTerm = ""; currentPage = 1; render(); sync(); els.search.focus();
    });
    sync();
  }

  function initFiltersUI(items) {
    if (!els.filtersWrap) return;
    const valueSets = {};
    // Collect values
    for (const f of FILTERS) {
      const set = new Set();
      for (const g of items) {
        const raw = TRIM(g[f.col]);
        if (!raw) continue;
        if (MULTI_SEP.test(raw)) raw.split(MULTI_SEP).forEach(x => set.add(TRIM(x)));
        else set.add(raw);
      }
      valueSets[f.key] = [...set].sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));
    }
    // Build
    els.filtersWrap.innerHTML = FILTERS.map(f => {
      const opts = [`<option value="">— ${f.label} —</option>`]
        .concat(valueSets[f.key].map(v => `<option value="${htmlEscape(v)}">${htmlEscape(v)}</option>`))
        .join("");
      const id = `filter-${f.key}`;
      return `
        <div class="select">
          <label for="${id}">${f.label}</label>
          <select id="${id}" data-filter="${f.key}">${opts}</select>
        </div>
      `;
    }).join("");

    els.filtersWrap.querySelectorAll("select[data-filter]").forEach(sel => {
      sel.addEventListener("change", () => {
        const key = sel.getAttribute("data-filter");
        const val = sel.value;
        if (val) activeFilters[key] = val; else delete activeFilters[key];
        currentPage = 1;
        render();
      });
    });

    els.applyBtn && els.applyBtn.addEventListener("click", (e) => { e.preventDefault(); currentPage = 1; render(); });
    els.clearBtn && els.clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      Object.keys(activeFilters).forEach(k => delete activeFilters[k]);
      els.filtersWrap.querySelectorAll("select[data-filter]").forEach(s => s.value = "");
      currentPage = 1;
      render();
    });
  }

  function initTheme() {
    const btn = els.themeToggle;
    if (!btn) return;
    const set = (t) => {
      const theme = t === "light" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem(STORAGE.theme, theme);
      btn.textContent = theme === "light" ? "Light" : "Dark";
      btn.setAttribute("aria-pressed", String(theme === "light"));
      btn.title = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
    };
    set(localStorage.getItem(STORAGE.theme) || "dark");
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      set(next);
    });
  }

  function initEvents() {
    els.viewCards && els.viewCards.addEventListener("click", (e)=>{ e.preventDefault(); setViewMode("cards"); });
    els.viewList  && els.viewList.addEventListener("click", (e)=>{ e.preventDefault(); setViewMode("list"); });

    if (els.sort) {
      if ("value" in els.sort) els.sort.value = sortBy;
      els.sort.addEventListener("change", () => setSort(els.sort.value));
    }

    els.pagination && els.pagination.addEventListener("click", (e) => {
      const btn = e.target.closest("button.page");
      if (!btn) return;
      const n = parseInt(btn.getAttribute("data-page"), 10);
      if (Number.isFinite(n)) { currentPage = n; render(); window.scrollTo({ top: (els.header?.offsetTop || 0), behavior: "smooth" }); }
    });
  }

  // ---------- CSV loader ----------
  async function ensurePapa() {
    if (window.Papa) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load Papa Parse CDN"));
      document.head.appendChild(s);
    });
  }

  function parseCSV(text) {
    return new Promise((resolve, reject) => {
      try {
        const res = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => (h || "").replace(/^\uFEFF/, "").trim(),
        });
        if (res.errors && res.errors.length) {
          console.warn("[PnPFinder] CSV parse warnings:", res.errors);
        }
        resolve(res.data);
      } catch (e) {
        reject(e);
      }
    });
  }

  async function loadCSV() {
    await ensurePapa();
    let text = null;
    try {
      const r1 = await fetch(CSV_PRIMARY, { cache: "no-store" });
      if (r1.ok) text = await r1.text();
      else throw new Error(`${CSV_PRIMARY} ${r1.status}`);
    } catch {
      const r2 = await fetch(CSV_FALLBACK, { cache: "no-store" });
      if (!r2.ok) throw new Error(`${CSV_FALLBACK} ${r2.status}`);
      text = await r2.text();
    }
    const rows = await parseCSV(text);
    // Filter out fully-empty rows and attach stable CSV index
    const clean = rows.filter(r => Object.values(r).some(v => TRIM(v)));
    clean.forEach((r, i) => { r._idx = i; });
    console.info(`[PnPFinder] Loaded ${clean.length} games from CSV.`);
    return clean;
  }

  // ---------- Start ----------
  function start() {
    initTheme();
    initEvents();
    buildSearchClearButton();

    loadCSV().then(rows => {
      allGames = rows;
      initFiltersUI(allGames);
      setViewMode(viewMode); // sets attribute + triggers render()
      if (els.sort && "value" in els.sort) els.sort.value = sortBy;
      render();
      // Expose for quick debugging
      window.PNP_DEBUG = { games: allGames, render, setSort, setViewMode };
    }).catch(err => {
      console.error("[PnPFinder] Failed to load games.csv:", err);
      if (els.results) {
        els.results.innerHTML = `<p class="error">Failed to load games. Please refresh or try again later.</p>`;
      }
    });
  }

  start();
})();
