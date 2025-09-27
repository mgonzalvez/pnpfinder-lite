const CSV_URL = "/data/games.csv";
const SPOTLIGHT_URL = "/data/spotlight.json";

// --- utilities ---
const qs = new URLSearchParams(location.search);
const $ = sel => document.querySelector(sel);
const el = (tag, cls, txt) => { const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };

function slugify(s){ return String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
function gameKey(row){
  const title = row["Game Title"] || row["Title"] || row.title || '';
  const designer = row["Designer"] || row.designer || '';
  return `game_${slugify(title)}__${slugify(designer)}`;
}
function isoWeek(dt=new Date()){
  const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const dayNum = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil(((d - yearStart) / 86400000 + 1)/7);
}

// Minimal markdown → HTML (allow links/emphasis only)
function mdToHtml(md){
  if (!md) return '';
  let html = md
    .replace(/&/g, "&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); // escape first
  html = html
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>') // links
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // bold
    .replace(/\*([^*]+)\*/g, '<em>$1</em>') // italics
    .replace(/\n/g, '<br />');
  return html;
}

// --- data loading ---
async function loadCSV(url){
  const text = await fetch(url, {cache:'no-store'}).then(r=>r.text());
  return new Promise(resolve=>{
    Papa.parse(text, { header:true, skipEmptyLines:true, complete: r => resolve(r.data) });
  });
}

async function init(){
  const [spotDefs, rows] = await Promise.all([
    fetch(SPOTLIGHT_URL, {cache:'no-store'}).then(r=>r.json()),
    loadCSV(CSV_URL),
  ]);

  // pick spotlight
  const allCyclers = spotDefs.filter(s => s.cycle);
  let cur = spotDefs[0];
  const reqKey = qs.get('key');
  if (reqKey){
    cur = spotDefs.find(s => s.key === reqKey) || cur;
  } else if (allCyclers.length){
    cur = allCyclers[isoWeek() % allCyclers.length];
  }

  renderHero(cur);
  renderSwitch(spotDefs, cur);
  const picks = selectGames(cur, rows);
  renderList(picks);
}

function renderHero(s){
  const box = $('#hero'); box.innerHTML='';
  const figure = document.createElement('figure');

  const img = document.createElement('img');
  img.className = 'img';
  img.alt = s.alt || s.title || 'Spotlight image';
  img.src = s.hero;
  img.loading = 'eager';
  figure.appendChild(img);

  if (s.credit){
    const figcap = document.createElement('figcaption');
    figcap.className = 'credit';
    figcap.textContent = s.credit;
    figure.appendChild(figcap);
  }

  const h2 = document.createElement('h2'); h2.textContent = s.title;
  const p = document.createElement('p');  p.innerHTML = mdToHtml(s.intro);

  box.append(figure, h2, p);
}

function renderSwitch(defs, current){
  const box = $('#pager'); box.innerHTML='';
  defs.forEach(d=>{
    const a = el('a', d.key===current.key?'active':'', d.title);
    a.href = `/spotlight.html?key=${encodeURIComponent(d.key)}`;
    box.appendChild(a);
  });
}

function selectGames(spot, rows){
  const out = [];
  const seen = new Set();
  const push = (row) => { const k = gameKey(row); if (!seen.has(k)) { seen.add(k); out.push(row); } };

  // Curated fixed picks first
  (spot.curated || []).forEach(c=>{
    const row = rows.find(r =>
      (String(r["Game Title"]||'').trim().toLowerCase() === String(c.title||'').trim().toLowerCase()) &&
      (String(r["Designer"]||'').trim().toLowerCase()   === String(c.designer||'').trim().toLowerCase())
    );
    if (row) push(row);
  });

  // Query rules
  if (spot.select?.mode === 'query'){
    let pool = rows.slice();
    (spot.select.where || []).forEach(([col,op,val])=>{
      const C = col; const V = String(val||'').toLowerCase();
      if (op === 'includes'){
        pool = pool.filter(r => String(r[C]||'').toLowerCase().includes(V));
      } else if (op === 'equals'){
        pool = pool.filter(r => String(r[C]||'').trim().toLowerCase() === V);
      } else if (op === 'regex'){
        const re = new RegExp(val, 'i'); pool = pool.filter(r => re.test(String(r[C]||'')));
      }
    });

    // Sorting helpers (best-effort against existing columns)
    const sort = spot.select.sort || '';
    pool = pool.map((r,i)=>({r,i}));
    if (sort === 'downloads_desc'){
      pool.sort((a,b) => (parseInt(b.r["Downloads"]||0,10) - parseInt(a.r["Downloads"]||0,10)) || (a.i-b.i));
    } else if (sort === 'rating_desc'){
      pool.sort((a,b) => ((parseFloat(b.r["RatingAvg"]||0) - parseFloat(a.r["RatingAvg"]||0)) || (parseInt(b.r["RatingCount"]||0,10) - parseInt(a.r["RatingCount"]||0,10)) || (a.i-b.i)));
    } else if (sort === 'recent_desc'){
      pool.sort((a,b) => (new Date(b.r["Date Added"]||0) - new Date(a.r["Date Added"]||0)) || (a.i-b.i));
    }
    pool.forEach(x=>push(x.r));
  }

  const lim = spot.select?.limit || 16;
  return out.slice(0, lim);
}

function renderList(rows){
  const list = $('#list'); list.innerHTML='';
  rows.forEach(r=>{
    const card = el('article','spot-card');
    // image (if your CSV has an Image or Cover column)
    const imgUrl = r["Image"] || r["Cover"] || '';
    if (imgUrl){
      const img = el('img','thumb');
      img.src = imgUrl; img.alt = r["Game Title"] || 'cover';
      img.loading = 'lazy'; img.decoding='async';
      img.style.width='100%'; img.style.aspectRatio='3/2'; img.style.objectFit='cover'; img.style.borderRadius='.5rem';
      card.appendChild(img);
    }

    const h3 = el('h3', null, r["Game Title"] || '(Untitled)');
    const metaBits = [r["Designer"], r["Player Count"], r["Play Time"]].filter(Boolean);
    const meta = el('div','meta', metaBits.join(' · '));
    const more = el('a', null, 'Details →');
    more.href = r["Details URL"] || r["BGG Link"] || r["Download Link"] || '#';
    more.target = "_blank"; more.rel = "noopener";

    card.append(h3, meta, more);
    list.appendChild(card);
  });
}

init().catch(console.error);
