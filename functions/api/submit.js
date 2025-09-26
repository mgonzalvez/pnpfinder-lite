// functions/api/submit.js (Cloudflare Pages Function)
// - Receives JSON from /submit.html
// - Optional image upload committed to /uploads/<collection>/<id>.<ext>
// - Appends a CSV row to /data/<collection>.csv via GitHub Content API
// Environment (Cloudflare Pages -> Settings -> Environment variables):
//   GITHUB_TOKEN (Secret; fine-grained PAT with Contents: Read & Write)
//   GITHUB_OWNER  (e.g., "yourname")
//   GITHUB_REPO   (e.g., "pnpfinder")
//   GITHUB_BRANCH (e.g., "main")
//   GIT_AUTHOR_NAME  (e.g., "PnPFinder Bot")
//   GIT_AUTHOR_EMAIL (e.g., "bot@pnpfinder.com")

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { collection, fields, image } = body || {};

    // Honeypot safeguard (if client ever sends it)
    if (fields && fields.website) return json(400, { error: "Spam detected" });

    if (!["games", "tutorials", "resources"].includes(collection)) {
      return json(400, { error: "Invalid collection" });
    }
    if (collection === "games" && !fields?.["Game Title"]) {
      return json(400, { error: "Game Title is required" });
    }
    if (collection !== "games" && !fields?.["Title"]) {
      return json(400, { error: "Title is required" });
    }

    const id = makeId(collection, fields);

    // 1) Commit image (if provided) to /uploads/<collection>/<id>.<ext>
    let imagePath = "";
    if (image?.dataBase64) {
      const ext = guessExt(image.filename, image.contentType);
      imagePath = `uploads/${collection}/${id}${ext}`;
      await putFileToGit(env, imagePath, image.dataBase64, `Add image for ${collection}:${id}`);
    }

    // 2) Append a row to the proper CSV
    const csvFile = CSV_INFO[collection].file;
    const headers = await getCsvHeaders(env, csvFile);
    const rowObj = buildRowObject(collection, fields, imagePath);
    const newRow = makeCsvRow(headers, rowObj);

    await appendCsv(env, csvFile, newRow, `Add ${collection} entry: ${id}`);

    return json(200, { ok: true, id, imagePath: imagePath ? "/" + imagePath : "" });
  } catch (err) {
    console.error("submit error:", err);
    return json(500, { error: err.message || "Internal error" });
  }
}

/* ====== Config & helpers ====== */

const CSV_INFO = {
  games: {
    file: "data/games.csv",
    headers: [
      "Game Title","Designer","Publisher","Free or Paid","Price","Number of Players","Playtime","Age Range",
      "Theme","Main Mechanism","Secondary Mechanism","Gameplay Complexity","Gameplay Mode","Game Category",
      "PnP Crafting Challenge Level","One-Sentence Short Description","Long Description","Download Link",
      "Secondary Download Link","Print Components","Other Components","Languages","Release Year","Game Image",
      "Curated Lists","Report Dead Link"
    ],
  },
  tutorials: {
    file: "data/tutorials.csv",
    headers: ["Component","Title","Creator","Description","Link","Image"],
  },
  resources: {
    file: "data/resources.csv",
    headers: ["Category","Title","Description","Link","Image","Creator"],
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}

function makeId(collection, fields) {
  const base = (fields["Game Title"] || fields["Title"] || "entry")
    .toString().toLowerCase().normalize("NFKD")
    .replace(/[^\w]+/g, "-").replace(/(^-|-$)/g, "");
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0,14);
  return `${base || "entry"}-${ts}`;
}
function guessExt(filename="", mime="") {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png") || mime.includes("png")) return ".png";
  if (lower.endsWith(".webp") || mime.includes("webp")) return ".webp";
  return ".jpg";
}

/* ---- GitHub Content API helpers (Workers-safe) ---- */

async function ghFetch(env, path, init = {}) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${path}`;
  const headers = {
    "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "Accept": "application/vnd.github+json",
    ...init.headers,
  };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text}`);
  }
  return res.json();
}

async function getFileFromGit(env, path) {
  return ghFetch(env, `contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(env.GITHUB_BRANCH || "main")}`);
}

async function putFileToGit(env, path, base64Content, message) {
  let sha;
  try { const cur = await getFileFromGit(env, path); sha = cur.sha; } catch {}
  return ghFetch(env, `contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: base64Content,           // already base64 (for images) or we’ll base64 encode text
      branch: env.GITHUB_BRANCH || "main",
      sha,
      committer: { name: env.GIT_AUTHOR_NAME || "PnPFinder Bot", email: env.GIT_AUTHOR_EMAIL || "bot@pnpfinder.com" },
      author:    { name: env.GIT_AUTHOR_NAME || "PnPFinder Bot", email: env.GIT_AUTHOR_EMAIL || "bot@pnpfinder.com" },
    })
  });
}

/* ---- CSV helpers ---- */

function csvEscape(v) {
  if (v == null) return "";
  let s = String(v);
  if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function makeCsvRow(headers, rowObj) {
  const vals = headers.map(h => csvEscape(rowObj[h]));
  return vals.join(",") + "\n";
}
function csvInfoByPath(path) {
  return Object.values(CSV_INFO).find(v => v.file === path);
}

async function getCsvHeaders(env, path) {
  try {
    const { content } = await getFileFromGit(env, path);
    const text = decodeBase64ToString(content);
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const parsed = firstLine.split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return parsed.length > 1 ? parsed : csvInfoByPath(path).headers;
  } catch {
    return csvInfoByPath(path).headers;
  }
}

async function appendCsv(env, path, newRow, message) {
  let sha, text;
  try {
    const current = await getFileFromGit(env, path);
    sha = current.sha;
    const existing = decodeBase64ToString(current.content);
    text = existing.endsWith("\n") ? existing + newRow : (existing + "\n" + newRow);
  } catch {
    const headers = csvInfoByPath(path).headers.join(",");
    text = headers + "\n" + newRow;
  }
  const b64 = encodeStringToBase64(text);
  await putFileToGit(env, path, b64, message);
}

function buildRowObject(collection, fields, imagePath) {
  const map = {};
  const headers = CSV_INFO[collection].headers;
  for (const h of headers) map[h] = "";

  if (collection === "games") {
    for (const [k, v] of Object.entries(fields || {})) map[k] = v || "";
    if (imagePath) map["Game Image"] = "/" + imagePath;
    if (!map["Report Dead Link"]) map["Report Dead Link"] = "help@pnpfinder.com";
  } else if (collection === "tutorials") {
    map["Component"]   = fields["Component"] || "";
    map["Title"]       = fields["Title"] || "";
    map["Creator"]     = fields["Creator"] || "";
    map["Description"] = fields["Description"] || "";
    map["Link"]        = fields["Link"] || "";
    if (imagePath)     map["Image"] = "/" + imagePath;
  } else if (collection === "resources") {
    map["Category"]    = fields["Category"] || "";
    map["Title"]       = fields["Title"] || "";
    map["Description"] = fields["Description"] || "";
    map["Link"]        = fields["Link"] || "";
    map["Creator"]     = fields["Creator"] || "";
    if (imagePath)     map["Image"] = "/" + imagePath;
  }
  return map;
}

/* ---- Base64 utils (Workers-safe UTF-8) ---- */

function encodeStringToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function decodeBase64ToString(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
