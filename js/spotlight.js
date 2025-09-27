// PnPFinder — Spotlight page (aligns with site structure/classes)

const CSV_URL = "/data/games.csv";
const SPOTLIGHT_URL = "/data/spotlight.json";
const THEME_KEY = "theme";

const qs = new URLSearchParams(location.search);
const $ = (sel) => document.querySelector(sel);

function normalizeStr(v){ return (v==null? "": String(v)).trim(); }
function slugify(s){
  return normalizeStr(s).toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function gameKey(row){
  const title = row["Game Title"] || row["Title"] || row.title || "";
  const designer = row["Designer"] || row.designer || "";
  return `game_${slugify(title)}__${slugify(designer)}`;
}
function mdToHtml(md){
  if (!md) return "";
  let html = md.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  html = html
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g,'<br />');
  return html;
}
function badge(text){ const b=document.createElement("span"); b.className="badge"; b.textContent=text; return b; }
function linkBtn(href,label){ const a=document.createElement("a"); a.href=href; a.target="_blank"; a.rel="noopener"; a.textContent=label; return a; }

function getImageUrl(row){ return normalizeStr(row["Game Image"]) || ""; }

function setTheme(next, buttonEl){
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  if (buttonEl){
    const isLight = next === "light";
    buttonEl.textContent = isLight ? "Light" : "Dark";
    buttonEl.title = isLight ? "Switch to dark mode" : "Switch to light mode";
    buttonEl.setAttribute("aria-pressed", String(isLight));
  }
}
function initThemeToggle(){
  const btn = document.querySelector("#themeToggle");
  if (!btn) return;
  const saved = localStorage.getItem("theme") || "dark";
  setTheme(saved, btn);
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    setTheme(next, btn);
  });
}
function setYear(){ const y=document.querySelector("#year"); if (y) y.textContent = String(new Date().getFullYear()); }

async function loadCSV(url){
  const text = await fetch(url, {cache:"no-store"}).then(r=>r.text());
  return new Promise(resolve=>{
    Papa.parse(text, { header:true, skipEmptyLines:true, complete: r => resolve(r.data) });
  });
}

function renderHero(def){
  const box = document.querySelector("#hero"); if (!box) return;
  box.innerHTML = "";
  const figure = document.createElement("figure");
  const img = document.createElement("img");
  img.className = "img";
  img.src = def.hero;
  img.alt = def.alt || def.title || "Spotlight image";
  img.loading = "eager";
  figure.appendChild(img);
  if (def.credit){
    const cap = document.createElement("figcaption");
    cap.className = "credit";
    cap.textContent = def.credit;
    figure.appendChild(cap);
  }
  const h2 = document.createElement("h2"); h2.textContent = def.title;
  const p  = document.createElement("p");  p.innerHTML = mdToHtml(def.intro);
  box.append(figure, h2, p);
}

function renderSwitch(defs, current){
  const pager = document.querySelector("#pager"); if (!pager) return;
  pager.innerHTML = "";
  defs.forEach(d=>{
    const a = document.createElement("a");
    a.href = `/spotlight.html?key=${encodeURIComponent(d.key)}`;
    a.textContent = d.title;
    a.className = "page-btn" + (d.key===current.key ? " active" : "");
    pager.appendChild(a);
  });
}

function selectGames(def, rows){
  const out=[]; const seen = new Set();
  const push = (row)=>{ const k = gameKey(row); if(!seen.has(k)){ seen.add(k); out.push(row); } };

  (def.curated||[]).forEach(c=>{
    const row = rows.find(r =>
      (String(r["Game Title"]||'').trim().toLowerCase() === String(c.title||'').trim().toLowerCase()) &&
      (String(r["Designer"]||'').trim().toLowerCase()   === String(c.designer||'').trim().toLowerCase())
    );
    if (row) push(row);
  });

  if (def.select?.mode === "query"){
    let pool = rows.slice();
    (def.select.where||[]).forEach(([col,op,val])=>{
      const C = col; const V = String(val||'').toLowerCase();
      if (op === "includes"){
        pool = pool.filter(r => String(r[C]||'').toLowerCase().includes(V));
      } else if (op === "equals"){
        pool = pool.filter(r => String(r[C]||'').trim().toLowerCase() === V);
      } else if (op === "regex"){
        const re = new RegExp(val, "i"); pool = pool.filter(r => re.test(String(r[C]||'')));
      }
    });
    const sort = def.select.sort || "";
    pool = pool.map((r,i)=>({r,i}));
    if (sort === "downloads_desc"){
      pool.sort((a,b) => (parseInt(b.r["Downloads"]||0,10) - parseInt(a.r["Downloads"]||0,10)) || (a.i-b.i));
    } else if (sort === "rating_desc"){
      pool.sort((a,b) => ((parseFloat(b.r["RatingAvg"]||0) - parseFloat(a.r["RatingAvg"]||0)) || (parseInt(b.r["RatingCount"]||0,10) - parseInt(a.r["RatingCount"]||0,10)) || (a.i-b.i)));
    } else if (sort === "recent_desc"){
      pool.sort((a,b) => (new Date(b.r["Date Added"]||0) - new Date(a.r["Date Added"]||0)) || (a.i-b.i));
    }
    pool.forEach(x=>push(x.r));
  }
  const lim = def.select?.limit || 16;
  return out.slice(0, lim);
}

function renderCards(rows){
  const cardsEl = document.querySelector("#cards"); if (!cardsEl) return;
  cardsEl.innerHTML = "";
  const frag = document.createDocumentFragment();

  rows.forEach(r=>{
    const title     = (r["Game Title"]||"Untitled").trim();
    const designer  = (r["Designer"]||"").trim();
    const mechanism = (r["Main Mechanism"]||"").trim();
    const shortDesc = (r["One-Sentence Short Description"]||"").trim();
    const category  = (r["Game Category"]||"").trim();
    const players   = (r["Number of Players"]||"").trim();

    const card = document.createElement("article");
    card.className = "card"; card.setAttribute("role","listitem");

    const imgUrl = getImageUrl(r);
    if (imgUrl){
      const tw = document.createElement("div"); tw.className = "thumb";
      const img = document.createElement("img"); img.src = imgUrl; img.alt = title; img.loading="lazy"; img.decoding="async";
      tw.appendChild(img);
      card.appendChild(tw);
    }

    const h = document.createElement("h3");
    const titleLink = document.createElement("a");
    titleLink.href = (r["Details URL"]||r["BGG Link"]||r["Download Link"]||"#").trim();
    if (titleLink.href.startsWith("http")) { titleLink.target = "_blank"; titleLink.rel = "noopener"; }
    titleLink.textContent = title;
    h.appendChild(titleLink);

    const subtitle = document.createElement("div"); subtitle.className = "subtitle";
    subtitle.textContent = [designer, mechanism].filter(Boolean).join(" — ");

    const desc = document.createElement("p"); desc.className = "desc"; desc.textContent = shortDesc;

    const meta = document.createElement("div"); meta.className = "meta";
    if (category) meta.appendChild(badge(category));
    if (players)  meta.appendChild(badge(`${players} players`));

    const links = document.createElement("div"); links.className = "links";
    const dl1 = (r["Download Link"]||"").trim(); const dl2 = (r["Secondary Download Link"]||"").trim();
    if (dl1) links.appendChild(linkBtn(dl1, "Download"));
    if (dl2) links.appendChild(linkBtn(dl2, "Alt link"));

    card.append(h, subtitle);
    if (shortDesc) card.append(desc);
    if (meta.childElementCount) card.append(meta);
    if (links.childElementCount) card.append(links);

    frag.appendChild(card);
  });

  cardsEl.appendChild(frag);
}

function isoWeek(dt=new Date()){
  const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const dayNum = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil(((d - yearStart) / 86400000 + 1)/7);
}

async function init(){
  initThemeToggle(); setYear();

  const [defs, rows] = await Promise.all([
    fetch(SPOTLIGHT_URL, {cache:"no-store"}).then(r=>r.json()),
    loadCSV(CSV_URL),
  ]);

  const cyclers = defs.filter(d => d.cycle);
  let cur = defs[0];
  const reqKey = (new URLSearchParams(location.search)).get("key");
  if (reqKey){
    cur = defs.find(d => d.key === reqKey) || cur;
  } else if (cyclers.length){
    cur = cyclers[isoWeek() % cyclers.length];
  }

  renderHero(cur);
  renderSwitch(defs, cur);
  const picks = selectGames(cur, rows);
  const meta = document.querySelector("#resultsMeta"); if (meta) meta.textContent = `${picks.length} featured games`;
  renderCards(picks);
}

init().catch(console.error);
