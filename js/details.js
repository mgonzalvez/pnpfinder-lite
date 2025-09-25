/* PnPFinder — Game Details page (image on top; meta below; overview uses "Game Description") */

const CSV_URL = "/data/games.csv";

/* Canonicalization & parsing helpers (match script.js) */
const MULTIVALUE_SEP = /[;,|]/;
const toKey = (s) => String(s ?? "")
  .replace(/^\uFEFF/, "")
  .normalize("NFKC")
  .trim()
  .toLowerCase()
  .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
  .replace(/[^a-z0-9]+/g, "");

const COLUMNS = [
  "Game Title","Designer","Publisher","Free or Paid","Price","Number of Players","Playtime","Age Range",
  "Theme","Main Mechanism","Secondary Mechanism","Gameplay Complexity","Gameplay Mode","Game Category",
  "PnP Crafting Challenge Level","One-Sentence Short Description","Long Description","Download Link",
  "Secondary Download Link","Print Components","Other Components","Languages","Release Year","Game Image",
  "Curated Lists","Report Dead Link"
];

const OFFICIAL_KEY_BY_NAME = new Map(COLUMNS.map(name => [name, toKey(name)]));
const NAME_BY_OFFICIAL_KEY = new Map(COLUMNS.map(name => [toKey(name), name]));

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

    // Image aliases → "Game Image"
    if (k==="image" || k==="img" || k==="thumbnail" || k==="thumb" ||
        k==="cover" || k==="gameimage" || k==="imageurl" || k==="imgurl") {
      map.set(k, "Game Image"); continue;
    }

    // Long description aliases → "Long Description"
    if (k==="gamedescription" || k==="description" || k==="longdesc" || k==="longdescription") {
      map.set(k, "Long Description"); continue;
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

function normalizeStr(v){ return (v ?? "").toString().trim(); }

/* Image helpers (match script.js) */
function firstUrlLike(raw) {
  if (!raw) return "";
  const parts = String(raw)
    .split(MULTIVALUE_SEP)
    .map(s => s.trim().replace(/^['"]|['"]$/g, ""));
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

/* DOM */
const $ = (s, p=document) => p.querySelector(s);

const mainEl = $("#detailMain");
const articleEl = $("#gameDetail");
const notFoundEl = $("#notFound");

const thumbEl = $("#detailThumb");
const titleEl = $("#detailTitle");
const bylineEl = $("#detailByline");

const shortDescEl = $("#shortDesc");
const longDescEl = $("#longDesc");

const primaryDlEl = $("#primaryDownload");
const secondaryDlEl = $("#secondaryDownload");
const reportEl = $("#reportLink");

const fields = {
  freePaid: $("#freePaid"),
  releaseYear: $("#releaseYear"),
  players: $("#players"),
  playtime: $("#playtime"),
  ageRange: $("#ageRange"),
  theme: $("#theme"),
  mainMech: $("#mainMech"),
  secondaryMech: $("#secondaryMech"),
  complexity: $("#complexity"),
  mode: $("#mode"),
  category: $("#category"),
  crafting: $("#crafting"),
  languages: $("#languages"),
  printComponents: $("#printComponents"),
  otherComponents: $("#otherComponents"),
};

function fill(el, text){ el.textContent = normalizeStr(text) || "—"; }
function mailtoReport(title, id, dl1, dl2){
  const subject = encodeURIComponent(`Dead link report: ${title}`);
  const body = encodeURIComponent(
`Hello PnPFinder team,

One or more download links appear broken.

Game: ${title}
ID: ${id}
Link 1: ${dl1 || "(none)"}
Link 2: ${dl2 || "(none)"}

(Please include any details here.)`
  );
  return `mailto:help@pnpfinder.com?subject=${subject}&body=${body}`;
}

function renderDetail(row){
  // Title + byline
  fill(titleEl, row["Game Title"]);
  const designer = normalizeStr(row["Designer"]);
  const publisher = normalizeStr(row["Publisher"]);
  bylineEl.textContent = [designer, publisher].filter(Boolean).join(" • ");

  // Short description (one-liner) shown under image block
  fill(shortDescEl, row["One-Sentence Short Description"]);

  // Overview: prefer "Game Description" via mapping → Long Description
  const longPref = normalizeStr(row["Long Description"]) || normalizeStr(row["Game Description"]);
  fill(longDescEl, longPref);

  // Facts
  fill(fields.freePaid, row["Free or Paid"]);
  fill(fields.releaseYear, row["Release Year"]);
  fill(fields.players, row["Number of Players"]);
  fill(fields.playtime, row["Playtime"]);
  fill(fields.ageRange, row["Age Range"]);
  fill(fields.theme, row["Theme"]);
  fill(fields.mainMech, row["Main Mechanism"]);
  fill(fields.secondaryMech, row["Secondary Mechanism"]);
  fill(fields.complexity, row["Gameplay Complexity"]);
  fill(fields.mode, row["Gameplay Mode"]);
  fill(fields.category, row["Game Category"]);
  fill(fields.crafting, row["PnP Crafting Challenge Level"]);
  fill(fields.languages, row["Languages"]);
  fill(fields.printComponents, row["Print Components"]);
  fill(fields.otherComponents, row["Other Components"]);

  // Image (wide hero)
  const url = getImageUrl(row);
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = normalizeStr(row["Game Title"]) || "Game image";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => thumbEl.remove();
    thumbEl.appendChild(img);
    thumbEl.removeAttribute("aria-hidden");
  }

  // Downloads below image
  const dl1 = normalizeStr(row["Download Link"]);
  const dl2 = normalizeStr(row["Secondary Download Link"]);

  if (dl1) {
    primaryDlEl.href = dl1;
  } else {
    primaryDlEl.href = "#";
    primaryDlEl.setAttribute("aria-disabled","true");
    primaryDlEl.classList.add("disabled");
  }

  if (dl2) {
    secondaryDlEl.href = dl2;
    secondaryDlEl.hidden = false;
  } else {
    secondaryDlEl.hidden = true;
  }

  // Report mailto
  const id = new URLSearchParams(location.search).get("id") || "";
  reportEl.href = mailtoReport(normalizeStr(row["Game Title"]) || "Unknown Game", id, dl1, dl2);

  // Reveal
  articleEl.hidden = false;
  mainEl.setAttribute("aria-busy","false");
}

/* Boot */
(async function init(){
  $("#year").textContent = new Date().getFullYear();

  const idParam = new URLSearchParams(location.search).get("id");
  const idx = idParam != null ? parseInt(idParam, 10) : NaN;

  const csvText = await fetch(CSV_URL).then(r=>r.text());
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  });

  const csvHeaders = parsed.meta.fields || [];
  const headerMap = buildHeaderMap(csvHeaders);
  const rows = parsed.data.map((row, i) => {
    const obj = remapRow(row, headerMap);
    obj._idx = i;
    return obj;
  });

  if (!Number.isFinite(idx) || idx < 0 || idx >= rows.length) {
    articleEl.hidden = true;
    notFoundEl.hidden = false;
    mainEl.setAttribute("aria-busy","false");
    return;
  }

  renderDetail(rows[idx]);
})();
