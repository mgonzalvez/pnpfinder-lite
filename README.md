# PnPFinder — Print-and-Play Games

[**pnpfinder.com**](http://pnpfinder.com) — a fast, static, community-driven index of print-and-play board games, tutorials, and resources.

## Build & Data Status

**Automated CSV syncs from Google Sheets → committed to `/data/*.csv`**

- **Games**  
  [![Games CSV Sync](https://github.com/<user>/<repo>/actions/workflows/sync-games.yml/badge.svg)](https://github.com/mgonzalvez/pnpfinder-lite/actions/workflows/sync-games.yml)

- **Tutorials**  
  [![Tutorials CSV Sync](https://github.com/<user>/<repo>/actions/workflows/submit-tutorial.yml/badge.svg)](https://github.com/mgonzalvez/pnpfinder-lite/actions/workflows/submit-tutorial.yml)

- **Resources**  
  [![Resources CSV Sync](https://github.com/<user>/<repo>/actions/workflows/submit-resource.yml/badge.svg)](https://github.com/mgonzalvez/pnpfinder-lite/actions/workflows/submit-resource.yml)

> Each workflow runs on a schedule (every 30 minutes) and on demand via **Actions → Run workflow**. Workflows normalize headers and commit directly to `main`.

---

## Overview

- **Static site** (no backend): HTML/CSS/vanilla JS, CSV data via [PapaParse].
- **Sections:** Games, Tutorials, Resources.
- **Features:** live search, filters, sort, list/grid toggle, pagination, dark/light theme, accessible UI.

**Data files (auto-generated):**
- `data/games.csv`
- `data/tutorials.csv`
- `data/resources.csv`

---

## Content Submission → Approval → Publish

- **Google Forms** feed each Google Sheet’s *Form Responses* tab.  
- An **Approved (Publish Me)** tab mirrors only vetted rows.  
- That tab is **Published to the web** as CSV.  
- GitHub Actions workflows fetch, normalize, and commit to `/data/*.csv`.

**Published CSV sources (examples):**
- Games: Approved tab → published CSV → `.github/workflows/sync-games.yml`
- Tutorials: Approved tab → published CSV → `.github/workflows/submit-tutorial.yml`
- Resources: Approved tab → published CSV → `.github/workflows/submit-resource.yml`

---

## Local Development

```bash
# from repo root
python3 -m http.server 8080
# then open http://localhost:8080
