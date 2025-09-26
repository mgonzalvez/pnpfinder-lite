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
(function(){ const btn = document.getElementById("themeToggle"); if (btn){ setTheme(localStorage.getItem(THEME_KEY)||"dark", btn); btn.addEventListener("click", ()=>setTheme(document.documentElement.getAttribute("data-theme")==="light"?"dark":"light", btn)); } })();

document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("submitForm");
const statusEl = document.getElementById("submitStatus");
const collectionEl = document.getElementById("collection");
const gameFields = document.getElementById("gameFields");
const tutorialFields = document.getElementById("tutorialFields");
const resourceFields = document.getElementById("resourceFields");

function showSection() {
  const v = collectionEl.value;
  gameFields.style.display = v === "games" ? "" : "none";
  tutorialFields.style.display = v === "tutorials" ? "" : "none";
  resourceFields.style.display = v === "resources" ? "" : "none";
}
collectionEl.addEventListener("change", showSection);
showSection();

async function fileToBase64(file){
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("Image too large (max 5MB).");
  const buf = await file.arrayBuffer();
  // Convert to base64
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i=0; i<bytes.length; i+=chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i+chunk));
  }
  return btoa(binary);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "Submitting…";

  // honeypot
  const honey = form.querySelector('input[name="website"]');
  if (honey && honey.value) { statusEl.textContent = "Submission blocked."; return; }

  const collection = collectionEl.value;

  // Collect fields into a plain object
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
  const imgInput = document.getElementById("image");
  const file = imgInput.files && imgInput.files[0];
  if (file) {
    data.image = {
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      dataBase64: await fileToBase64(file)
    };
  }

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data)
    });
    const json = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(json.error || res.statusText);

    statusEl.textContent = "✅ Submitted! It will appear after the site rebuilds.";
    form.reset();
    showSection();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "❌ " + (err.message || "Submission failed.");
  }
});
