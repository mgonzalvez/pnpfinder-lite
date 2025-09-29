# PnPFinder.com

Discover and explore the best **Print-and-Play (PnP)** board games — plus tutorials and community resources — all in a fast, responsive, **static site** built with HTML, CSS, and vanilla JS.

[**Visit PnPFinder.com**](http://pnpfinder.com)

---

## Build & Data Status

**Automated CSV syncs from Google Sheets → committed to `/data/*.csv`**

* **Games**
  [![Games CSV Sync](https://github.com/<user>/<repo>/actions/workflows/sync-games.yml/badge.svg)](https://github.com/<user>/<repo>/actions/workflows/sync-games.yml)

* **Tutorials**
  [![Tutorials CSV Sync](https://github.com/<user>/<repo>/actions/workflows/submit-tutorial.yml/badge.svg)](https://github.com/<user>/<repo>/actions/workflows/submit-tutorial.yml)

* **Resources**
  [![Resources CSV Sync](https://github.com/<user>/<repo>/actions/workflows/submit-resource.yml/badge.svg)](https://github.com/<user>/<repo>/actions/workflows/submit-resource.yml)

> Each workflow runs every 30 minutes, and can also be triggered manually in **GitHub Actions → Run workflow**.

---

## Overview

* **Static site** (no backend): HTML/CSS/JS + [PapaParse] for CSV parsing.
* **Sections:** Games, Tutorials, Resources, Submit.
* **Features:**

  * Dark/Light theme toggle (persists in `localStorage`).
  * Responsive, accessible UI (semantic HTML, ARIA labels, keyboard support).
  * Instant search with clear (×) button + Esc-to-clear.
  * Card ↔ List toggle.
  * Filters with live results + Apply/Clear.
  * Sorting (A–Z, Relevance, Newest, Creator, Release Year, etc.).
  * Pagination (25 per page with ellipses).

---

## Site Structure

```
/
├── index.html                # Games directory
├── game.html                 # Game detail page (?id=<row index>)
├── tutorials.html            # Tutorials directory
├── resources.html            # Resources directory
├── submit.html               # Submit form (Games / Tutorials / Resources)
├── css/
│   └── style.css             # Global dark/light, layout, components
├── js/
│   ├── script.js             # Games logic (filters, sort, pager, search)
│   ├── details.js            # Game details logic
│   ├── tutorials.js          # Tutorials page logic
│   ├── resources.js          # Resources page logic
│   └── submit.js             # Client-side submit validation
└── data/
    ├── games.csv             # Auto-generated
    ├── tutorials.csv         # Auto-generated
    └── resources.csv         # Auto-generated
```

---

## Data Sources

### Games (`/data/games.csv`)

```
Game Title, Designer, Publisher, Free or Paid, Price, Number of Players, Playtime, Age Range,
Theme, Main Mechanism, Secondary Mechanism, Gameplay Complexity, Gameplay Mode, Game Category,
PnP Crafting Challenge Level, One-Sentence Short Description, Long Description, Download Link,
Secondary Download Link, Print Components, Other Components, Languages, Release Year, Game Image,
Curated Lists, Report Dead Link
```

* Header aliasing supported (e.g. `Title` → `Game Title`).
* “Game Image” column normalizes Google Drive/Dropbox links automatically.

### Tutorials (`/data/tutorials.csv`)

```
Component, Title, Creator, Description, Link, Image
```

* Filter: Component.
* Sort: Relevance (CSV order), A–Z, Creator.

### Resources (`/data/resources.csv`)

```
Category, Title, Description, Link, Image, Creator
```

* Filter: Category.
* Sort: Relevance, A–Z, Creator.
* Aliases supported:

  * `Resource Category` → `Category`
  * `Website/URL` → `Link`
  * `Image URL/Thumb` → `Image`
  * `Author/By` → `Creator`

---

## Content Submission

* **Submit form**: `/submit.html` or [Google Form link](https://docs.google.com/forms/d/e/1FAIpQLSckXPkwbUa7ctk_u0Bo71YExCaENONEoa8arj1YTFPSH7VDQg/viewform?usp=sf_link).
* Form feeds into a Google Sheet → vetted rows moved to an “Approved” tab → published as CSV → GitHub Action fetches and commits to `/data`.

---

## Local Development

Run a static server (don’t open with `file://`):

```bash
# Python
python3 -m http.server 8080
# Node
npx serve .
```

Then open: [http://localhost:8080](http://localhost:8080)

---

## Changelog (Sep 2025)

* **Global:** Dark/Light toggle, responsive grid layout, accessible controls.
* **Games:**

  * New detail page with hero image, Overview, Quick Facts, Components.
  * Filters: Curated Lists, Crafting Challenge, Players, Playtime, Age, Theme, Mechanisms, Complexity, Mode, Category, Free/Paid, Release Year, Languages.
  * Improved list layout (title + mechanism + short description).
* **Tutorials:** Component filter, card/list views, images.
* **Resources:** Category filter, header aliasing, card/list views, images.
* **Submit:** Integrated submit page with form validation, Google Form option.
* **CSS:** Modernized styling (rounded cards, accessible controls, responsive header fixes).

---

## License

© 2025 PnPFinder. All rights reserved.
No public license is granted. Contact **[help@pnpfinder.com](mailto:help@pnpfinder.com)** for permissions.

---
