# PnPfinder - Print and Play Games Website

## Description

PnPfinder is a static website to discover and download print-and-play (PnP) games. This project is built using vanilla JavaScript, HTML, and CSS to fetch game data from a CSV file hosted on GitHub and display it in an organized and user-friendly manner.

## Technologies Used

* **HTML:** Semantic HTML5 for structure.
* **CSS:** Vanilla CSS for styling and responsiveness.
* **JavaScript:** Vanilla JavaScript for dynamic data fetching, filtering, sorting, and pagination.
* **PapaParse:** For parsing CSV data.
* **GitHub:** For hosting the CSV data.

## Setup

1. Clone this repository to your local environment.
2. Create a `data` directory at the root of the project.
3. Place your `games.csv` file inside the `data` directory.
4. Ensure that the URL for your `games.csv` file is correctly referenced in the JavaScript code (currently pointing to `/data/games.csv`).

## Running the Application

1. Navigate to the root directory of the project in your terminal.
2. Run the development server (if you have one set up) or simply open the `index.html` file in your web browser.

## Data Structure (games.csv)

The `games.csv` file should have the following columns:

```csv
title,one_sentence_short_description,main_mechanism,secondary_mechanism,game_complexity,game_mode,game_category,pnp_crafting_challenge_level,release_year,download_link,secondary_download_link,print_components,other_components,languages,curated_lists,report_dead_link
