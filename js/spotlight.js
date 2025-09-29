(function(){
  const CSV_URL = "data/games.csv";
  const SPOTLIGHT_URL = "data/spotlight.json";
  let currentView = localStorage.getItem("viewMode") || "cards";
  const $ = (s, p=document) => p.querySelector(s);

  function normalizeStr(v){ return (v==null? "": String(v)).trim(); }
  function slugify(s){ return normalizeStr(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function gameKey(row){ const title=row["Game Title"]||row["Title"]||row.title||""; const designer=row["Designer"]||row.designer||""; return `game_${slugify(title)}__${slugify(designer)}`; }
  function badge(text){ const b=document.createElement("span"); b.className="badge"; b.textContent=text; return b; }
  function linkBtn(href,label){ const a=document.createElement("a"); a.href=href; a.target="_blank"; a.rel="noopener"; a.textContent=label; return a; }
  function getImageUrl(row){ return normalizeStr(row["Game Image"]) || ""; }
  function mdToHtml(md){ if(!md) return ""; let h=md.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); h=h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\n/g,'<br />'); return h; }

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
    const btn = $("#themeToggle");
    if (!btn) return;
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved, btn);
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      setTheme(next, btn);
    });
  }
  function setYear(){ const y=$("#year"); if (y) y.textContent = String(new Date().getFullYear()); }

  // Robust CSV loader (uses Papa if available; else minimal parser)
  async function loadCSV(url){
    const text = await fetch(url, {cache:"no-store"}).then(r=>{
      if (!r.ok) throw new Error(`Failed to load ${url} (${r.status})`);
      return r.text();
    });
    if (window.Papa){
      return new Promise(resolve=>{
        window.Papa.parse(text, {
          header:true, skipEmptyLines:true,
          complete: (parsed) => {
            const rows = parsed.data.map((row,i)=>{ row._idx=i; return row; });
            resolve(rows);
          }
        });
      });
    }
    // Fallback: very simple CSV (handles commas but not quotes/newlines-in-cells)
    const [headerLine, ...lines] = text.trim().split(/\r?\n/);
    const headers = headerLine.split(",").map(h=>h.trim());
    const rows = lines.map((ln,i)=>{
      const cells = ln.split(","); const row = {};
      headers.forEach((h,idx)=> row[h]=cells[idx]||"");
      row._idx = i;
      return row;
    });
    return rows;
  }

  function renderHero(def){
    const box = $("#hero"); if (!box) return;
    box.innerHTML = "";
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.className = "img"; img.src = def.hero; img.alt = def.alt || def.title || "Spotlight image"; img.loading="eager";
    figure.appendChild(img);
    if (def.credit){ const cap=document.createElement("figcaption"); cap.className="credit"; cap.textContent=def.credit; figure.appendChild(cap); }
    const h2=document.createElement("h2"); h2.textContent=def.title;
    const p=document.createElement("p"); p.innerHTML=mdToHtml(def.intro);
    box.append(figure,h2,p);
  }

  function renderSwitch(defs, current){
    const containers = [$("#pagerTop"), $("#pager")].filter(Boolean);
    if (!containers.length) return;

  // Render the same set of buttons into each container
  containers.forEach(container => {
    container.innerHTML = "";
    defs.forEach(d => {
      const a = document.createElement("a");
      a.href = `spotlight.html?key=${encodeURIComponent(d.key)}`;
      a.textContent = d.title;
      a.className = "page-btn" + (d.key === current.key ? " active" : "");
      container.appendChild(a);
    });
  });
}


  function selectGames(def, rows){
    const out=[]; const seen=new Set();
    const push=(row)=>{ const k=gameKey(row); if(!seen.has(k)){ seen.add(k); out.push(row); } };

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
    const cardsEl = $("#cards");
    const asList = (localStorage.getItem("viewMode") || "cards") === "list";
    cardsEl.classList.toggle("list", asList);
    cardsEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const r of rows) {
      const li = document.createElement("article");
      li.className = "card is-clickable";
      li.setAttribute("role", "listitem");

      const title     = normalizeStr(r["Game Title"]) || "Untitled";
      const mechanism = normalizeStr(r["Main Mechanism"]);
      const shortDesc = normalizeStr(r["One-Sentence Short Description"]);
      const category  = normalizeStr(r["Game Category"]);
      const players   = normalizeStr(r["Number of Players"]);
      const imgURL    = getImageUrl(r);
      const detailsHref = `game.html?id=${encodeURIComponent(r._idx)}`;

      li.addEventListener("click", (e) => { if (e.target.closest("a")) return; location.href = detailsHref; });

      let thumbWrap = null;
      if (imgURL) {
        thumbWrap = document.createElement("div");
        thumbWrap.className = "thumb";
        const img = document.createElement("img");
        img.src = imgURL; img.alt = title; img.loading="lazy"; img.decoding="async"; img.referrerPolicy="no-referrer";
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
        const body = document.createElement("div"); body.className = "list-body";
        const header = document.createElement("div"); header.className = "list-header"; header.append(h, subtitle);
        body.append(header);
        if (desc.textContent) body.append(desc);
        if (meta.childElementCount) body.append(meta);
        if (links && links.childElementCount) { links.classList.add("list-actions"); body.append(links); }
        li.append(body);
      } else {
        if (thumbWrap) li.append(thumbWrap);
        li.append(h, subtitle, desc, meta, links);
      }
      frag.appendChild(li);
    }
    cardsEl.appendChild(frag);
  }

  function isoWeek(dt=new Date()){
    const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    const dayNum = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil(((d - yearStart) / 86400000 + 1)/7);
  }

  function showError(msg){
    const b = $("#errorBanner"); if (!b) return;
    b.textContent = msg; b.hidden = false;
  }

  async function init(){
    try {
      const viewCardsBtn = $("#viewCards");
      const viewListBtn  = $("#viewList");
      $("#year").textContent = new Date().getFullYear();
      initThemeToggle();

      viewCardsBtn.addEventListener("click",()=>{ localStorage.setItem("viewMode","cards"); renderCards(window.__picks||[]); });
      viewListBtn.addEventListener("click",()=>{ localStorage.setItem("viewMode","list");  renderCards(window.__picks||[]); });

      const [defs, rows] = await Promise.all([
        fetch(SPOTLIGHT_URL, {cache:"no-store"}).then(r=>{ if(!r.ok) throw new Error("Failed to load spotlight.json"); return r.json(); }),
        loadCSV(CSV_URL),
      ]);

      const cyclers = defs.filter(d => d.cycle);
      let cur = defs[0];
      const reqKey = (new URLSearchParams(location.search)).get("key");
      if (reqKey){ cur = defs.find(d => d.key === reqKey) || cur; }
      else if (cyclers.length){ cur = cyclers[isoWeek() % cyclers.length]; }

      renderHero(cur);
      renderSwitch(defs, cur);
      window.__picks = selectGames(cur, rows);
      const meta = $("#resultsMeta"); if (meta) meta.textContent = `${window.__picks.length} featured games`;
      renderCards(window.__picks);
    } catch (err){
      console.error(err);
      showError(err.message || "Spotlight failed to load.");
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();