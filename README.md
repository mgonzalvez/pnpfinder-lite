# PnPfinder - Discover Print & Play Games

## Description

PnPfinder is a static website designed to help the print-and-play (PnP) community discover and explore worthwhile PnP games. The site displays a collection of community-submitted games, allowing users to filter and sort the list based on various criteria.

## Key Improvements and Explanations:

- **Dynamic Filters:** The filters are now created dynamically based on the headers in your CSV file. This makes it much easier to add or remove columns without having to modify the JavaScript code.
- **Live Filtering:** The handleFilterChange function is called whenever a filter value changes, automatically updating the displayed games.
- **Search Functionality:** The search functionality is implemented using an event listener on the searchInput element.
- **Pagination:** The pagination controls are created dynamically based on the total number of games and items per page.
- **Loading State:** A loading message is displayed while data is being fetched.
- **Accessibility:** Semantic HTML elements are used to improve accessibility. ARIA labels can be added as needed for further improvements.
- **Responsiveness:** CSS media queries are used to adapt the layout to different screen sizes.
- **Clean Code:** The code is well-commented and uses descriptive variable names.

## Features

-   **Game List Display:** Displays a grid of game cards with essential information.
-   **Game Details Page:** Provides detailed information about each game.
-   **Filters & Sorting:** Allows users to filter and sort the list of games based on various criteria.
-   **Pagination:** Displays games in pages with navigation controls.
-   **Data Fetching:** Fetches data from a CSV file using PapaParse.
-   **Loading State:** Displays a loading message while data is being fetched.
-   **Responsiveness:** Adapts to different screen sizes (mobile, tablet, desktop).

## Technologies Used

-   HTML
-   CSS
-   JavaScript (Vanilla JS)
-   PapaParse

## Getting Started

1.  Clone the repository: `git clone <repository_url>`
2.  Open `index.html` in your browser.

## Contributing

Contributions are welcome! Feel free to submit pull requests or open issues for bug reports and feature requests.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
