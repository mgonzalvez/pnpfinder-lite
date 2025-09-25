/* PnPFinder — Tutorials page
   - Cards/List, search, sort, pager, images, theme toggle
   - Component filter (dropdown) with live update + Clear/Apply
   - Search clear button
*/

const CSV_URL = "/data/tutorials.csv";
const PAGE_SIZE = 25;

/* Canonical columns for tutorials */
const COLUMNS = ["Component","Title","Creator","Description","Link","Image"];

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
let currentView = localStorage.getItem("tutorials:viewMode") || "cards";
let searchTerm = "";
let sortBy = localStorage.getItem("tutorials:sortBy") || "relevance"; // relevance | az | creator
let activeComponent = ""; // new filter

/* Helpers */
function debounce(fn, ms=250){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
function normalizeStr(v){ return (v ?? "").toString().trim(); }
function safeLower(s){ return String(s || "").toLowerCase(); }

/* Image helpers */
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
  const g = url.match(/drive\.google\.com\/file\/d\/([^/]+)\//);
  if (g) return `https://drive.google.com/uc?export=view&id=${g[1]}`;
  if (/^https:\/\/www\.dropbox\.com\//i.test(url)) {
    url = url.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace(/[?&]dl=\d/, "");
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
    if (k==="" || k==="unnamed" || /^column\d+$/.test(k)) { continue; } // ignore extra unnamed column
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
const SEARCH_FIELDS = ["Component","Title","Creator","Description"];
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
  resultsMetaEl.textContent = `${total.toLocaleString()} tutorial${total===1?"":"s"} • Page ${currentPage} of ${totalPages}`;
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

/* ===== NEW: Filters (Component) ===== */

function collectUniqueComponents(rows){
  const set = new Set();
  for (const r of rows){
    const v = normalizeStr(r["Component"]);
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

  const components = collectUniqueComponents(rows);
  const { wrap, select } = createSelect("componentFilter", "Component", components);
  filtersGridEl.appendChild(wrap);

  // restore persisted selection (optional)
  const saved = localStorage.getItem("tutorials:component") || "";
  activeComponent = saved;
  select.value = saved;

  // live update
  select.addEventListener("change", () => {
    activeComponent = select.value;
    localStorage.setItem("tutorials:component", activeComponent);
    currentPage = 1;
    applyNow();
  });

  // Clear / Apply
  clearBtn.addEventListener("click", () => {
    activeComponent = "";
    localStorage.removeItem("tutorials:component");
    select.value = "";
    currentPage = 1;
    applyNow();
  });

  filtersForm.addEventListener("submit", (e) => {
    e.preventDefault();
    activeComponent = select.value;
    localStorage.setItem("tutorials:component", activeComponent);
    currentPage = 1;
    applyNow();
  });
}

/* Render */
function badge(text){ const b=document.createElement("span"); b.className="badge"; b.textContent=text; return b; }

function renderCards(rows){
  const asList = (localStorage.getItem("tutorials:viewMode") || currentView) === "list";
  cardsEl.classList.toggle("list", asList);
  cardsEl.innerHTML="";

  const frag=document.createDocumentFragment();
  for (const r of rows){
    const li=document.createElement("article");
    li.className="card";
    li.setAttribute("role","listitem");

    const title = normalizeStr(r.Title) || "Untitled Tutorial";
    const component = normalizeStr(r.Component);
    const creator = normalizeStr(r.Creator);
    const desc = normalizeStr(r.Description);
    const imgURL = getImageUrl(r);
    const link = normalizeStr(r.Link);

    // Make card open the tutorial link (new tab); don't hijack inner links
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
    subtitle.textContent=component || "—";

    const descEl=document.createElement("div");
    descEl.className="desc";
    descEl.textContent=desc;

    const meta=document.createElement("div");
    meta.className="meta";
    if (creator) meta.appendChild(badge(creator));

    const links=document.createElement("div");
    links.className="links";
    if (link){
      const watch=document.createElement("a");
      watch.href=link; watch.target="_blank"; watch.rel="noopener";
      watch.textContent="Watch";
      links.appendChild(watch);
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

/* Apply */
function applyNow(showBusy=true){
  if (showBusy) mainEl.setAttribute("aria-busy","true");

  // 1) Filter by Component (exact match)
  let rows = rawRows;
  if (activeComponent) {
    const target = activeComponent.toLowerCase();
    rows = rows.filter(r => normalizeStr(r["Component"]).toLowerCase() === target);
  }

  // 2) Search (on Component, Title, Creator, Description)
  if (searchTerm){
    const q = searchTerm.toLowerCase();
    rows = rows.filter(r =>
      ["Component","Title","Creator","Description"].some(f => String(r[f]||"").toLowerCase().includes(q))
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
  localStorage.setItem("tutorials:viewMode", mode);
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
  document.getElementById("year").textContent = new Date().getFullYear();
  initThemeToggle();

  // Search field + clear button
  installClearButton(qEl);
  const debounced = debounce(handleSearch, 220);
  qEl.addEventListener("input", debounced);

  // View toggle
  viewCardsBtn.addEventListener("click", ()=>setView("cards"));
  viewListBtn.addEventListener("click", ()=>setView("list"));
  setView(currentView==="list" ? "list" : "cards");

  // Sort
  if (sortEl){
    sortEl.value = sortBy;
    sortEl.addEventListener("change", ()=>{
      sortBy = sortEl.value;
      localStorage.setItem("tutorials:sortBy", sortBy);
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

  // Build Component filter UI and render
  buildFiltersUI(rawRows);
  applyNow();
})();
