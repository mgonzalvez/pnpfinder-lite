/* PnPFinder — Games page (script.js)
   - Loads /data/games.csv (Papa Parse required in index.html)
   - Card/List views, live search with clear (×), filters, pagination with ellipses
   - Sorting: Relevance (CSV order), Newest (CSV row index desc), A–Z, Release Year (oldest)
   - Dark/Light toggle persistence
   - Image normalization for Google Drive / Dropbox
   - Game details link: /game.html?id=<csvRowIndex>
*/

(() => {
  const CSV_URL = "/data/games.csv";
  const PAGE_SIZE = 25;
  const STORAGE_KEYS = {
    view: "pnp_view_mode",       // "cards" | "list"
    sort: "pnp_sort_by",         // "relevance" | "newest" | "az" | "year"
    theme: "theme",              // "dark" | "light"
  };

  // Columns used around the app (canonical names)
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

  // Filters to show at top (dropdowns)
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

  // DOM
  const els = {
    results: document.getElementById("results"),
    pagination: document.getElementById("pagination"),
    resultsMeta: document.getElementById("resultsMeta"),
    search: document.getElementById("searchInput") || document.querySelector('input[type="search"]'),
    sort: document.getElementById("sortSelect") || document.querySelector('[data-sort]') || document.getElementById("sort"),
    viewCards: document.getElementById("viewCards"),
    viewList: document.getElementById("viewList"),
    filtersWrap: document.getElementById("filters"),
    applyBtn: document.getElementById("applyFilters"),
    clearBtn: document.getElementById("clearFilters"),
    themeToggle: document.getElementById("themeToggle"),
    header: document.querySelector(".site-header"),
  };

  // State
  let allGames = [];
  let filtered = [];
  let currentPage = 1;
  let viewMode = localStorage.getItem(STORAGE_KEYS.view) || "cards";
  let sortBy = localStorage.getItem(STORAGE_KEYS.sort) || "relevance";
  let searchTerm = "";
  const activeFilters = {}; // key -> value string (dropdown selection)

  // ===== Utils =====
  const MULTI_SEP = /[;|,]/;
  const TRIM = s => String(s ?? "").trim();

  function normalizeImageUrl(url) {
    const s = TRIM(url);
    if (!s) return "";
    // Google Drive
    const driveIdMatch = s.match(/(?:\/d\/|id=)([A-Za-z0-9_-]{10,})/);
    if (driveIdMatch) {
      return `https://drive.google.com/uc?export=view&id=${driveIdMatch[1]}`;
    }
    // Dropbox share -> dl=1
    if (/dropbox\.com/.test(s) && !/dl=1/.test(s)) {
      return s.replace(/(\?dl=\d)?$/, "?dl=1");
    }
    return s;
  }

  function htmlEscape(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function getTitle(g) { return TRIM(g[COLS.TITLE] || g.Title); }
  function getYear(g) { const y = parseInt(TRIM(g[COLS.YEAR])); return Number.isFinite(y) ? y : -Infinity; }

  // Range helpers (for basic intersection checks like "1–4" vs "2+" etc.)
  function parseRange(value) {
    const v = TRIM(value).replace(/[–—]/g, "-"); // en dash -> hyphen
    if (!v) return null;
    if (/^\d+\+$/.test(v)) return { min: parseInt(v), max: Infinity };
    if (/^\d+$/.test(v)) return { min: parseInt(v), max: parseInt(v) };
    const m = v.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) return { min: parseInt(m[1]), max: parseInt(m[2]) };
    return null;
  }
  function rangesIntersect(a, b) {
    if (!a || !b) return false;
    return a.min <= b.max && b.min <= a.max;
  }

  // ===== Sorting =====
  function sortGames(list, sortKey) {
    const byIdxAsc = (a, b) => (a._idx ?? 0) - (b._idx ?? 0);
    const byIdxDesc = (a, b) => (b._idx ?? 0) - (a._idx ?? 0);
    switch (sortKey) {
      case "newest":
        // Newest = last rows appended to CSV (row index descending)
        return list.slice().sort(byIdxDesc);
      case "az":
        return list.slice().sort((a, b) => getTitle(a).localeCompare(getTitle(b), undefined, { sensitivity: "base" }));
      case "year":
        // Oldest first (as established). Flip the comparator for newest-year-first.
        return list.slice().sort((a, b) => getYear(a) - getYear(b));
      case "relevance":
      default:
        // Relevance = original CSV order (row index ascending)
        return list.slice().sort(byIdxAsc);
    }
  }

  // ===== Rendering =====
  function setViewMode(mode) {
    viewMode = mode === "list" ? "list" : "cards";
    localStorage.setItem(STORAGE_KEYS.view, viewMode);
    els.viewCards && els.viewCards.setAttribute("aria-pressed", String(viewMode === "cards"));
    els.viewList && els.viewList.setAttribute("aria-pressed", String(viewMode === "list"));
    render();
  }

  function setSort(value) {
    sortBy = value || "relevance";
    localStorage.setItem(STORAGE_KEYS.sort, sortBy);
    currentPage = 1;
    render();
  }

  function paginate(list) {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    return { pageItems: list.slice(start, start + PAGE_SIZE), totalPages, total };
  }

  function renderImage(src, alt, mode = "card") {
    const url = normalizeImageUrl(src);
    const a = htmlEscape(alt || "");
    if (!url) return `<div class="thumb thumb--placeholder" aria-hidden="true"></div>`;
    const cls = mode === "list" ? "thumb thumb--sm" : "thumb";
    return `<img class="${cls}" src="${htmlEscape(url)}" alt="${a}" referrerpolicy="no-referrer" loading="lazy" decoding="async" />`;
  }

  function renderCard(g) {
    const title = htmlEscape(getTitle(g));
    const mech = htmlEscape(TRIM(g[COLS.MAIN_MECH]));
    const short = htmlEscape(TRIM(g[COLS.SHORT]));
    const cat = htmlEscape(TRIM(g[COLS.CATEGORY] || g[COLS.MODE]));
    const players = htmlEscape(TRIM(g[COLS.PLAYERS]));
    const img = TRIM(g[COLS.IMAGE]);
    const detailsHref = `/game.html?id=${encodeURIComponent(g._idx)}`;

    return `
      <a class="card" href="${detailsHref}">
        <div class="card-media">
          ${renderImage(img, title, "card")}
        </div>
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
    const title = htmlEscape(getTitle(g));
    const mech = htmlEscape(TRIM(g[COLS.MAIN_MECH]));
    const short = htmlEscape(TRIM(g[COLS.SHORT]));
    const players = htmlEscape(TRIM(g[COLS.PLAYERS]));
    const img = TRIM(g[COLS.IMAGE]);
    const detailsHref = `/game.html?id=${encodeURIComponent(g._idx)}`;
    const dl = TRIM(g[COLS.DL1]);

    return `
      <div class="list-item">
        <a class="list-media" href="${detailsHref}" aria-label="${title}">
          ${renderImage(img, title, "list")}
        </a>
        <div class="list-body">
          <div class="list-headline">
            <a class="list-title" href="${detailsHref}">${title}</a>
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
    const windowSize = 2;
    const parts = [];

    function pageBtn(n, label = n, active = false, disabled = false) {
      return `<button class="page ${active ? "active":""}" data-page="${n}" ${disabled ? "disabled":""}>${label}</button>`;
    }

    if (totalPages <= 1) {
      els.pagination.innerHTML = "";
      return;
    }

    // First
    parts.push(pageBtn(1, "1", currentPage === 1));

    // Leading ellipsis
    if (currentPage - windowSize > 2) parts.push(`<span class="ellipsis">…</span>`);

    // Middle window
    const start = Math.max(2, currentPage - windowSize);
    const end = Math.min(totalPages - 1, currentPage + windowSize);
    for (let i = start; i <= end; i++) {
      parts.push(pageBtn(i, String(i), currentPage === i));
    }

    // Trailing ellipsis
    if (currentPage + windowSize < totalPages - 1) parts.push(`<span class="ellipsis">…</span>`);

    // Last
    if (totalPages > 1) parts.push(pageBtn(totalPages, String(totalPages), currentPage === totalPages));

    els.pagination.innerHTML = parts.join("");
  }

  function render() {
    // Filter → search → sort → paginate
    const afterFilters = applyFilters(allGames);
    const afterSearch = applySearch(afterFilters, searchTerm);
    const sorted = sortGames(afterSearch, sortBy);
    const { pageItems, totalPages, total } = paginate(sorted);

    // Results meta
    if (els.resultsMeta) {
      const start = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
      const end = Math.min(currentPage * PAGE_SIZE, total);
      els.resultsMeta.textContent = `${start}-${end} of ${total} games`;
    }

    // Results list
    if (els.results) {
      els.results.setAttribute("data-view", viewMode);
      els.results.innerHTML = viewMode === "list"
        ? pageItems.map(renderListItem).join("")
        : pageItems.map(renderCard).join("");
    }

    // Pagination
    renderPagination(totalPages);
  }

  // ===== Filters =====
  function buildFiltersUI(items) {
    if (!els.filtersWrap) return;
    const makeId = key => `filter-${key}`;
    const valueSets = {};

    // Collect unique values for each filter
    for (const f of FILTERS) {
      const set = new Set();
      for (const g of items) {
        const raw = TRIM(g[f.col]);
        if (!raw) continue;
        // Some columns may be multi-valued (e.g., Languages)
        if (MULTI_SEP.test(raw)) {
          raw.split(MULTI_SEP).forEach(x => set.add(TRIM(x)));
        } else {
          set.add(raw);
        }
      }
      valueSets[f.key] = [...set].sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));
    }

    // Build HTML
    els.filtersWrap.innerHTML = FILTERS.map(f => {
      const id = makeId(f.key);
      const options = [`<option value="">— ${f.label} —</option>`]
        .concat(valueSets[f.key].map(v => `<option value="${htmlEscape(v)}">${htmlEscape(v)}</option>`))
        .join("");
      return `
        <div class="select">
          <label for="${id}">${f.label}</label>
          <select id="${id}" data-filter="${f.key}">
            ${options}
          </select>
        </div>
      `;
    }).join("");

    // Hook up listeners
    els.filtersWrap.querySelectorAll("select[data-filter]").forEach(sel => {
      sel.addEventListener("change", () => {
        const key = sel.getAttribute("data-filter");
        const val = sel.value;
        if (val) activeFilters[key] = val; else delete activeFilters[key];
        currentPage = 1;
        render();
      });
    });

    // Apply / Clear
    els.applyBtn && els.applyBtn.addEventListener("click", (e) => { e.preventDefault(); currentPage = 1; render(); });
    els.clearBtn && els.clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      Object.keys(activeFilters).forEach(k => delete activeFilters[k]);
      els.filtersWrap.querySelectorAll("select[data-filter]").forEach(s => s.value = "");
      currentPage = 1;
      render();
    });
  }

  function applyFilters(items) {
    // If no filters active:
    if (!Object.keys(activeFilters).length) return items;

    return items.filter(g => {
      for (const f of FILTERS) {
        const sel = activeFilters[f.key];
        if (!sel) continue;
        const raw = TRIM(g[f.col]);

        if (!raw) return false;

        // Special handling for range-ish columns
        if (f.key === "players" || f.key === "time" || f.key === "age") {
          const r1 = parseRange(sel);
          const r2 = parseRange(raw);
          if (r1 && r2) {
            if (!rangesIntersect(r1, r2)) return false;
            continue;
          }
          // Fallback to substring
        }

        // Multi-valued fields (Languages, Curated Lists)
        if (MULTI_SEP.test(raw)) {
          const parts = raw.split(MULTI_SEP).map(TRIM);
          if (!parts.includes(sel)) return false;
          continue;
        }

        // Exact match (case-insensitive)
        if (TRIM(raw).toLowerCase() !== sel.toLowerCase()) return false;
      }
      return true;
    });
  }

  // ===== Search =====
  function applySearch(items, q) {
    q = TRIM(q).toLowerCase();
    if (!q) return items;
    const fields = [
      COLS.TITLE, COLS.SHORT, COLS.LONG,
      COLS.DESIGNER, COLS.PUBLISHER,
      COLS.THEME, COLS.MAIN_MECH, COLS.SECOND_MECH,
      COLS.CATEGORY, COLS.MODE, COLS.LANG, COLS.LISTS
    ];
    return items.filter(g => {
      for (const f of fields) {
        const v = TRIM(g[f]).toLowerCase();
        if (v && v.includes(q)) return true;
      }
      return false;
    });
  }

  function buildSearchClearButton() {
    if (!els.search) return;
    // If the HTML already has an "x", skip; else add one after the input
    let wrap = els.search.parentElement;
    if (!wrap || !wrap.classList.contains("search-wrap")) {
      // Create a simple wrapper to position the clear button
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
    function syncClear() {
      clearBtn.style.visibility = els.search.value ? "visible" : "hidden";
    }
    els.search.addEventListener("input", () => {
      searchTerm = els.search.value;
      currentPage = 1;
      render();
      syncClear();
    });
    els.search.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        els.search.value = "";
        searchTerm = "";
        currentPage = 1;
        render();
        syncClear();
      }
    });
    clearBtn.addEventListener("click", () => {
      els.search.value = "";
      searchTerm = "";
      currentPage = 1;
      render();
      syncClear();
      els.search.focus();
    });
    syncClear();
  }

  // ===== Theme toggle =====
  function initTheme() {
    const btn = els.themeToggle;
    if (!btn) return;
    function setTheme(theme) {
      const t = theme === "light" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", t);
      localStorage.setItem(STORAGE_KEYS.theme, t);
      btn.textContent = t === "light" ? "Light" : "Dark";
      btn.setAttribute("aria-pressed", String(t === "light"));
      btn.title = t === "light" ? "Switch to dark mode" : "Switch to light mode";
    }
    setTheme(localStorage.getItem(STORAGE_KEYS.theme) || "dark");
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      setTheme(next);
    });
  }

  // ===== Events =====
  function initEvents() {
    els.viewCards && els.viewCards.addEventListener("click", (e) => { e.preventDefault(); setViewMode("cards"); });
    els.viewList && els.viewList.addEventListener("click", (e) => { e.preventDefault(); setViewMode("list"); });

    if (els.sort) {
      // Ensure select reflects current value
      if ("value" in els.sort) els.sort.value = sortBy;
      els.sort.addEventListener("change", () => setSort(els.sort.value));
    }

    els.pagination && els.pagination.addEventListener("click", (e) => {
      const btn = e.target.closest("button.page");
      if (!btn) return;
      const n = parseInt(btn.getAttribute("data-page"), 10);
      if (Number.isFinite(n)) {
        currentPage = n;
        render();
        window.scrollTo({ top: (els.header?.offsetHeight || 0), behavior: "smooth" });
      }
    });
  }

  // ===== Data load =====
  function loadCSV() {
    return new Promise((resolve, reject) => {
      if (!window.Papa) {
        reject(new Error("Papa Parse is required on this page."));
        return;
      }
      Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => (h || "").replace(/^\uFEFF/, "").trim(),
        complete: (res) => resolve(res.data),
        error: (err) => reject(err),
      });
    });
  }

  function start() {
    initTheme();
    initEvents();
    buildSearchClearButton();

    loadCSV()
      .then(rows => {
        // Keep a stable CSV order index for sorting
        allGames = rows.filter(r => Object.keys(r).some(k => TRIM(r[k]))); // non-empty rows
        allGames.forEach((r, i) => r._idx = i); // <— critical for Relevance & Newest

        buildFiltersUI(allGames);

        // Set initial view/sort UI
        setViewMode(viewMode);
        if (els.sort && "value" in els.sort) els.sort.value = sortBy;

        render();
      })
      .catch(err => {
        console.error("Failed to load games.csv:", err);
        if (els.results) els.results.innerHTML = `<p class="error">Failed to load games. Please try again later.</p>`;
      });
  }

  // Kick off
  start();
})();
