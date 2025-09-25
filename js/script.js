/* PnPFinder — Games page (CSV-order relevance, filters, sorting, ellipses pager, images, details link, theme toggle, search clear button) */

const CSV_URL = "/data/games.csv";
const PAGE_SIZE = 25;

/* OFFICIAL COLUMN LIST (display names used in the app) */
const COLUMNS = [
  "Game Title","Designer","Publisher","Free or Paid","Price","Number of Players","Playtime","Age Range",
  "Theme","Main Mechanism","Secondary Mechanism","Gameplay Complexity","Gameplay Mode","Game Category",
  "PnP Crafting Challenge Level","One-Sentence Short Description","Long Description","Download Link",
  "Secondary Download Link","Print Components","Other Components","Languages","Release Year","Game Image",
  "Curated Lists","Report Dead Link"
];

/* Limit which columns appear as dropdown filters */
const FILTER_COLUMNS = [
  "Curated Lists",
  "PnP Crafting Challenge Level",
  "Number of Players",
  "Playtime",
  "Age Range",
  "Main Mechanism",
  "Gameplay Complexity",
  "Theme",
  "Free or Paid",
  "Release Year",
  "Languages",
];

/* Canonicalization helpers for robust header matching */
const toKey = (s) => String(s ?? "")
  .replace(/^\uFEFF/, "")
  .normalize("NFKC")
  .trim()
  .toLowerCase()
  .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
  .replace(/[^a-z0-9]+/g, "");

const OFFICIAL_KEY_BY_NAME = new Map(COLUMNS.map(name => [name, toKey(name)]));
const NAME_BY_OFFICIAL_KEY = new Map(COLUMNS.map(name => [toKey(name), name]));

/* Text search across these fields */
const SEARCH_FIELDS = [
  "Game Title","Designer","Publisher","One-Sentence Short Description","Long Description","Theme","Main Mechanism","Secondary Mechanism","Curated Lists"
];

/* Field typing */
const MULTIVALUE_SEP = /[;,|]/;
const MULTIVALUE_FIELDS = new Set(["Languages","Curated Lists","Game Category"]);
const URL_FIELDS = new Set(["Download Link","Secondary Download Link","Game Image"]);
const NUMERIC_FIELDS = new Set(["Price","Release Year"]);
const RANGEISH_FIELDS = new Set(["Number of Players","Playtime","Age Range"]);
const FREEPAID_FIELD = "Free or Paid";

/* Sorting */
const SORT_DEFAULT = "relevance"; // relevance | newest | az | release-asc
let sortBy = localStorage.getItem("sortBy") || SORT_DEFAULT;

/* Theme */
const THEME_KEY = "theme";
function setTheme(theme, buttonEl) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(THEME_KEY, t);
  if (buttonEl) {
    const isLight = t === "light";
    buttonEl.textContent = isLight ? "Light" : "Dark";
    buttonEl.title = isLight ? "Switch to dark mode" : "Switch to light mode";
    buttonEl.setAttribute("aria-pressed", String(isLight));
  }
}
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  const saved = localStorage.getItem(THEME_KEY) || "dark"; // default dark
  setTheme(saved, btn);
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    setTheme(next, btn);
  });
}

/* Search clear button */
function installClearButton(inputEl) {
  if (!inputEl) return;
  const wrap = inputEl.closest(".search") || inputEl.parentElement;
  if (!wrap) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "clear-btn";
  btn.setAttribute("aria-label", "Clear search");
  btn.innerHTML = "×";

  const toggle = () => { btn.style.display = inputEl.value.trim() ? "inline-flex" : "none"; };
  inputEl.addEventListener("input", toggle);
  inputEl.addEventListener("keyup", (e) => { if (e.key === "Escape") { btn.click(); e.stopPropagation(); } });

  btn.addEventListener("click", () => {
    inputEl.value = "";
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.focus();
  });

  wrap.appendChild(btn);
  toggle();
}

/* State */
let rawRows = [];       // all rows (each with a stable _idx)
let filteredRows = [];
let currentPage = 1;
let currentView = localStorage.getItem("viewMode") || "cards";
let searchTerm = "";
let activeFilters = {};

/* Elements */
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
const sortEl = $("#sortBy");

const debounce = (fn, ms=250) => { let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} };

function normalizeStr(v){ return (v ?? "").toString().trim(); }
function isEmpty(v){ return v == null || String(v).trim() === ""; }
function parseNumber(v){ const n=Number(String(v).replace(/[^\d.\-]/g,"")); return Number.isFinite(n)?n:null; }

/* ---------- Range-ish helpers ---------- */
function parseRangeish(value){
  const s=String(value||"").toLowerCase().trim(); if(!s) return null;
  const plus=s.match(/^(\d+)\s*\+$/); if(plus) return [parseInt(plus[1],10), Infinity];
  const dash=s.match(/^(\d+)\s*([-–]|to)\s*(\d+)$/); if(dash) return [parseInt(dash[1],10), parseInt(dash[3],10)];
  const single=s.match(/^(\d+)$/); if(single){ const n=parseInt(single[1],10); return [n,n]; }
  return null;
}
function rangeMatches(value, query){
  if (isEmpty(query)) return true;
  const vr=parseRangeish(value), qr=parseRangeish(query);
  if (vr && qr){ const [a1,a2]=vr,[b1,b2]=qr; return Math.max(a1,b1) <= Math.min(a2,b2); }
  return String(value||"").toLowerCase().includes(String(query).toLowerCase());
}
function multivalueContains(value, needle){
  if (isEmpty(needle)) return true;
  const parts=String(value||"").split(MULTIVALUE_SEP).map(s=>s.trim().toLowerCase()).filter(Boolean);
  return parts.includes(String(needle).toLowerCase());
}
function exactOrContains(value, needle){
  if (isEmpty(needle)) return true;
  return String(value||"").toLowerCase().includes(String(needle).toLowerCase());
}
function numberEquals(value, needle){
  if (isEmpty(needle)) return true;
  const v=parseNumber(value), n=parseNumber(needle);
  return v!==null && n!==null ? v===n : exactOrContains(value, needle);
}
function freePaidMatch(value, needle){
  if (isEmpty(needle)) return true;
  const v=String(value||"").toLowerCase();
  if (needle==="Free") return v.includes("free");
  if (needle==="Paid") return !v.includes("free");
  return exactOrContains(value, needle);
}

/* ---------- Image URL helpers ---------- */
function firstUrlLike(raw) {
  if (!raw) return "";
  const parts = String(raw)
    .split(MULTIVALUE_SEP)
    .map(s => s.trim().replace(/^['"]|['"]$/g, ""));
  for (const p of parts) { if (/^https?:\/\//i.test(p)) return p; }
  for (const p of parts) { if (/^\/\//.test(p)) return "https:" + p; }
  return "";
}
function normalizeImageHost(url) {
  if (!url) return "";
  if (url.startsWith("http://")) url = "https://" + url.slice(7);
  const g = url.match(/drive\.google\.com\/file\/d\/([^/]+)\//);
  if (g) return `https://drive.google.com/uc?export=view&id=${g[1]}`;
  if (/^https:\/\/www\.dropbox\.com\//i.test(url)) {
    url = url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
    url = url.replace(/[?&]dl=\d/, "");
  }
  return url;
}
function getImageUrl(row) {
  const raw = normalizeStr(row["Game Image"]);
  if (!raw) return "";
  const u = firstUrlLike(raw);
  return normalizeImageHost(u);
}

/* ---------- CSV LOADING WITH HEADER NORMALIZATION ---------- */
function buildHeaderMap(csvHeaders){
  const map = new Map();
  for (const h of csvHeaders){
    const k = toKey(h);
    if (NAME_BY_OFFICIAL_KEY.has(k)){ map.set(k, NAME_BY_OFFICIAL_KEY.get(k)); continue; }
    if (k==="title") { map.set(k, "Game Title"); continue; }
    if (k==="players" || k==="numberofplayers") { map.set(k,"Number of Players"); continue; }
    if (k==="playtime" || k==="playduration") { map.set(k,"Playtime"); continue; }
    if (k==="agerange" || k==="age") { map.set(k,"Age Range"); continue; }
    if (k==="category" || k==="mode" || k==="gameplaymode") { map.set(k,"Game Category"); continue; }
    if (k==="image" || k==="img" || k==="thumbnail" || k==="thumb" ||
        k==="cover" || k==="gameimage" || k==="imageurl" || k==="imgurl") {
      map.set(k, "Game Image"); continue;
    }
    map.set(k, h);
  }
  return map;
}

function remapRow(row, headerMap){
  const out = {};
  for (const name of COLUMNS) out[name] = "";
  for (const [rawKey, value] of Object.entries(row)){
    const k = toKey(rawKey);
    const mappedName = headerMap.get(k);
    if (!mappedName) continue;
    if (NAME_BY_OFFICIAL_KEY.has(toKey(mappedName))){
      out[mappedName] = value ?? "";
    }
  }
  return out;
}

/* ---------- UI BUILDERS ---------- */

function collectUniqueOptions(rows, column){
  const set = new Set();
  for (const r of rows){
    const v = normalizeStr(r[column]);
    if (!v) continue;
    if (MULTIVALUE_FIELDS.has(column)){
      v.split(MULTIVALUE_SEP).forEach(p => { const s=p.trim(); if (s) set.add(s); });
    } else if (RANGEISH_FIELDS.has(column)){
      set.add(v);
    } else if (NUMERIC_FIELDS.has(column)){
      const n=parseNumber(v); if (n!==null) set.add(String(n));
    } else {
      set.add(v);
    }
  }
  const arr=[...set];
  if (NUMERIC_FIELDS.has(column) || column==="Release Year"){
    return arr.map(parseFloat).filter(n=>!Number.isNaN(n)).sort((a,b)=>a-b).map(String);
  }
  return arr.sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));
}

function createSelect(column, options){
  const id = column.replace(/\s+/g, "_");
  const wrap=document.createElement("div"); wrap.className="select";
  const label=document.createElement("label"); label.setAttribute("for", id); label.textContent=column;
  const select=document.createElement("select"); select.id=id; select.name=column;
  const any=document.createElement("option"); any.value=""; any.textContent="Any"; select.appendChild(any);

  if (column===FREEPAID_FIELD){ ["Free","Paid"].forEach(v=>{ const o=document.createElement("option"); o.value=v; o.textContent=v; select.appendChild(o); }); }
  else { for (const v of options){ const o=document.createElement("option"); o.value=v; o.textContent=v; select.appendChild(o); } }

  wrap.append(label, select);
  return wrap;
}

function buildFiltersUI(rows){
  filtersGridEl.innerHTML="";
  const frag=document.createDocumentFragment();
  for (const col of FILTER_COLUMNS){
    if (URL_FIELDS.has(col)) continue;
    const opts=collectUniqueOptions(rows, col);
    const sel=createSelect(col, opts);
    frag.appendChild(sel);
  }
  filtersGridEl.appendChild(frag);

  $$("#filtersGrid select").forEach(sel => sel.addEventListener("change", handleFilterChange));

  clearBtn.addEventListener("click", () => {
    $$("#filtersGrid select").forEach(s=>s.value="");
    activeFilters={}; currentPage=1; applyFiltersNow();
  });

  filtersForm.addEventListener("submit", (e) => {
    e.preventDefault();
    readFiltersFromUI(); currentPage=1; applyFiltersNow();
  });
}

function readFiltersFromUI(){
  const newFilters={};
  $$("#filtersGrid select").forEach(sel => { const col=sel.name; const val=sel.value; if (!isEmpty(val)) newFilters[col]=val; });
  activeFilters=newFilters;
}

function handleFilterChange(){ readFiltersFromUI(); currentPage=1; applyFiltersNow(); }

const handleSearch = debounce(() => { searchTerm=qEl.value.trim(); currentPage=1; applyFiltersNow(); }, 220);

function rowMatchesFilters(row){
  for (const [col,val] of Object.entries(activeFilters)){
    const cell=row[col];
    if (col===FREEPAID_FIELD){ if (!freePaidMatch(cell,val)) return false; continue; }
    if (MULTIVALUE_FIELDS.has(col)){ if (!multivalueContains(cell,val)) return false; continue; }
    if (NUMERIC_FIELDS.has(col)){ if (!numberEquals(cell,val)) return false; continue; }
    if (RANGEISH_FIELDS.has(col)){ if (!rangeMatches(cell,val)) return false; continue; }
    if (!exactOrContains(cell,val)) return false;
  }
  if (!isEmpty(searchTerm)){
    const q=searchTerm.toLowerCase();
    const hit=SEARCH_FIELDS.some(f => String(row[f]||"").toLowerCase().includes(q));
    if (!hit) return false;
  }
  return true;
}

/* ---------- Sorting ---------- */

function safeLower(s){ return String(s || "").toLowerCase(); }

function sortRows(rows){
  // Relevance = CSV order via _idx
  if (sortBy === "relevance") {
    return rows.slice().sort((a,b) => (a._idx ?? 0) - (b._idx ?? 0));
    }
  const byTitle = (a, b) => safeLower(a["Game Title"]).localeCompare(safeLower(b["Game Title"]), undefined, {numeric:true, sensitivity:"base"});
  const byYearDesc = (a, b) => (parseNumber(b["Release Year"]) ?? -Infinity) - (parseNumber(a["Release Year"]) ?? -Infinity);
  const byYearAsc  = (a, b) => (parseNumber(a["Release Year"]) ??  Infinity) - (parseNumber(b["Release Year"]) ??  Infinity);

  if (sortBy === "az") return rows.slice().sort((a,b) => byTitle(a,b));
  if (sortBy === "newest") {
    return rows.slice().sort((a,b) => {
      const d = byYearDesc(a,b);
      return d !== 0 ? d : byTitle(a,b);
    });
  }
  if (sortBy === "release-asc") {
    return rows.slice().sort((a,b) => {
      const d = byYearAsc(a,b);
      return d !== 0 ? d : byTitle(a,b);
    });
  }
  return rows.slice().sort((a,b) => (a._idx ?? 0) - (b._idx ?? 0));
}

/* ---------- Pagination UI (ellipses + page count) ---------- */

function renderPager(total, totalPages) {
  resultsMetaEl.textContent =
    `${total.toLocaleString()} game${total === 1 ? "" : "s"} • Page ${currentPage} of ${totalPages}`;

  pagerEl.hidden = totalPages <= 1;

  const makePageBtn = (p, { current = false } = {}) => {
    const btn = document.createElement("button");
    btn.textContent = String(p);
    if (current) btn.setAttribute("aria-current", "page");
    btn.addEventListener("click", () => {
      if (p !== currentPage) {
        currentPage = p;
        applyFiltersNow(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    return btn;
  };

  const makeEllipsis = () => {
    const span = document.createElement("span");
    span.textContent = "…";
    span.setAttribute("aria-hidden", "true");
    return span;
  };

  pageNumsEl.innerHTML = "";

  if (totalPages >= 1) {
    pageNumsEl.appendChild(makePageBtn(1, { current: currentPage === 1 }));

    const windowSize = 2;
    const start = Math.max(2, currentPage - windowSize);
    const end = Math.min(totalPages - 1, currentPage + windowSize);

    if (start > 2) pageNumsEl.appendChild(makeEllipsis());
    for (let p = start; p <= end; p++) {
      pageNumsEl.appendChild(makePageBtn(p, { current: p === currentPage }));
    }
    if (end < totalPages - 1) pageNumsEl.appendChild(makeEllipsis());

    if (totalPages >= 2) {
      pageNumsEl.appendChild(makePageBtn(totalPages, { current: currentPage === totalPages }));
    }
  }

  const prevBtn = pagerEl.querySelector('[data-page="prev"]');
  const nextBtn = pagerEl.querySelector('[data-page="next"]');
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function wirePagerButtons(totalPages){
  const prev = pagerEl.querySelector('[data-page="prev"]');
  const next = pagerEl.querySelector('[data-page="next"]');
  if (prev) prev.onclick = () => {
    if (currentPage > 1) { currentPage--; applyFiltersNow(false); window.scrollTo({top:0, behavior:"smooth"}); }
  };
  if (next) next.onclick = () => {
    if (currentPage < totalPages) { currentPage++; applyFiltersNow(false); window.scrollTo({top:0, behavior:"smooth"}); }
  };
}

/* ---------- App flow ---------- */

function paginate(rows){
  const total=rows.length;
  const totalPages=Math.max(1, Math.ceil(total / PAGE_SIZE));
  currentPage=Math.min(Math.max(1,currentPage), totalPages);
  const start=(currentPage-1)*PAGE_SIZE;
  const pageRows=rows.slice(start, start+PAGE_SIZE);
  return { total, totalPages, pageRows };
}

function badge(text){ const b=document.createElement("span"); b.className="badge"; b.textContent=text; return b; }
function linkBtn(href,label){ const a=document.createElement("a"); a.href=href; a.target="_blank"; a.rel="noopener"; a.textContent=label; return a; }

function renderCards(rows){
  const asList = currentView === "list";
  cardsEl.classList.toggle("list", asList);
  cardsEl.innerHTML = "";

  const frag = document.createDocumentFragment();
  for (const r of rows) {
    const li = document.createElement("article");
    li.className = "card";
    li.setAttribute("role", "listitem");

    const title     = normalizeStr(r["Game Title"]) || "Untitled";
    const mechanism = normalizeStr(r["Main Mechanism"]);
    const shortDesc = normalizeStr(r["One-Sentence Short Description"]);
    const category  = normalizeStr(r["Game Category"]);
    const players   = normalizeStr(r["Number of Players"]);
    const imgURL    = getImageUrl(r);
    const detailsHref = `/game.html?id=${encodeURIComponent(r._idx)}`;

    // Make entire card clickable, but allow inner links to work
    li.addEventListener("click", (e) => {
      if (e.target.closest("a")) return; // don't hijack link clicks
      location.href = detailsHref;
    });
    li.classList.add("is-clickable");

    // Thumbnail
    let thumbWrap = null;
    if (imgURL) {
      thumbWrap = document.createElement("div");
      thumbWrap.className = "thumb";
      const img = document.createElement("img");
      img.src = imgURL;
      img.alt = title;
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => thumbWrap.remove();
      thumbWrap.appendChild(img);
    }

    const h = document.createElement("h3");
    const hLink = document.createElement("a");
    hLink.href = detailsHref;
    hLink.textContent = title;
    h.appendChild(hLink);

    const subtitle = document.createElement("div"); subtitle.className = "subtitle"; subtitle.textContent = mechanism || "—";
    const desc = document.createElement("div"); desc.className = "desc"; desc.textContent = shortDesc || normalizeStr(r["Long Description"]).slice(0, 180);

    const meta = document.createElement("div"); meta.className = "meta";
    if (category) meta.appendChild(badge(category));
    if (players)  meta.appendChild(badge(`${players} players`));

    const links = document.createElement("div"); links.className = "links";
    const dl1 = normalizeStr(r["Download Link"]); const dl2 = normalizeStr(r["Secondary Download Link"]);
    if (dl1) links.appendChild(linkBtn(dl1, "Download"));
    if (dl2) links.appendChild(linkBtn(dl2, "Alt link"));

    if (asList) {
      if (thumbWrap) li.append(thumbWrap);

      // right-side content column
      const body = document.createElement("div");
      body.className = "list-body";

      const header = document.createElement("div");
      header.className = "list-header";
      header.append(h, subtitle);

      body.append(header);

      if (desc && desc.textContent.trim()) body.append(desc);
      if (meta && meta.childElementCount) body.append(meta);
      if (links && links.childElementCount) {
        links.classList.add("list-actions");
        body.append(links);
      }

      li.append(body);
    } else {
      if (thumbWrap) li.append(thumbWrap);
      li.append(h, subtitle, desc, meta, links);
    }

    frag.appendChild(li);
  }
  cardsEl.appendChild(frag);
}

function applyFiltersNow(showBusy=true){
  if (showBusy) mainEl.setAttribute("aria-busy","true");

  // 1) filter
  filteredRows = rawRows.filter(rowMatchesFilters);

  // 2) sort (relevance = CSV order via _idx)
  const sorted = sortRows(filteredRows);

  // 3) paginate
  const { total, totalPages, pageRows } = paginate(sorted);

  // 4) render
  renderCards(pageRows);
  renderPager(total, totalPages);
  wirePagerButtons(totalPages);

  mainEl.setAttribute("aria-busy","false");
}

function setView(mode){
  currentView=mode; localStorage.setItem("viewMode", mode);
  if (mode==="list"){
    viewListBtn.classList.add("active"); viewListBtn.setAttribute("aria-pressed","true");
    viewCardsBtn.classList.remove("active"); viewCardsBtn.setAttribute("aria-pressed","false");
  } else {
    viewCardsBtn.classList.add("active"); viewCardsBtn.setAttribute("aria-pressed","true");
    viewListBtn.classList.remove("active"); viewListBtn.setAttribute("aria-pressed","false");
  }
  applyFiltersNow(false);
}

/* ---------- Init ---------- */
(async function init(){
  document.getElementById("year").textContent=new Date().getFullYear();

  initThemeToggle();

  // Search field and clear button
  installClearButton(qEl);
  qEl.addEventListener("input", handleSearch);

  // View toggles
  viewCardsBtn.addEventListener("click",()=>setView("cards"));
  viewListBtn.addEventListener("click",()=>setView("list"));
  setView(currentView==="list" ? "list" : "cards");

  // Sort control
  if (sortEl) {
    sortEl.value = sortBy;
    sortEl.addEventListener("change", () => {
      sortBy = sortEl.value;
      localStorage.setItem("sortBy", sortBy);
      currentPage = 1;
      applyFiltersNow();
    });
  }

  // Load CSV
  const csvText = await fetch(CSV_URL).then(r=>r.text());
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  });

  const csvHeaders = parsed.meta.fields || [];
  const headerMap = buildHeaderMap(csvHeaders);

  // Build rows and stamp stable CSV order index
  rawRows = parsed.data.map((row, i) => {
    const obj = remapRow(row, headerMap);
    obj._idx = i; // preserve original CSV order
    return obj;
  });

  buildFiltersUI(rawRows);
  applyFiltersNow();
})();
