/* PnPFinder — resilient CSV loader + UI */

const CSV_URL = "/data/games.csv";
const PAGE_SIZE = 25;

// OFFICIAL COLUMN LIST (the display names you want in the app)
const COLUMNS = [
  "Game Title","Designer","Publisher","Free or Paid","Price","Number of Players","Playtime","Age Range",
  "Theme","Main Mechanism","Secondary Mechanism","Gameplay Complexity","Gameplay Mode","Game Category",
  "PnP Crafting Challenge Level","One-Sentence Short Description","Long Description","Download Link",
  "Secondary Download Link","Print Components","Other Components","Languages","Release Year","Game Image",
  "Curated Lists","Report Dead Link"
];

// Build a canonical form of each official column to aid matching
const toKey = (s) => String(s ?? "")
  .replace(/^\uFEFF/, "")            // strip BOM
  .normalize("NFKC")
  .trim()
  .toLowerCase()
  .replace(/[\u2018\u2019\u201C\u201D]/g, "'") // normalize curly quotes (lightly)
  .replace(/[^a-z0-9]+/g, "");       // drop non-alphanumerics

const OFFICIAL_KEY_BY_NAME = new Map(COLUMNS.map(name => [name, toKey(name)]));
const NAME_BY_OFFICIAL_KEY = new Map(COLUMNS.map(name => [toKey(name), name]));

// Which columns get text search hits
const SEARCH_FIELDS = [
  "Game Title","Designer","Publisher","One-Sentence Short Description","Long Description","Theme","Main Mechanism","Secondary Mechanism","Curated Lists"
];

const MULTIVALUE_SEP = /[;,|]/;
const MULTIVALUE_FIELDS = new Set(["Languages","Curated Lists","Game Category"]);
const URL_FIELDS = new Set(["Download Link","Secondary Download Link","Game Image"]);
const NUMERIC_FIELDS = new Set(["Price","Release Year"]);
const RANGEISH_FIELDS = new Set(["Number of Players","Playtime","Age Range"]);
const FREEPAID_FIELD = "Free or Paid";

// State
let rawRows = [];
let filteredRows = [];
let currentPage = 1;
let currentView = localStorage.getItem("viewMode") || "cards";
let searchTerm = "";
let activeFilters = {};

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

const debounce = (fn, ms=250) => { let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} };

function normalizeStr(v){ return (v ?? "").toString().trim(); }
function isEmpty(v){ return v == null || String(v).trim() === ""; }
function parseNumber(v){ const n=Number(String(v).replace(/[^\d.\-]/g,"")); return Number.isFinite(n)?n:null; }

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
  if (needle==="Free") return v.includes("free") || parseNumber($("#Price")?.value)===0;
  if (needle==="Paid") return !v.includes("free");
  return exactOrContains(value, needle);
}

/* --------- CSV LOADING WITH HEADER NORMALIZATION ---------- */

function buildHeaderMap(csvHeaders){
  // Map csvHeaderKey -> Official Display Name
  const map = new Map();
  for (const h of csvHeaders){
    const k = toKey(h);
    // direct official match?
    if (NAME_BY_OFFICIAL_KEY.has(k)){
      map.set(k, NAME_BY_OFFICIAL_KEY.get(k));
      continue;
    }
    // fuzzy helpers: sometimes "title" or "gametitle"
    if (k==="title") { map.set(k, "Game Title"); continue; }
    if (k==="players" || k==="numberofplayers") { map.set(k,"Number of Players"); continue; }
    if (k==="playtime" || k==="playduration") { map.set(k,"Playtime"); continue; }
    if (k==="agerange" || k==="age") { map.set(k,"Age Range"); continue; }
    if (k==="category" || k==="mode" || k==="gameplaymode") { map.set(k,"Game Category"); continue; }

    // fallback: if a header isn't recognized, we keep it as-is (we won't filter on it)
    map.set(k, h);
  }
  return map;
}

function remapRow(row, headerMap){
  // Create a full row object with ALL official columns
  const out = {};
  for (const name of COLUMNS) out[name] = "";

  // For every key in the parsed CSV row, try to map it to an official column
  for (const [rawKey, value] of Object.entries(row)){
    const k = toKey(rawKey);
    const mappedName = headerMap.get(k);
    if (!mappedName) continue;

    // If mappedName is one of our official columns, place it there; else keep by its visible name
    if (NAME_BY_OFFICIAL_KEY.has(toKey(mappedName))){
      out[mappedName] = value ?? "";
    } else {
      // non-official headers are ignored for the app, but you could store them if needed
    }
  }
  return out;
}

/* --------- UI BUILDERS ---------- */

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
  for (const col of COLUMNS){
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

function paginate(rows){
  const total=rows.length;
  const totalPages=Math.max(1, Math.ceil(total / PAGE_SIZE));
  currentPage=Math.min(Math.max(1,currentPage), totalPages);
  const start=(currentPage-1)*PAGE_SIZE;
  const pageRows=rows.slice(start, start+PAGE_SIZE);
  return { total, totalPages, pageRows };
}

function renderCards(rows){
  const asList=currentView==="list";
  cardsEl.classList.toggle("list", asList);
  cardsEl.innerHTML="";

  const frag=document.createDocumentFragment();
  for (const r of rows){
    const li=document.createElement("article");
    li.className="card"; li.setAttribute("role","listitem");

    const title=normalizeStr(r["Game Title"]) || "Untitled";
    const mechanism=normalizeStr(r["Main Mechanism"]);
    const shortDesc=normalizeStr(r["One-Sentence Short Description"]);
    const category=normalizeStr(r["Game Category"]);
    const players=normalizeStr(r["Number of Players"]);

    const h=document.createElement("h3"); h.textContent=title;
    const subtitle=document.createElement("div"); subtitle.className="subtitle"; subtitle.textContent=mechanism || "—";
    const desc=document.createElement("div"); desc.className="desc"; desc.textContent=shortDesc || normalizeStr(r["Long Description"]).slice(0,180);
    const meta=document.createElement("div"); meta.className="meta";
    if (category) meta.appendChild(badge(category));
    if (players) meta.appendChild(badge(`${players} players`));

    const links=document.createElement("div"); links.className="links";
    const dl1=normalizeStr(r["Download Link"]); const dl2=normalizeStr(r["Secondary Download Link"]);
    if (dl1) links.appendChild(linkBtn(dl1,"Download"));
    if (dl2) links.appendChild(linkBtn(dl2,"Alt link"));

    li.append(h, subtitle, desc, meta, links);
    frag.appendChild(li);
  }
  cardsEl.appendChild(frag);
}

function badge(text){ const b=document.createElement("span"); b.className="badge"; b.textContent=text; return b; }
function linkBtn(href,label){ const a=document.createElement("a"); a.href=href; a.target="_blank"; a.rel="noopener"; a.textContent=label; return a; }

function renderPager(total, totalPages){
  resultsMetaEl.textContent=`${total.toLocaleString()} game${total===1?"":"s"} • Page ${currentPage} of ${totalPages}`;
  pagerEl.hidden = totalPages <= 1;
  pageNumsEl.innerHTML="";
  const front=Math.max(1,currentPage-2), back=Math.min(totalPages,currentPage+2);
  for (let p=front; p<=back; p++){
    const btn=document.createElement("button"); btn.textContent=String(p);
    if (p===currentPage) btn.setAttribute("aria-current","page");
    btn.addEventListener("click",()=>{ currentPage=p; applyFiltersNow(false); window.scrollTo({top:0,behavior:"smooth"}); });
    pageNumsEl.appendChild(btn);
  }
}
function wirePagerButtons(totalPages){
  pagerEl.querySelector('[data-page="prev"]').onclick=()=>{ if (currentPage>1){ currentPage--; applyFiltersNow(false); window.scrollTo({top:0,behavior:"smooth"});} };
  pagerEl.querySelector('[data-page="next"]').onclick=()=>{ if (currentPage<totalPages){ currentPage++; applyFiltersNow(false); window.scrollTo({top:0,behavior:"smooth"});} };
}

function applyFiltersNow(showBusy=true){
  if (showBusy) mainEl.setAttribute("aria-busy","true");
  filteredRows = rawRows.filter(rowMatchesFilters);
  const { total, totalPages, pageRows } = paginate(filteredRows);
  renderCards(pageRows); renderPager(total,totalPages); wirePagerButtons(totalPages);
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

(async function init(){
  $("#year").textContent=new Date().getFullYear();
  viewCardsBtn.addEventListener("click",()=>setView("cards"));
  viewListBtn.addEventListener("click",()=>setView("list"));
  setView(currentView==="list" ? "list" : "cards");
  qEl.addEventListener("input", handleSearch);

  // Load CSV. We let Papa handle BOM and header trimming as well.
  const csvText = await fetch(CSV_URL).then(r=>r.text());

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(), // extra safety
  });

  const csvHeaders = parsed.meta.fields || [];
  const headerMap = buildHeaderMap(csvHeaders);

  // Create normalized rows aligned to our OFFICIAL column names
  rawRows = parsed.data.map(row => remapRow(row, headerMap));

  // If "Game Title" truly missing in data, we’ll still have "", but most cases will now map correctly
  buildFiltersUI(rawRows);
  applyFiltersNow();
})();
