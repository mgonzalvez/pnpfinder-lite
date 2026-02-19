# PnPFinder.com

PnPFinder is a fast static site for discovering Print-and-Play board games and tutorials.

Live site: [http://pnpfinder.com](http://pnpfinder.com)

## Current Product Scope

- Core directories:
  - `Games` (`/`)
  - `Tutorials` (`/tutorials.html`)
  - `Spotlight` (`/spotlight.html`)
  - `Submit` (`/submit.html`)
- `Resources` on PnPFinder is deprecated.
  - `/resources.html` now redirects to [https://pnptools.gonzhome.us](https://pnptools.gonzhome.us).
- Top navigation uses a `Tools` dropdown with external links (new tab):
  - Launchpad: [https://launchpad.gonzhome.us](https://launchpad.gonzhome.us)
  - PnPTools: [https://pnptools.gonzhome.us](https://pnptools.gonzhome.us)
  - Formatter: [https://formatter.gonzhome.us/](https://formatter.gonzhome.us/)
  - Extractor: [https://extractor.gonzhome.us](https://extractor.gonzhome.us)

## Technical Overview

- Static frontend only: HTML + CSS + vanilla JS.
- No runtime backend dependency for page rendering.
- Data is read from local CSV/JSON files under `/data`.
- CSV parsing is done client-side with PapaParse.

## Data Pipeline (Cloudflare)

- Source content is maintained in Google Sheets.
- Cloudflare Workers/Actions automation updates published data files in `/data`.
- The frontend does not call Google Sheets directly.
- At runtime, pages only read local files in `/data` (CSV/JSON) and render that content.

## Core Features

- Dark/light theme toggle (persisted in `localStorage`)
- Responsive layout and keyboard-accessible controls
- Search with inline clear behavior
- Card/list view toggle
- Filtering + sorting + pagination
- Game detail page (`/game.html?id=<row-index>`)

## Project Structure

```text
/
├── index.html                # Games directory
├── game.html                 # Game detail page
├── tutorials.html            # Tutorials directory
├── spotlight.html            # Spotlight content
├── crowdfunding.html         # Legacy page (no longer primary nav destination)
├── resources.html            # Redirects to pnptools.gonzhome.us
├── submit.html               # Submission page
├── css/
│   └── style.css             # Global styles + themes + nav/dropdown UI
├── js/
│   ├── script.js             # Games listing logic
│   ├── details.js            # Game detail logic
│   ├── tutorials.js          # Tutorials logic
│   ├── spotlight.js          # Spotlight logic
│   ├── crowdfunding.js       # Legacy crowdfunding logic
│   ├── resources.js          # Legacy resources logic
│   └── submit.js             # Submit page logic
└── data/
    ├── games.csv
    ├── tutorials.csv
    ├── resources.csv         # Still present; no longer primary site section
    ├── crowdfunding.csv
    └── spotlight.json
```

## Data Files Used by the Frontend

### `data/games.csv`

Expected columns:

```text
Game Title, Designer, Publisher, Free or Paid, Price, Number of Players, Playtime, Age Range,
Theme, Main Mechanism, Secondary Mechanism, Gameplay Complexity, Gameplay Mode, Game Category,
PnP Crafting Challenge Level, One-Sentence Short Description, Long Description, Download Link,
Secondary Download Link, Print Components, Other Components, Languages, Release Year, Game Image,
Curated Lists, Report Dead Link
```

### `data/tutorials.csv`

```text
Component, Title, Creator, Description, Link, Image
```

### `data/spotlight.json`

Used by `spotlight.html` for rotating spotlight content.

### Legacy data still present

- `data/resources.csv`
- `data/crowdfunding.csv`

## Deployment Notes

- Keep `/data` as the canonical runtime input for site content.
- If pipeline logic changes, preserve file names/paths expected by the frontend:
  - `data/games.csv`
  - `data/tutorials.csv`
  - `data/spotlight.json`

## Local Development

Run a local static server (do not open with `file://`):

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## Change Safety Rule

When making UI updates, keep changes scoped to presentation only unless explicitly requested:

- Avoid changing IDs/classes that JS depends on.
- Do not alter data file paths under `/data`.
- Validate Games/Tutorials/Spotlight/Submit behavior after UI edits.

## License

© 2026 PnPFinder. All rights reserved.
Contact: [help@pnpfinder.com](mailto:help@pnpfinder.com)
