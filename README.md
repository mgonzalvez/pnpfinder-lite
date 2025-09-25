Here’s a clean, up-to-date **README.md** that documents the current site.

---

# PnPFinder.com

Discover and explore the best **Print-and-Play (PnP)** board games — plus tutorials and community resources — all in a fast, responsive, dark-mode-first website.

## Contents

* [What’s here](#whats-here)
* [Features](#features)
* [Site structure](#site-structure)
* [Data sources & schemas](#data-sources--schemas)
* [How it works](#how-it-works)
* [Local development](#local-development)
* [Deploying](#deploying)
* [Customization](#customization)
* [Troubleshooting](#troubleshooting)
* [Changelog (current status)](#changelog-current-status)

---

## What’s here

The site has three top-level sections (linked in the header on every page):

1. **Games** — the main directory of PnP games with robust filters and sorting.
2. **Tutorials** — video tutorials on crafting PnP components.
3. **Resources** — helpful community links, tools, geeklists, and sites.

All three sections support **card/list views**, **instant search**, **pagination**, **sorting**, **image thumbnails**, and a **Dark/Light theme toggle**.

---

## Features

### Global

* **Dark mode by default** with a **Light mode toggle** (persists via `localStorage`).
* **Responsive** layout (desktop, tablet, mobile).
* **Accessible**: semantic HTML, ARIA labels, focus styles, keyboard support.
* **Instant search** with a built-in **clear (×) button** and Esc-to-clear.
* **Cards ↔ List** view toggle.
* **25 items per page** with an ellipses **pagination** that shows first/last + window around the current page.
* **Sorting** dropdown per page:

  * Games: Relevance (CSV order), Newest, A–Z, Release Year (oldest)
  * Tutorials: Relevance, A–Z, Creator
  * Resources: Relevance, A–Z, Creator

### Games

* **Filters** (live-updating + Apply/Clear):

  * Curated Lists, PnP Crafting Challenge, Number of Players, Playtime, Age Range,
  * Main Mechanism, Gameplay Complexity, Theme, Free or Paid, Release Year, Languages
* **Card content**: Image, Title, Main Mechanism, Short Description, Category & Players badges, Download links.
* **List view layout**: Image on left; on the right → Title + Mechanism, Short Description, Badges, Download links.
* **Game details page** (`/game.html?id=<rowIndex>`):

  * **Hero image** (wide 16:9) on top.
  * Under the image: **Title, Designer/Publisher**, **Short one-line description**, **Download**, **Alt link**, and **Report dead link** button (mailto:`help@pnpfinder.com`).
  * **Overview**: Long Description.
  * **Quick Facts**: Free/Paid, Release Year, Players, Playtime, Age Range, Theme, Main/Secondary Mechanisms, Gameplay Complexity, Gameplay Mode, Game Category, PnP Crafting, Languages.
  * **Components**: Print Components, Other Components.
* **Relevance sort** = **CSV order** (top of the CSV is first).

### Tutorials

* **Filter**: Component (e.g., boards, cards, tokens, standees, etc.).
* **Card/List** views with thumbnails; clicking opens the tutorial in a new tab.

### Resources

* **Filter**: Category (e.g., communities, utilities, websites, geeklists, etc.).
* **Robust header aliasing** (e.g., “Resource Category” → Category; “Website/URL” → Link).

---

## Site structure

```
/
├── index.html                # Games directory
├── game.html                 # Game details page (query param: ?id=<CSV row index>)
├── tutorials.html            # Tutorials directory
├── resources.html            # Resources directory
├── css/
│   └── style.css             # Global styles (dark/light, cards/list, layout, details)
├── js/
│   ├── script.js             # Games page logic (filters, sort, pager, search, images)
│   ├── details.js            # Game details page logic
│   ├── tutorials.js          # Tutorials page logic (Component filter)
│   └── resources.js          # Resources page logic (Category filter, header aliases)
└── data/
    ├── games.csv             # Games data
    ├── tutorials.csv         # Tutorials data
    └── resources.csv         # Resources data
```

> The site is **static** — no build step needed. CSVs are fetched client-side.

---

## Data sources & schemas

### `/data/games.csv` (required headers)

```
Game Title, Designer, Publisher, Free or Paid, Price, Number of Players, Playtime, Age Range,
Theme, Main Mechanism, Secondary Mechanism, Gameplay Complexity, Gameplay Mode, Game Category,
PnP Crafting Challenge Level, One-Sentence Short Description, Long Description, Download Link,
Secondary Download Link, Print Components, Other Components, Languages, Release Year, Game Image,
Curated Lists, Report Dead Link
```

> The loader is tolerant of common header variants (e.g., `Title` → `Game Title`, `Players` → `Number of Players`, `Image` → `Game Image`, etc.), but using the canonical names above is recommended.

**Images:** The “Game Image” column can contain a direct URL or a list separated by `; , |`. Google Drive and Dropbox share links are normalized to viewable URLs automatically.

---

### `/data/tutorials.csv`

```
Component, Title, Creator, Description, Link, Image
```

* An extra unnamed column (often at the end) is ignored.
* Filter: **Component**
* Sort: Relevance (CSV order), A–Z, Creator

---

### `/data/resources.csv`

```
Category, Title, Description, Link, Image, Creator
```

* Filter: **Category**
* Sort: Relevance (CSV order), A–Z, Creator
* Header aliases supported:

  * `Resource Category` → `Category`
  * `URL` / `Website` / `Weblink` → `Link`
  * `Img` / `Image URL` / `Thumbnail` / `Thumb` / `Cover` → `Image`
  * `Author` / `Channel` / `By` → `Creator`

---

## How it works

* **CSV parsing**: [Papa Parse] via a script tag (no bundler).
* **State & rendering**: Vanilla JS modules handle filtering, sorting, and pagination entirely in the browser.
* **Relevance**: Preserves **CSV row order** using an internal `_idx` assigned at load time.
* **Filters**: Live update on change + optional **Apply** and **Clear** buttons for consistency.
* **Range-ish fields** (Games): “X”, “X–Y”, and “X+” patterns are interpreted for **Players**, **Playtime**, and **Age Range**. Otherwise, the site falls back to substring matching.
* **Search**: Substring match across key fields; typing updates the list instantly.
* **Theme**: `data-theme="dark|light"` on `<html>`, persisted with `localStorage`.
* **Images**: Best-effort normalization; `referrerpolicy="no-referrer"` to reduce hotlink issues.

---

## Local development

Because the site fetches CSV files, **don’t open `index.html` from `file://`** (most browsers will block fetch). Use any simple static server, for example:

```bash
# Python 3
python -m http.server 8080

# Node (if installed)
npx serve .

# Ruby
ruby -run -e httpd . -p 8080
```

Then visit: `http://localhost:8080/`

---

## Deploying

Any static host works:

* **GitHub Pages** (root or `/docs`)
* **Netlify / Vercel / Cloudflare Pages**
* Traditional static hosting (S3, Nginx, Apache)

**Important:**

* Keep CSVs under `/data` on the **same origin** to avoid CORS issues.
* Image URLs should be **HTTPS** and publicly accessible. Google Drive/Dropbox share links work (normalized automatically).

---

## Customization

* **Add a new filter (Games)**: extend `FILTER_COLUMNS` in `/js/script.js` and ensure your CSV contains that column (or an alias). The UI will auto-populate unique values.
* **Add multiple filters (Tutorials/Resources)**: follow the existing pattern in `/js/tutorials.js` or `/js/resources.js` (collect unique values → build a `<select>` → hook into `applyNow()`).
* **Change default sort**: update the `localStorage` default in each page’s JS (`sortBy` initialization).
* **Change page size**: modify `PAGE_SIZE` (25) in each page’s JS.
* **Tweak theming**: edit CSS variables in `:root` for dark/light themes within `/css/style.css`.

---

## Troubleshooting

* **Page shows 0 items**

  * Confirm the CSV path (`/data/*.csv`) and that the server returns **200 OK**.
  * Check for a stray **BOM** or unusual header names; the code is tolerant, but try to use canonical headers.
  * If you filtered to a very narrow combination, click **Clear** in the Filters section.

* **Resources page doesn’t populate**

  * Verify column names (`Category, Title, Description, Link, Image, Creator`).
  * Aliases like “Resource Category” and “Website/URL” are supported; if still blank, inspect the browser console for CSV load errors.

* **Images not displayed**

  * Ensure the URL is reachable via HTTPS.
  * For Google Drive: use share links — the site rewrites them to viewable URLs.
  * For Dropbox: share links are rewritten to direct file links.

* **Search clear (×) not visible**

  * It’s a custom button injected by JS; make sure you’re using the latest `style.css` and page JS files.

---

## Changelog (current status)

**Sep 2025**

* Global: Dark/Light toggle (persisted), responsive layout, accessible controls.
* Search: Instant search with **custom clear (×)** and **Esc** to clear.
* Pagination: 25 per page with first/last + ellipses + page window.
* Sorting:

  * Games — Relevance (CSV order), Newest, A–Z, Release Year (oldest).
  * Tutorials — Relevance, A–Z, Creator.
  * Resources — Relevance, A–Z, Creator.
* Views: Card/List with improved **List** layout (title+mechanism then short description).
* **Games**:

  * Filters: Curated Lists, PnP Crafting Challenge, Number of Players, Playtime, Age Range, Main Mechanism, Gameplay Complexity, Theme, Free or Paid, Release Year, Languages.
  * Cards show image, title, mechanism, short description, category & players badges, and download links.
  * **Game details** page redesigned: wide hero image on top; below it title, designer/publisher, short description, prominent download buttons, and “Report dead link”; Overview + Quick Facts + Components sections.
* **Tutorials**:

  * New page with Component filter; card/list views; images; opens links in new tab.
* **Resources**:

  * New page with Category filter; header aliasing for common column variants; card/list views; images.

---

**License**
Proprietary and confidential. © 2025 Martin Gonzalvez. All rights reserved.
No public license is granted. Contact help@pnpfinder.com for permissions.
