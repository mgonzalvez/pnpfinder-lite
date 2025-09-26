/* PnPFinder — Submit page (robust)
   - Dropdowns populated from /data/games.csv (with header aliasing)
   - Required fields + maxlength counters for short/long descriptions
   - Image required only for "Game" (now compressed client-side)
   - Posts JSON (with base64 image) to /api/submit (Cloudflare Pages Function)
*/

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
(function initTheme(){
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  setTheme(saved, btn);
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    setTheme(next, btn);
  });
})();
document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("submitForm");
const statusEl = document.getElementById("submitStatus");
const errorEl = document.getElementById("submitError");
const collectionEl = document.getElementById("collection");
const gameFields = document.getElementById("gameFields");
const tutorialFields = document.getElementById("tutorialFields");
const resourceFields = document.getElementById("resourceFields");
const imageInput = document.getElementById("image");

// Game inputs / selects
const shortDesc = document.getElementById("shortDesc");
const longDesc  = document.getElementById("longDesc");
const shortCount = document.getElementById("shortDescCount");
const longCount  = document.getElementById("longDescCount");

// Dropdown elements (games)
const el = {
  freePaid: document.getElementById("freePaid"),
  players: document.getElementById("players"),
  ageRange: document.getElementById("ageRange"),
  theme: document.getElementById("theme"),
  mainMech: document.getElementById("mainMech"),
  secondaryMech: document.getElementById("secondaryMech"),
  complexity: document.getElementById("complexity"),
  mode: document.getElementById("mode"),
  category: document.getElementById("category"),
  craft: document.getElementById("craft"),
};

const CSV_URL = "/data/games.csv";
const MULTI_SEP = /[;,|]/;

// --- Header aliasing (lowercased) ---
const ALIASES = {
  "game title": ["game title","title","name"],
  "free or paid": ["free or paid","free/paid","pricing","price type","cost"],
  "number of players": ["number of players","players","player count","players count","num players","# players"],
  "age range": ["age range","age","ages","recommended age","min age"],
  "theme": ["theme","genre","setting"],
  "main mechanism": ["main mechanism","main mechanic","primary mechanism","primary mechanic","mechanism","mechanic"],
  "secondary mechanism": ["secondary mechanism","secondary mechanic","mech 2","mechanism 2","mechanics (secondary)","other mechanism"],
  "gameplay complexity": ["gameplay complexity","complexity","weight","bgg weight","rules complexity"],
  "gameplay mode": ["gameplay mode","mode","player mode","play mode"],
  "game category": ["game category","category","play style"],
  "pnp crafting challenge level": ["pnp crafting challenge level","pnp crafting challenge","crafting challenge","pnp challenge","crafting difficulty","crafting level"]
};
const aliasIndex = (() => {
  const idx = {};
  for (const canon in ALIASES) for (const a of ALIASES[canon]) idx[a] = canon;
  return idx;
})();
function canonicalizeRowKeys(row) {
  const out = {};
  for (const key in row) {
    const lc = (key || "").trim().toLowerCase();
    const canon = aliasIndex[lc] || key;
    out[canon] = row[key];
  }
  return out;
}

function addOptions(select, values, { placeholder = "— Select —" } = {}) {
  select.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = ""; ph.textContent = placeholder; ph.disabled = true; ph.selected = true;
  select.appendChild(ph);
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    select.appendChild(opt);
  }
}
function normalizeMode(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("solo")) return "Solo";
  if (s.includes("coop") || s.includes("co-op") || s.includes("cooperative")) return "Cooperative";
  if (s.includes("compet")) return "Competitive";
  return v.toString().trim();
}
function uniqSorted(arr) { return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"})); }
function collectDistinct(rows, canonKey, { split=false, mapFn=null } = {}) {
  const out = [];
  for (const r of rows) {
    let raw = r[canonKey];
    if (raw == null) continue;
    if (split) {
      String(raw).split(MULTI_SEP).forEach(part => {
        const val = mapFn ? mapFn(part.trim()) : part.trim();
        if (val) out.push(val);
      });
    } else {
      const val = mapFn ? mapFn(String(raw).trim()) : String(raw).trim();
      if (val) out.push(val);
    }
  }
  return uniqSorted(out);
}

async function populateFromCSV() {
  try {
    const text = await fetch(CSV_URL).then(r => {
      if (!r.ok) throw new Error(`Failed to load ${CSV_URL} (${r.status})`);
      return r.text();
    });
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => (h||"").replace(/^\uFEFF/,"").trim() });
    const rows = parsed.data.map(canonicalizeRowKeys);

    let freePaid = uniqSorted(rows.map(r => {
      const v = String(r["free or paid"] || r["Free or Paid"] || "").trim().toLowerCase();
      if (!v) return "";
      return v.includes("free") ? "Free" : "Paid";
    }));
    let players    = collectDistinct(rows, "number of players");
    let ageRange   = collectDistinct(rows, "age range");
    let theme      = collectDistinct(rows, "theme");
    let mainMech   = collectDistinct(rows, "main mechanism");
    let secondMech = collectDistinct(rows, "secondary mechanism", { split: true });
    let complexity = collectDistinct(rows, "gameplay complexity");
    let mode       = collectDistinct(rows, "gameplay mode", { mapFn: normalizeMode });
    let category   = collectDistinct(rows, "game category");
    let craft      = collectDistinct(rows, "pnp crafting challenge level");

    if (!freePaid.length) freePaid = ["Free","Paid"];
    if (!players.length) players = ["1","1–2","1–4","2","2–4","3–6","4+"];
    if (!ageRange.length) ageRange = ["8+","10+","12+","14+"];
    if (!complexity.length) complexity = ["Light","Medium","Heavy"];
    if (!mode.length) mode = ["Solo","Cooperative","Competitive"];
    if (!category.length) category = ["Solo","Cooperative","Competitive"];

    addOptions(el.freePaid, freePaid);
    addOptions(el.players, players);
    addOptions(el.ageRange, ageRange);
    addOptions(el.theme, theme);
    addOptions(el.mainMech, mainMech);

    el.secondaryMech.innerHTML = '<option value="" selected>—</option>';
    for (const v of secondMech) {
      const o = document.createElement("option"); o.value = o.textContent = v; el.secondaryMech.appendChild(o);
    }
    addOptions(el.complexity, complexity);

    el.mode.innerHTML = '<option value="" selected>—</option>';
    for (const v of mode) { const o=document.createElement("option"); o.value=v; o.textContent=v; el.mode.appendChild(o); }

    el.category.innerHTML = '<option value="" selected>—</option>';
    for (const v of category) { const o=document.createElement("option"); o.value=v; o.textContent=v; el.category.appendChild(o); }

    addOptions(el.craft, craft);
  } catch (err) {
    console.error("[Submit] Populate dropdowns failed:", err);
    // Fallbacks
    addOptions(el.freePaid, ["Free","Paid"]);
    addOptions(el.players, ["1","1–2","1–4","2","2–4","3–6","4+"]);
    addOptions(el.ageRange, ["8+","10+","12+","14+"]);
    addOptions(el.theme, []);
    addOptions(el.mainMech, []);
    el.secondaryMech.innerHTML = '<option value="" selected>—</option>';
    addOptions(el.complexity, ["Light","Medium","Heavy"]);
    el.mode.innerHTML = '<option value="" selected>—</option><option>Solo</option><option>Cooperative</option><option>Competitive</option>';
    el.category.innerHTML = '<option value="" selected>—</option><option>Solo</option><option>Cooperative</option><option>Competitive</option>';
    addOptions(el.craft, ["Low","Medium","High"]);
  }
}

function showSection() {
  const v = collectionEl.value;
  gameFields.style.display = v === "games" ? "" : "none";
  tutorialFields.style.display = v === "tutorials" ? "" : "none";
  resourceFields.style.display = v === "resources" ? "" : "none";
  imageInput.required = (v === "games");
  const requiredWhenGame = [
    el.freePaid, el.players, el.ageRange, el.theme, el.mainMech, el.complexity, el.craft,
    document.getElementById("gameTitle"),
    document.getElementById("playtime"),
    document.getElementById("shortDesc"),
    document.getElementById("longDesc"),
    document.getElementById("dl1"),
    document.getElementById("releaseYear"),
  ];
  for (const ctrl of requiredWhenGame) v === "games" ? ctrl?.setAttribute("required","required") : ctrl?.removeAttribute("required");
}
collectionEl.addEventListener("change", showSection);
showSection();

function updateCounter(area, labelEl, max) {
  labelEl.textContent = `${(area.value||"").length} / ${max}`;
}
shortDesc.addEventListener("input", () => updateCounter(shortDesc, shortCount, 125));
longDesc .addEventListener("input", () => updateCounter(longDesc , longCount , 400));
updateCounter(shortDesc, shortCount, 125);
updateCounter(longDesc,  longCount,  400);

// --- Image compression (max side 1600px, JPEG quality 0.82) ---
async function compressImageToBase64(file) {
  if (!file) return null;
  const img = await new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => res({img: i, url});
    i.onerror = rej;
    i.src = url;
  });
  const {img: image, url} = img;
  const maxSide = 1600;
  const {width, height} = image;
  let w = width, h = height;
  if (Math.max(w,h) > maxSide) {
    if (w >= h) { h = Math.round(h * (maxSide / w)); w = maxSide; }
    else { w = Math.round(w * (maxSide / h)); h = maxSide; }
  }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, w, h);
  URL.revokeObjectURL(url);

  const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.82));
  if (!blob) throw new Error("Could not process image.");
  if (blob.size > 5 * 1024 * 1024) throw new Error("Compressed image still exceeds 5MB.");
  const buf = await blob.arrayBuffer();
  let binary = ""; const bytes = new Uint8Array(buf); const chunk = 0x8000;
  for (let i=0; i<bytes.length; i+=chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i+chunk));
  return { base64: btoa(binary), contentType: "image/jpeg", filename: file.name.replace(/\.[^.]+$/,"") + ".jpg" };
}

function validateGameForm() {
  const v = collectionEl.value;
  if (v !== "games") return true;
  if (shortDesc.value.length > 125) { shortDesc.focus(); return "Short description must be 125 characters or fewer."; }
  if (longDesc.value.length > 400)  { longDesc.focus();  return "Long description must be 400 characters or fewer."; }
  const ry = document.getElementById("releaseYear").value.trim();
  if (!/^\d{4}$/.test(ry) || +ry < 1900 || +ry > 2100) { document.getElementById("releaseYear").focus(); return "Release Year must be 1900–2100."; }
  const dl = document.getElementById("dl1").value.trim();
  if (dl && !/^https?:\/\//i.test(dl)) { document.getElementById("dl1").focus(); return "Main Download Link must be a valid http(s) URL."; }
  if (imageInput.required && !imageInput.files.length) { imageInput.focus(); return "Please attach an image."; }
  return true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "Submitting…";
  errorEl.style.display = "none"; errorEl.textContent = "";

  const honey = form.querySelector('input[name="website"]');
  if (honey && honey.value) { statusEl.textContent = "Submission blocked."; return; }
  if (!form.reportValidity()) { statusEl.textContent = "Please correct the highlighted fields."; return; }

  const valid = validateGameForm();
  if (valid !== true) { statusEl.textContent = ""; errorEl.textContent = valid; errorEl.style.display = ""; return; }

  const collection = collectionEl.value;
  const data = { collection, fields: {}, image: null };

  const collectInputs = (root) => {
    root.querySelectorAll("input, textarea, select").forEach(el => {
      if (!el.name || el.type === "file") return;
      data.fields[el.name] = el.value.trim();
    });
  };
  collectInputs(gameFields); collectInputs(tutorialFields); collectInputs(resourceFields);

  // image (compress)
  const file = imageInput.files && imageInput.files[0];
  if (file) {
    try {
      const compressed = await compressImageToBase64(file);
      data.image = {
        filename: compressed.filename,
        contentType: compressed.contentType,
        dataBase64: compressed.base64
      };
    } catch (err) {
      statusEl.textContent = "";
      errorEl.textContent = err.message || "Image error.";
      errorEl.style.display = "";
      return;
    }
  }

  try {
    const ac = new AbortController();
    const timer = setTimeout(()=>ac.abort(), 40000); // 40s safety timeout
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data),
      signal: ac.signal
    });
    clearTimeout(timer);

    let json = null;
    try { json = await res.json(); } catch {}
    if (!res.ok) throw new Error((json && json.error) || `HTTP ${res.status}`);

    statusEl.textContent = "✅ Submitted! It will appear after the site redeploys.";
    form.reset(); showSection();
    updateCounter(shortDesc, shortCount, 125);
    updateCounter(longDesc,  longCount,  400);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "";
    errorEl.textContent = `❌ ${err.name === "AbortError" ? "Request timed out." : (err.message || "Submission failed.")}`;
    errorEl.style.display = "";
  }
});

// Start dropdown population
populateFromCSV();
