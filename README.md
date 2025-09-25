# PnPFinder

PnPFinder is a **static website** for discovering and browsing community-submitted **print-and-play (PnP) games**. It runs entirely client-side: a single CSV file (`/data/games.csv`) powers search, filtering, and display of game entries.

---

## 🌟 Features

* **CSV-driven data**

  * All game entries live in `/data/games.csv` (no backend required).
  * Headers are normalized automatically, so the site works even if the CSV has quirks like BOMs or extra spaces.

* **Game cards & list view**

  * Card view (default) shows: **Title, Main Mechanism, Short Description, Category, Players**.
  * Toggle to list view for a compact table-like layout.
  * Choice is saved to local storage.

* **Search & relevance**

  * Instant text search across multiple fields (title, designer, publisher, mechanisms, descriptions, etc.).
  * **Relevance** sort = preserve the original CSV row order.

* **Filters (live + apply button)**
  Dropdown selectors for the most useful fields:

  * Curated Lists
  * PnP Crafting Challenge Level
  * Number of Players
  * Playtime
  * Age Range
  * Main Mechanism
  * Gameplay Complexity
  * Theme
  * Free or Paid
  * Release Year
  * Languages
  * Filters update results live as you change them, or you can use the **Apply** button.

* **Sorting options**

  * **Relevance** (CSV order)
  * **Newest** (Release Year ↓)
  * **A–Z** (Title ↑)
  * **Release Year (oldest first)**

* **Pagination**

  * 25 games per page.
  * Ellipses pager with first/last + neighbors.
  * “Page X of Y” indicator.

* **Design**

  * Dark theme by default (optional light mode via `data-theme="light"`).
  * Responsive grid, works well on desktop, tablet, and mobile.
  * Accessible: labeled form controls, `aria-live` regions, focus styles.

---

## 📂 Project Structure

```
/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  └─ script.js
└─ data/
   └─ games.csv
```

---

## 🚀 Running Locally

Any static server works:

* **VS Code Live Server**
  Right-click `index.html` → “Open with Live Server”

* **Node one-liner**

  ```bash
  npx http-server -p 8080
  ```

  Then visit [http://localhost:8080](http://localhost:8080)

---

## 📝 Updating Data

* Edit `/data/games.csv`.
* Keep the header row intact.
* Multi-value fields (e.g. Languages, Curated Lists) can be separated with `;`, `,`, or `|`.
* Refresh the page to see changes.

---

## 📜 License

Community project. Free to use and adapt — attribution appreciated.

---