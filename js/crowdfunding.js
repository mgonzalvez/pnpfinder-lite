/* PnPFinder — Crowdfunding page
   - Cards/List, search, sort, pager, theme toggle, filters (Status, Platform)
   - Countdown badges for Upcoming / Live / Ended
*/

const CSV_URL = "/data/crowdfunding.csv";
const PAGE_SIZE = 25;

/* Canonical columns */
const COLUMNS = [
  "Title","Designer/Publisher","Platform","Short Description","Long Description",
  "Campaign Link","Late Pledge Link","Image",
  "Launch Date (YYYY-MM-DD)","End Date (YYYY-MM-DD)","Tags"
];

/* Utils */
const MULTIVALUE_SEP = /[;,|]/;
const $  = (s,p=document)=>p.querySelector(s);
const $$ = (s,p=document)=>[...p.querySelectorAll(s)];
const toKey = (s)=>String(s??"")
  .replace(/^\uFEFF/,"")
  .normalize("NFKC")
  .trim()
  .toLowerCase()
  .replace(/[\u2018\u2019\u201C\u201D]/g,"'")
  .replace(/[^a-z0-9]+/g,"");
const OFFICIAL_KEY_BY_NAME = new Map(COLUMNS.map(n=>[n,toKey(n)]));
const NAME_BY_OFFICIAL_KEY = new Map(COLUMNS.map(n=>[toKey(n),n]));

/* Theme toggle */
const THEME_KEY = "theme";
function setTheme(theme, btn){
  const t = theme==="light"?"light":"dark";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(THEME_KEY, t);
  if (btn){
    const isLight = t === "light";
    btn.textContent = isLight ? "Light" : "Dark";
    btn.title = isLight ? "Switch to dark mode" : "Switch to light mode";
    btn.setAttribute("aria-pressed", String(isLight));
  }
}
function initThemeToggle(){
  const btn=$("#themeToggle"); if(!btn) return;
  const saved=localStorage.getItem(THEME_KEY)||"dark"; setTheme(saved, btn);
  btn.addEventListener("click", ()=> setTheme(document.documentElement.getAttribute("data-theme")==="light"?"dark":"light", btn));
}

/* Search clear */
function installClearButton(inputEl){
  if(!inputEl) return;
  const wrap = inputEl.closest(".search") || inputEl.parentElement;
  const btn = document.createElement("button");
  btn.type="button"; btn.className="clear-btn"; btn.setAttribute("aria-label","Clear search"); btn.textContent="×";
  const toggle = ()=>{ btn.style.display = inputEl.value.trim() ? "inline-flex":"none"; };
  inputEl.addEventListener("input", toggle);
  inputEl.addEventListener("keyup", (e)=>{ if(e.key==="Escape"){ btn.click(); e.stopPropagation(); }});
  btn.addEventListener("click", ()=>{ inputEl.value=""; inputEl.dispatchEvent(new Event("input",{bubbles:true})); inputEl.focus(); });
  wrap.appendChild(btn); toggle();
}

/* Image helpers (Drive/Dropbox normalize) */
function firstUrlLike(raw){
  if(!raw) return "";
  const parts = String(raw).split(MULTIVALUE_SEP).map(s=>s.trim().replace(/^['"]|['"]$/g,""));
  for (const p of parts) if (/^https?:\/\//i.test(p)) return p;
  for (const p of parts) if (/^\/\//.test(p)) return "https:"+p;
  return "";
}
function normalizeImageHost(url){
  if(!url) return "";
  if (url.startsWith("http://")) url = "https://" + url.slice(7);
  const g = url.match(/drive\.google\.com\/file\/d\/([^/]+)\//);
  if (g) return `https://drive.google.com/uc?export=view&id=${g[1]}`;
  if (/^https:\/\/www\.dropbox\.com\//i.test(url)) url = url.replace("www.dropbox.com","dl.dropboxusercontent.com").replace(/[?&]dl=\d/,"");
  return url;
}
function getImageUrl(row){ const u=firstUrlLike(row["Image"]); return normalizeImageHost(u); }

/* Date + status helpers (MM/DD/YYYY from Google Forms + ISO support) */
// Accepts:
//  - MM/DD/YYYY (Google Forms default; e.g., 9/30/2025, 09/30/2025)
//  - YYYY-MM-DD (ISO; e.g., 2025-09-30)
//  - (optional) DD/MM/YYYY if day > 12 and month <= 12 (avoid ambiguity)
function parseDateFlexible(input){
  const raw = String(input || "").trim();
  if (!raw) return null;

  // ISO (YYYY-MM-DD)
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const y = +m[1], mo = +m[2]-1, d = +m[3];
    const dt = new Date(y, mo, d, 0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // US (MM/DD/YYYY)
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mo = +m[1]-1, d = +m[2], y = +m[3];
    const dt = new Date(y, mo, d, 0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // EU (DD/MM/YYYY) — only if clearly EU-style
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = +m[1], mm = +m[2];
    if (dd > 12 && mm <= 12) {
      const y = +m[3], mo = mm-1, d = dd;
      const dt = new Date(y, mo, d, 0, 0, 0, 0);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }

  return null;
}

function daysBetween(a,b){ const ms=24*60*60*1000; return Math.ceil((b-a)/ms); }
function fmtDate(d){ return d.toLocaleDateString(undefined, {year:"numeric",month:"short",day:"numeric"}); }

function computeStatus(row){
  const now = new Date();
  const launch = parseDateFlexible(row["Launch Date (YYYY-MM-DD)"] || row["Launch Date"]);
  const end    = parseDateFlexible(row["End Date (YYYY-MM-DD)"]   || row["End Date"]);

  if (launch && now < launch) {
    const d = daysBetween(now, launch);
    return { status:"Upcoming", label: d<=7 ? `Launches in ${d} day${d===1?"":"s"}` : `Launches ${fmtDate(launch)}`, sortKeyLaunch:+launch, sortKeyEnd:+(end||Infinity) };
  }
  if (launch && end && now >= launch && now <= end) {
    const d = daysBetween(now, end);
    return { status:"Live", label: `Ends in ${d} day${d===1?"":"s"}`, sortKeyLaunch:+launch, sortKeyEnd:+end };
  }
  if (end && now > end) {
    return { status:"Ended", label:`Ended ${fmtDate(end)}`, sortKeyLaunch:+(launch||-Infinity), sortKeyEnd:+end };
  }
  if (end && !launch && now <= end) return { status:"Live", label:`Ends ${fmtDate(end)}`, sortKeyLaunch:0, sortKeyEnd:+end };
  return { status:"Upcoming", label: launch ? `Launches ${fmtDate(launch)}` : "Date TBA", sortKeyLaunch:+(launch||Infinity), sortKeyEnd:+(end||Infinity) };
}

/* DOM refs */
const cardsEl = $("#cards");
const pagerEl = $("#pager");
const pageNumsEl = $("#pageNumbers");
const resultsMetaEl = $("#resultsMeta");
const qEl = $("#q");
const viewCardsBtn = $("#viewCards");
const viewListBtn  = $("#viewList");
const mainEl = $("#main");
const sortEl = $("#sortBy");
const filtersForm = $("#filtersForm");
const filtersGridEl = $("#filtersGrid");
const clearBtn = $("#clearFilters");

/* State */
let rawRows = [];
let currentPage = 1;
let currentView = localStorage.getItem("crowd:viewMode") || "cards";
let searchTerm = "";
let sortBy = localStorage.getItem("crowd:sortBy") || "relevance";
let activePlatform = "";
let activeStatus = "";

/* Filters UI */
function unique(values){ return [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"})); }
function selectWrap(id,label,options){
  const wrap=document.createElement("div"); wrap.className="select";
  const lab=document.createElement("label"); lab.htmlFor=id; lab.textContent=label;
  const sel=document.createElement("select"); sel.id=id;
  sel.innerHTML = `<option value="">Any</option>` + options.map(v=>`<option>${v}</option>`).join("");
  wrap.append(lab, sel); return {wrap, sel};
}
function buildFiltersUI(rows){
  filtersGridEl.innerHTML="";
  const platforms = unique(rows.map(r=>String(r["Platform"]||"").trim()));
  const statuses  = ["Upcoming","Live","Ended"];
  const {wrap:wp, sel:pSel} = selectWrap("platformFilter","Platform", platforms);
  const {wrap:ws, sel:sSel} = selectWrap("statusFilter","Status", statuses);
  filtersGridEl.append(wp, ws);

  pSel.value = localStorage.getItem("crowd:platform") || "";
  sSel.value = localStorage.getItem("crowd:status") || "";
  activePlatform = pSel.value; activeStatus = sSel.value;

  pSel.addEventListener("change", ()=>{ activePlatform=pSel.value; localStorage.setItem("crowd:platform", activePlatform); currentPage=1; applyNow(); });
  sSel.addEventListener("change", ()=>{ activeStatus=sSel.value;  localStorage.setItem("crowd:status", activeStatus);  currentPage=1; applyNow(); });

  clearBtn.addEventListener("click", ()=>{
    activePlatform=""; activeStatus="";
    localStorage.removeItem("crowd:platform"); localStorage.removeItem("crowd:status");
    pSel.value=""; sSel.value="";
    currentPage=1; applyNow();
  });

  filtersForm.addEventListener("submit",(e)=>{ e.preventDefault(); currentPage=1; applyNow(); });
}

/* Search/sort */
function handleSearch(){ searchTerm=qEl.value.trim(); currentPage=1; applyNow(); }
function safeLower(s){ return String(s||"").toLowerCase(); }
function sortRows(rows){
  if (sortBy==="relevance") return rows.slice().sort((a,b)=> (a._idx??0)-(b._idx??0));
  if (sortBy==="az")        return rows.slice().sort((a,b)=> safeLower(a.Title).localeCompare(safeLower(b.Title),undefined,{numeric:true,sensitivity:"base"}));
  if (sortBy==="launch")    return rows.slice().sort((a,b)=> (a._sortLaunch ?? Infinity) - (b._sortLaunch ?? Infinity));
  if (sortBy==="end")       return rows.slice().sort((a,b)=> (a._sortEnd ?? Infinity) - (b._sortEnd ?? Infinity));
  return rows;
}

/* Pager */
function paginate(rows){
  const total=rows.length; const totalPages=Math.max(1, Math.ceil(total/PAGE_SIZE));
  currentPage = Math.min(Math.max(1,currentPage), totalPages);
  const start=(currentPage-1)*PAGE_SIZE; const pageRows=rows.slice(start, start+PAGE_SIZE);
  return { total, totalPages, pageRows };
}
function renderPager(total, totalPages){
  resultsMetaEl.textContent = `${total.toLocaleString()} campaign${total===1?"":"s"} • Page ${currentPage} of ${totalPages}`;
  pagerEl.hidden = totalPages <= 1;
  const makeBtn = (p,cur=false)=>{ const b=document.createElement("button"); b.textContent=String(p); if(cur) b.setAttribute("aria-current","page"); b.onclick=()=>{ if(p!==currentPage){ currentPage=p; applyNow(false); window.scrollTo({top:0,behavior:"smooth"});} }; return b; };
  const dots = ()=>{ const s=document.createElement("span"); s.textContent="…"; s.setAttribute("aria-hidden","true"); return s; };
  pageNumsEl.innerHTML="";
  if (totalPages>=1){
    pageNumsEl.appendChild(makeBtn(1,currentPage===1));
    const win=2, start=Math.max(2,currentPage-win), end=Math.min(totalPages-1,currentPage+win);
    if (start>2) pageNumsEl.appendChild(dots());
    for(let p=start;p<=end;p++) pageNumsEl.appendChild(makeBtn(p,currentPage===p));
    if (end<totalPages-1) pageNumsEl.appendChild(dots());
    if (totalPages>=2) pageNumsEl.appendChild(makeBtn(totalPages,currentPage===totalPages));
  }
  const prev=pagerEl.querySelector('[data-page="prev"]'); const next=pagerEl.querySelector('[data-page="next"]');
  if (prev) prev.onclick=()=>{ if(currentPage>1){ currentPage--; applyNow(false); window.scrollTo({top:0,behavior:"smooth"});} };
  if (next) next.onclick=()=>{ if(currentPage<totalPages){ currentPage++; applyNow(false); window.scrollTo({top:0,behavior:"smooth"});} };
}

/* Render */
function badge(text, cls=""){ const b=document.createElement("span"); b.className=`badge ${cls}`.trim(); b.textContent=text; return b; }
function linkBtn(href,label){ const a=document.createElement("a"); a.href=href; a.target="_blank"; a.rel="noopener"; a.textContent=label; return a; }

function renderCards(rows){
  const asList = (localStorage.getItem("crowd:viewMode") || currentView) === "list";
  cardsEl.classList.toggle("list", asList);
  cardsEl.innerHTML="";

  const frag = document.createDocumentFragment();
  for (const r of rows){
    const li=document.createElement("article"); li.className="card"; li.setAttribute("role","listitem");

    const title   = String(r["Title"]||"").trim() || "Untitled Campaign";
    const creator = String(r["Designer/Publisher"]||"").trim();
    const platform= String(r["Platform"]||"").trim();
    const short   = String(r["Short Description"]||"").trim();
    const link    = String(r["Campaign Link"]||"").trim();
    const late    = String(r["Late Pledge Link"]||"").trim();
    const imgURL  = getImageUrl(r);

    // Status / callout
    const {status, label} = computeStatus(r);
    const statusCls = status==="Live"?"status-live": status==="Upcoming"?"status-up":"status-ended";

    if (link){
      li.classList.add("is-clickable");
      li.addEventListener("click",(e)=>{ if(e.target.closest("a")) return; window.open(link, "_blank", "noopener"); });
    }

    // Thumb
    let thumbWrap=null;
    if (imgURL){
      thumbWrap=document.createElement("div"); thumbWrap.className="thumb";
      const img=document.createElement("img");
      img.src=imgURL; img.alt=title; img.loading="lazy"; img.decoding="async"; img.referrerPolicy="no-referrer";
      img.onerror=()=>thumbWrap.remove();
      thumbWrap.appendChild(img);
    }

    const h=document.createElement("h3");
    const a=document.createElement("a"); a.href=link||"#"; if(link){ a.target="_blank"; a.rel="noopener"; }
    a.textContent=title; h.appendChild(a);

    const subtitle=document.createElement("div"); subtitle.className="subtitle";
    subtitle.textContent = [platform, creator].filter(Boolean).join(" • ");

    const desc=document.createElement("div"); desc.className="desc"; desc.textContent=short;

    const meta=document.createElement("div"); meta.className="meta";
    meta.appendChild(badge(status, statusCls));
    meta.appendChild(badge(label));
    if (platform) meta.appendChild(badge(platform));

    const links=document.createElement("div"); links.className="links";
    if (link) links.appendChild(linkBtn(link, status==="Ended" && late ? "Campaign (archived)" : "Visit campaign"));
    if (late) links.appendChild(linkBtn(late, "Late pledge"));

    if (asList){
      if (thumbWrap) li.append(thumbWrap);
      const body=document.createElement("div"); body.className="list-body";
      const header=document.createElement("div"); header.className="list-header"; header.append(h, subtitle);
      body.append(header);
      if (desc.textContent.trim()) body.append(desc);
      body.append(meta);
      if (links.childElementCount){ links.classList.add("list-actions"); body.append(links); }
      li.append(body);
    } else {
      if (thumbWrap) li.append(thumbWrap);
      li.append(h, subtitle, desc, meta, links);
    }

    frag.appendChild(li);
  }
  cardsEl.appendChild(frag);
}

/* Apply */
function applyNow(showBusy=true){
  if (showBusy) mainEl.setAttribute("aria-busy","true");

  // compute derived fields
  let rows = rawRows.map(r => ({...r}));

  for (const r of rows){
    const st = computeStatus(r);
    r._status = st.status;
    r._statusLabel = st.label;
    r._sortLaunch = st.sortKeyLaunch;
    r._sortEnd = st.sortKeyEnd;
  }

  // filter
  if (activePlatform) rows = rows.filter(r => String(r["Platform"]||"").trim().toLowerCase() === activePlatform.toLowerCase());
  if (activeStatus)   rows = rows.filter(r => r._status === activeStatus);
  if (searchTerm){
    const q = searchTerm.toLowerCase();
    rows = rows.filter(r =>
      ["Title","Designer/Publisher","Platform","Short Description","Long Description","Tags"].some(f => String(r[f]||"").toLowerCase().includes(q))
    );
  }

  // sort
  const sorted = sortRows(rows);

  // paginate + render
  const { total, totalPages, pageRows } = paginate(sorted);
  renderCards(pageRows);
  renderPager(total, totalPages);

  mainEl.setAttribute("aria-busy","false");
}

/* View toggle */
function setView(mode){
  currentView = mode; localStorage.setItem("crowd:viewMode", mode);
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
  const yearEl=$("#year"); if (yearEl) yearEl.textContent=new Date().getFullYear();
  initThemeToggle();

  // Search + clear
  installClearButton(qEl);
  qEl.addEventListener("input", ()=>{ searchTerm=qEl.value.trim(); currentPage=1; applyNow(); });

  // View
  viewCardsBtn.addEventListener("click", ()=>setView("cards"));
  viewListBtn.addEventListener("click", ()=>setView("list"));
  setView(currentView==="list" ? "list" : "cards");

  // Sort
  if (sortEl){
    sortEl.value = sortBy;
    sortEl.addEventListener("change", ()=>{
      sortBy = sortEl.value;
      localStorage.setItem("crowd:sortBy", sortBy);
      currentPage=1; applyNow();
    });
  }

  // Load CSV
  const csvText = await fetch(CSV_URL, { cache: "no-cache" }).then(r=>r.text());
  const parsed = Papa.parse(csvText, { header:true, skipEmptyLines:true, transformHeader:(h)=>h.replace(/^\uFEFF/,"").trim() });

  // Map headers to canonical names
  const headerMap = new Map();
  for (const h of parsed.meta.fields || []){
    const k = toKey(h);
    if (NAME_BY_OFFICIAL_KEY.has(k)) { headerMap.set(k, NAME_BY_OFFICIAL_KEY.get(k)); continue; }
    // aliases
    if (k==="creator" || k==="designer" || k==="publisher" || k==="designerpublisher") { headerMap.set(k, "Designer/Publisher"); continue; }
    if (k==="campaign" || k==="link" || k==="projectlink" || k==="projecturl") { headerMap.set(k, "Campaign Link"); continue; }
    if (k==="latepledge" || k==="latepledgelink" || k==="pledgemanager") { headerMap.set(k, "Late Pledge Link"); continue; }
    if (k==="launchdate" || k==="launch") { headerMap.set(k, "Launch Date (YYYY-MM-DD)"); continue; }
    if (k==="enddate" || k==="deadline" || k==="end") { headerMap.set(k, "End Date (YYYY-MM-DD)"); continue; }
    headerMap.set(k, h);
  }

  rawRows = parsed.data.map((row,i)=>{
    const out = {}; for (const n of COLUMNS) out[n]="";
    for (const [rk, val] of Object.entries(row)){
      const mapped = headerMap.get(toKey(rk));
      if (mapped && NAME_BY_OFFICIAL_KEY.has(toKey(mapped))) out[mapped] = val ?? "";
    }
    out._idx = i; // CSV order = relevance
    return out;
  });

  buildFiltersUI(rawRows);
  applyNow();
})();

