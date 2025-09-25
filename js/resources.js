/* PnPFinder — Resources page
   - Cards/List views, search, sort, pager, images, theme toggle
   - Category filter (dropdown) with live update + Clear/Apply
*/

const CSV_URL = "/data/resources.csv";
const PAGE_SIZE = 25;

/* Canonical columns for resources */
const COLUMNS = ["Category","Title","Description","Link","Image","Creator"];

/* Utils */
const MULTIVALUE_SEP = /[;,|]/;
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

const toKey = (s) => String(s ?? "")
  .replace(/^\uFEFF/, "")
  .normalize("NFKC")
  .trim()
  .toLowerCase()
  .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
  .replace(/[^a-z0-9]+/g, "");

const OFFICIAL_KEY_BY_NAME = new Map(COLUMNS.map(n => [n, toKey(n)]));
const NAME_BY_OFFICIAL_KEY = new Map(COLUMNS.map(n => [toKey(n), n]));

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
  const btn = $("#themeToggle");
  if (!btn) return;
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  setTheme(saved, btn);
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    setTheme(next, btn);
  });
}

/* Elements */
const cardsEl = $("#cards");
const pagerEl = $("#pager");
const pageNumsEl = $("#pageNumbers");
const resultsMetaEl = $("#resultsMeta");
const qEl = $("#q");
const viewCardsBtn = $("#viewCards");
const viewListBtn = $("#viewList");
const mainEl = $("#main");
const sortEl = $("#sortBy");
const filtersGridEl = $("#filtersGrid");
const filtersForm = $("#filtersForm");
const clearBtn = $("#clearFilters");
const applyBtn = $("#applyFilters");

/* State */
let rawRows = [];
let filteredRows = [];
let currentPage = 1;
let currentView = localStorage.getItem("resources:viewMode") || "cards";
let searchTerm = "";
let sortBy = localStorage.getItem("resources:sortBy") || "relevance"; // relevance | az | creator
let activeCategory = ""; // filter

/* Helpers */
function debounce(fn, ms=250){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
function normalizeStr(v){ return (v ?? "").toString().trim(); }
function safeLower(s){ return String(s || "").toLowerCase(); }

/* Image helpers (reuse from other pages) */
function firstUrlLike(raw) {
  if (!raw) return "";
  const parts = String(raw).split(MULTIVALUE_SEP).map(s=>s.trim().replace(/^['"]|['"]$/g,""));
  for (const p of parts) if (/^https?:\/\//i.test(p)) return p;
  for (const p of parts) if (/^\/\//.test(p)) return "https:" + p;
  return "";
}
function normalizeImageHost(url) {
  if (!url) return "";
  if (url.startsWith("http://")) url = "https://" + url.slice(7);
  const g = url.match(/drive\\.google\\.com\\/file\\/d\\/([^/]+)\\//);
  if (g) return `https://drive.google.com/uc?export=view&id=${g[1]}`;
  if (/^https:\\/\\/www\\.dropbox\\.com\\//i.test(url)) {
    url = url.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace(/[?&]dl=\\d/, "");
  }
  return url;
}
function getImageUrl(row){
  const raw = normalizeStr(row["Image"]);
  if (!raw) return "";
  const u = firstUrlLike(raw);
  return normalizeImageHost(u);
}

/* CSV normalize */
function buildHeaderMap(csvHeaders){
  const map = new Map();
  for (const h of csvHeaders){
    const k = toKey(h);
    if (NAME_BY_OFFICIAL_KEY.has(k)) { map.set(k, NAME_BY_OFFICIAL_KEY.get(k)); continue; }
    if (k==="img" || k==="imageurl" || k==="thumbnail" || k==="thumb") { map.set(k,"Image"); continue; }
    map.set(k, h);
  }
  return map;
}
function remapRow(row, headerMap){
  const out = {};
  for (const n of COLUMNS) out[n] = "";
  for (const [rawKey, value] of Object.entries(row)){
    const k = toKey(rawKey);
    const mapped = headerMap.get(k);
    if (!mapped) continue;
    if (NAME_BY_OFFICIAL_KEY.has(toKey(mapped))) {
      out[mapped] = value ?? "";
    }
  }
  return out;
}

/* Search */
const SEARCH_FIELDS = ["Category","Title","Creator","Description"];
function handleSearch(){
  searchTerm = qEl.value.trim();
  currentPage = 1;
  applyNow();
}

/* Sorting */
function sortRows(rows){
  if (sortBy === "relevance") return rows.slice().sort((a,b)=>(a._idx??0)-(b._idx??0));
  if (sortBy === "az") return rows.slice().sort((a,b)=>safeLower(a.Title).localeCompare(safeLower(b.Title), undefined, {numeric:true,sensitivity:"base"}));
  if (sortBy === "creator") return rows.slice().sort((a,b)=>safeLower(a.Creator).localeCompare(safeLower(b.Creator), undefined, {numeric:true,sensitivity:"base"}));
  return rows.slice();
}

/* Pager */
function paginate(rows){
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  currentPage = Math.min(Math.max(1,currentPage), totalPages);
  const start=(currentPage-1)*PAGE_SIZE;
  const pageRows=rows.slice(start, start+PAGE_SIZE);
  return { total, totalPages, pageRows };
}
function renderPager(total, totalPages) {
  resultsMetaEl.textContent = `${total.toLocaleString()} resource${total===1?"":"s"} • Page ${currentPage} of ${totalPages}`;
  pagerEl.hidden = totalPages <= 1;

  const makeBtn = (p, current=false) => {
    const b=document.createElement("button");
    b.textContent=String(p);
    if (current) b.setAttribute("aria-current","page");
    b.addEventListener("click", ()=>{ if (p!==currentPage){ currentPage=p; applyNow(false); window.scrollTo({top:0, behavior:"smooth"}); }});
    return b;
  };
  const dots = () => { const s=document.createElement("span"); s.textContent="…"; s.setAttribute("aria-hidden","true"); return s; };

  pageNumsEl.innerHTML="";
  if (totalPages>=1){
    pageNumsEl.appendChild(makeBtn(1,currentPage===1));
    const win=2;
    const start=Math.max(2,currentPage-win);
    const end=Math.min(totalPages-1,currentPage+win);
    if (start>2) pageNumsEl.appendChild(dots());
    for(let p=start;p<=end;p++) pageNumsEl.appendChild(makeBtn(p,currentPage===p));
    if (end<totalPages-1) pageNumsEl.appendChild(dots());
    if (totalPages>=2) pageNumsEl.appendChild(makeBtn(totalPages,currentPage===totalPages));
  }

  const prev = pagerEl.querySelector('[data-page="prev"]');
  const next = pagerEl.querySelector('[data-page="next"]');
  if (prev) prev.onclick = ()=>{ if (currentPage>1){ currentPage--; applyNow(false); window.scrollTo({top:0,behavior:"smooth"});} };
  if (next) next.onclick = ()=>{ if (currentPage<totalPages){ currentPage++; applyNow(false); window.scrollTo({top:0,behavior:"smooth"});} };
}

/* ===== Filters: Resource Category ===== */

function collectUniqueCategories(rows){
  const set = new Set();
  for (const r of rows){
    const v = normalizeStr(r["Category"]);
    if (v) set.add(v);
  }
  return [...set].sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));
}

function createSelect(id, labelText, options){
  const wrap=document.createElement("div"); wrap.className="select";
  const label=document.createElement("label"); label.setAttribute("for", id); label.textContent=labelText;
  const select=document.createElement("select"); select.id=id;

  const any=document.createElement("option"); any.value=""; any.textContent="Any"; select.appendChild(any);
  for (const v of options){ const o=document.createElement("option"); o.value=v; o.textContent=v; select.appendChild(o); }

  wrap.append(label, select);
  return { wrap, select };
}

function buildFiltersUI(rows){
  filtersGridEl.innerHTML = "";

  const categories = collectUniqueCategories(rows);
  const { wrap, select } = createSelect("categoryFilter", "Category", categories);
  filtersGridEl.appendChild(wrap);

  // restore persisted selection
  const saved = localStorage.getItem("resources:category") || "";
  activeCategory = saved;
  select.value = saved;

  // live update
  select.addEventListener("change", () => {
    activeCategory = select.value;
    localStorage.setItem("resources:category", activeCategory);
    currentPage = 1;
    applyNow();
  });

  // Clear / Apply buttons
  clearBtn.addEventListener("click", () => {
    activeCategory = "";
    localStorage.removeItem("resources:category");
    select.value = "";
    currentPage = 1;
    applyNow();
  });

  filtersForm.addEventListener("submit", (e) => {
    e.preventDefault();
    activeCategory = select.value;
    localStorage.setItem("resources:category", activeCategory);
    currentPage = 1;
    applyNow();
  });
}

/* Render */
function badge(text){ const b=document.createElement("span"); b.className="badge"; b.textContent=text; return b; }

function renderCards(rows){
  const asList = (localStorage.getItem("resources:viewMode") || currentView) === "list";
  cardsEl.classList.toggle("list", asList);
  cardsEl.innerHTML="";

  const frag=document.createDocumentFragment();
  for (const r of rows){
    const li=document.createElement("article");
    li.className="card";
    li.setAttribute("role","listitem");

    const title = normalizeStr(r.Title) || "Untitled Resource";
    const category = normalizeStr(r.Category);
    const creator = normalizeStr(r.Creator);
    const desc = normalizeStr(r.Description);
    const imgURL = getImageUrl(r);
    const link = normalizeStr(r.Link);

    // Make card open the resource link (new tab); don't hijack inner links
    if (link){
      li.classList.add("is-clickable");
      li.addEventListener("click",(e)=>{ if (e.target.closest("a")) return; window.open(link, "_blank", "noopener"); });
    }

    // Thumb
    let thumbWrap=null;
    if (imgURL){
      thumbWrap=document.createElement("div");
      thumbWrap.className="thumb";
      const img=document.createElement("img");
      img.src=imgURL;
      img.alt=title;
      img.loading="lazy";
      img.decoding="async";
      img.referrerPolicy="no-referrer";
      img.onerror=()=>thumbWrap.remove();
      thumbWrap.appendChild(img);
    }

    const h=document.createElement("h3");
    const a=document.createElement("a");
    a.href=link || "#";
    if (link) { a.target="_blank"; a.rel="noopener"; }
    a.textContent=title;
    h.appendChild(a);

    const subtitle=document.createElement("div");
    subtitle.className="subtitle";
    subtitle.textContent=category || "—";

    const descEl=document.createElement("div");
    descEl.className="desc";
    descEl.textContent=desc;

    const meta=document.createElement("div");
    meta.className="meta";
    if (creator) meta.appendChild(badge(creator));

    const links=document.createElement("div");
    links.className="links";
    if (link){
      const visit=document.createElement("a");
      visit.href=link; visit.target="_blank"; visit.rel="noopener";
      visit.textContent="Visit";
      links.appendChild(visit);
    }

    if (asList){
      if (thumbWrap) li.append(thumbWrap);

      const body=document.createElement("div");
      body.className="list-body";

      const header=document.createElement("div");
      header.className="list-header";
      header.append(h, subtitle);

      body.append(header);
      if (descEl.textContent.trim()) body.append(descEl);
      if (meta.childElementCount) body.append(meta);
      if (links.childElementCount){ links.classList.add("list-actions"); body.append(links); }

      li.append(body);
    } else {
      if (thumbWrap) li.append(thumbWrap);
      li.append(h, subtitle, descEl, meta, links);
    }

    frag.appendChild(li);
  }
  cardsEl.appendChild(frag);
}

/* Apply (filters + search + sort + paginate) */
function applyNow(showBusy=true){
  if (showBusy) mainEl.setAttribute("aria-busy","true");

  // 1) Filter by Category (exact match)
  let rows = rawRows;
  if (activeCategory) {
    const t = activeCategory.toLowerCase();
    rows = rows.filter(r => normalizeStr(r["Category"]).toLowerCase() === t);
  }

  // 2) Search (on Category, Title, Creator, Description)
  if (searchTerm){
    const q = searchTerm.toLowerCase();
    rows = rows.filter(r =>
      ["Category","Title","Creator","Description"].some(f => String(r[f]||"").toLowerCase().includes(q))
    );
  }

  // 3) Sort
  const sorted = sortRows(rows);

  // 4) Paginate
  const { total, totalPages, pageRows } = paginate(sorted);

  // 5) Render
  renderCards(pageRows);
  renderPager(total, totalPages);

  mainEl.setAttribute("aria-busy","false");
}

/* View toggle */
function setView(mode){
  currentView = mode;
  localStorage.setItem("resources:viewMode", mode);
  if (mode==="list"){
    viewListBtn.classList.add("active"); viewListBtn.setAttribute("aria-pressed","true");
    viewCardsBtn.classList.remove("active"); viewCardsBtn.setAttribute("aria-pressed","false");
  } else {
    viewCardsBtn.classList.add("active"); viewCardsBtn.setAttribute("aria-pressed","true");
    viewListBtn.classList.remove("active"); viewListBtn.setAttribute("aria-pressed","false");
  }
  applyNow(false);
}

/* Boot */
(async function init(){
  $("#year").textContent = new Date().getFullYear();
  initThemeToggle();

  viewCardsBtn.addEventListener("click", ()=>setView("cards"));
  viewListBtn.addEventListener("click", ()=>setView("list"));
  setView(currentView==="list" ? "list" : "cards");

  const debounced = debounce(()=>{ searchTerm=qEl.value.trim(); currentPage=1; applyNow(); }, 220);
  qEl.addEventListener("input", debounced);

  if (sortEl){
    sortEl.value = sortBy;
    sortEl.addEventListener("change", ()=>{
      sortBy = sortEl.value;
      localStorage.setItem("resources:sortBy", sortBy);
      currentPage = 1;
      applyNow();
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

  rawRows = parsed.data.map((row, i) => {
    const obj = remapRow(row, headerMap);
    obj._idx = i; // preserve CSV order
    return obj;
  });

  // Build Category filter UI and render
  buildFiltersUI(rawRows);
  applyNow();
})();
