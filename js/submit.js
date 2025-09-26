/* PnPFinder — Submit page
   - One-item-per-line vertical form
   - Dropdowns populated from /data/games.csv
   - Required fields + maxlength counters for short/long descriptions
   - Image required only for "Game"
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

// Populate dropdowns from /data/games.csv
const CSV_URL = "/data/games.csv";
const MULTI_SEP = /[;,|]/;

function addOptions(select, values, { placeholder = "— Select —", keepDash=false } = {}) {
  // preserve the first placeholder and clear the rest
  select.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder;
  ph.disabled = true;
  ph.selected = true;
  select.appendChild(ph);
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v || (keepDash ? "—" : "");
    select.appendChild(opt);
  }
}

function normalizeMode(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("solo")) return "Solo";
  if (s.includes("coop") || s.includes("co-op") || s.includes("cooperative")) return "Cooperative";
  if (s.includes("compet")) return "Competitive";
  return v.toString();
}

function uniqSorted(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));
}
function collectDistinct(rows, col, { split=false, mapFn=null } = {}) {
  const out = [];
  for (const r of rows) {
    let raw = r[col];
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
      if (!r.ok) throw new Error(`Failed to load ${CSV_URL}`);
      return r.text();
    });
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => (h||"").replace(/^\uFEFF/,"").trim() });
    const rows = parsed.data;

    // Build option lists
    const freePaid = uniqSorted(rows.map(r => {
      const v = String(r["Free or Paid"] || "").trim().toLowerCase();
      if (!v) return "";
      return v.includes("free") ? "Free" : "Paid";
    }));
    const players   = collectDistinct(rows, "Number of Players");
    const ageRange  = collectDistinct(rows, "Age Range");
    const theme     = collectDistinct(rows, "Theme");
    const mainMech  = collectDistinct(rows, "Main Mechanism");
    const secondMech= collectDistinct(rows, "Secondary Mechanism", { split: true });
    const complexity= collectDistinct(rows, "Gameplay Complexity");
    const mode      = collectDistinct(rows, "Gameplay Mode", { mapFn: normalizeMode });
    const category  = collectDistinct(rows, "Game Category");
    const craft     = collectDistinct(rows, "PnP Crafting Challenge Level");

    // Apply to selects
    addOptions(el.freePaid, freePaid);
    addOptions(el.players, players);
    addOptions(el.ageRange, ageRange);
    addOptions(el.theme, theme);
    addOptions(el.mainMech, mainMech);
    // Secondary mechanism is optional; allow a blank
    el.secondaryMech.innerHTML = "";
    {
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "—";
      blank.selected = true;
      el.secondaryMech.appendChild(blank);
      for (const v of secondMech) {
        const o = document.createElement("option");
        o.value = v; o.textContent = v;
        el.secondaryMech.appendChild(o);
      }
    }
    addOptions(el.complexity, complexity);
    // Mode and Category are optional; include a blank first
    el.mode.innerHTML = "";
    { const blank = document.createElement("option"); blank.value=""; blank.textContent="—"; blank.selected=true; el.mode.appendChild(blank); }
    for (const v of mode) { const o=document.createElement("option"); o.value=v; o.textContent=v; el.mode.appendChild(o); }

    el.category.innerHTML = "";
    { const blank = document.createElement("option"); blank.value=""; blank.textContent="—"; blank.selected=true; el.category.appendChild(blank); }
    for (const v of category) { const o=document.createElement("option"); o.value=v; o.textContent=v; el.category.appendChild(o); }

    addOptions(el.craft, craft);
  } catch (err) {
    console.error("Populate dropdowns failed:", err);
    // Fallback minimal options
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

  // Required toggles: image required only for games
  imageInput.required = (v === "games");

  // Also ensure required selects for game fields are enforced only when visible
  const requiredWhenGame = [
    el.freePaid, el.players, el.ageRange, el.theme, el.mainMech, el.complexity, el.craft,
    document.getElementById("gameTitle"),
    document.getElementById("playtime"),
    document.getElementById("shortDesc"),
    document.getElementById("longDesc"),
    document.getElementById("dl1"),
    document.getElementById("releaseYear"),
  ];
  for (const ctrl of requiredWhenGame) {
    if (!ctrl) continue;
    if (v === "games") ctrl.setAttribute("required", "required");
    else ctrl.removeAttribute("required");
  }
}
collectionEl.addEventListener("change", showSection);
showSection();

function updateCounter(area, labelEl, max) {
  const len = (area.value || "").length;
  labelEl.textContent = `${len} / ${max}`;
}
shortDesc.addEventListener("input", () => updateCounter(shortDesc, shortCount, 125));
longDesc.addEventListener("input",  () => updateCounter(longDesc,  longCount,  400));
updateCounter(shortDesc, shortCount, 125);
updateCounter(longDesc,  longCount,  400);

async function fileToBase64(file){
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("Image too large (max 5MB).");
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i=0; i<bytes.length; i+=chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i+chunk));
  }
  return btoa(binary);
}

// Client-side validation helper (extra messages)
function validateGameForm() {
  const v = collectionEl.value;
  if (v !== "games") return true;

  // Length guards
  if (shortDesc.value.length > 125) {
    shortDesc.focus();
    return "Short description must be 125 characters or fewer.";
  }
  if (longDesc.value.length > 400) {
    longDesc.focus();
    return "Long description must be 400 characters or fewer.";
  }
  const ry = document.getElementById("releaseYear").value.trim();
  if (!/^\d{4}$/.test(ry) || +ry < 1900 || +ry > 2100) {
    document.getElementById("releaseYear").focus();
    return "Release Year must be a 4-digit year between 1900 and 2100.";
  }
  const dl = document.getElementById("dl1").value.trim();
  if (dl && !/^https?:\/\//i.test(dl)) {
    document.getElementById("dl1").focus();
    return "Main Download Link must be a valid http(s) URL.";
  }
  if (imageInput.required && !imageInput.files.length) {
    imageInput.focus();
    return "Please attach an image.";
  }
  return true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "Submitting…";
  errorEl.style.display = "none"; errorEl.textContent = "";

  // honeypot
  const honey = form.querySelector('input[name="website"]');
  if (honey && honey.value) { statusEl.textContent = "Submission blocked."; return; }

  // Built-in browser validation
  if (!form.reportValidity()) { statusEl.textContent = "Please correct the highlighted fields."; return; }

  // Extra game validation
  const valid = validateGameForm();
  if (valid !== true) {
    statusEl.textContent = "";
    errorEl.textContent = valid;
    errorEl.style.display = "";
    return;
  }

  const collection = collectionEl.value;
  const data = { collection, fields: {}, image: null };

  const collectInputs = (root) => {
    root.querySelectorAll("input, textarea, select").forEach(el => {
      if (!el.name || el.type === "file") return;
      data.fields[el.name] = el.value.trim();
    });
  };
  collectInputs(gameFields);
  collectInputs(tutorialFields);
  collectInputs(resourceFields);

  // image
  const file = imageInput.files && imageInput.files[0];
  if (file) {
    try {
      data.image = {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        dataBase64: await fileToBase64(file)
      };
    } catch (err) {
      statusEl.textContent = "";
      errorEl.textContent = err.message || "Image error.";
      errorEl.style.display = "";
      return;
    }
  }

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data)
    });
    const json = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(json.error || res.statusText);

    statusEl.textContent = "✅ Submitted! It will appear after the site redeploys.";
    form.reset();
    showSection();
    updateCounter(shortDesc, shortCount, 125);
    updateCounter(longDesc,  longCount,  400);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "";
    errorEl.textContent = "❌ " + (err.message || "Submission failed.");
    errorEl.style.display = "";
  }
});

// Kick off dropdown population
populateFromCSV();
