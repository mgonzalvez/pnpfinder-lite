document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const gameGridElement = document.getElementById('game-grid');
    const filterDropdowns = document.querySelectorAll('.filter-group select');
    const applyButton = document.getElementById('apply-button'); // Add this button in HTML if needed

    let games = [];
    let currentPage = 1;
    const gamesPerPage = 25;

    // Function to fetch and parse CSV data
    async function fetchGames() {
        try {
            const response = await fetch('/data/games.csv'); // Assuming your CSV is in /data
            const data = await response.text();
            const parsedData = Papa.parse(data);
            games = parsedData.data;
            renderGames();
        } catch (error) {
            console.error('Error fetching games:', error);
            gameGridElement.innerHTML = '<p>Error loading games.</p>';
        }
    }

    // Function to render games in the grid
    function renderGames() {
        gameGridElement.innerHTML = ''; // Clear existing games

        if (games.length === 0) {
            gameGridElement.innerHTML = '<p>No games to display.</p>';
            return;
        }

        for (const game of games) {
            const card = document.createElement('div');
            card.classList.add('game-card');

            const title = document.createElement('h2');
            title.textContent = game.title;
            card.appendChild(title);

            const mechanism = document.createElement('p');
            mechanism.classList.add('details');
            mechanism.textContent = `<strong>Main Mechanism:</strong> ${game.main_mechanism}`;
            card.appendChild(mechanism);

            const shortDescription = document.createElement('p');
            shortDescription.classList.add('details');
            shortDescription.textContent = `<strong>Short Description:</strong> ${game.one_sentence_short_description}`;
            card.appendChild(shortDescription);

            const category = document.createElement('p');
            category.classList.add('details');
            category.textContent = `<strong>Category:</strong> ${game.game_category}`;
            card.appendChild(category);

            const players = document.createElement('p');
            players.classList.add('details');
            players.textContent = `<strong>Players:</strong> ${game.number_of_players}`;
            card.appendChild(players);

            const downloadLink = document.createElement('a');
            downloadLink.href = game.download_link;
            downloadLink.textContent = 'Download';
            downloadLink.target = '_blank'; // Open in a new tab
            downloadLink.classList.add('details');
            card.appendChild(downloadLink);

            // Add more details as needed for your card structure
            // ...

            gameGridElement.appendChild(card);
        }
    }

    // Function to handle filtering and rendering
    function filterAndRender() {
        const selectedFilters = {};

        for (const dropdown of filterDropdowns) {
            if (dropdown.value !== '') {
                selectedFilters[dropdown.id] = dropdown.value;
            }
        }

        const filteredGames = games.filter(game => {
            for (const key in selectedFilters) {
                if (game[key] !== selectedFilters[key]) {
                    return false;
                }
            }
            return true;
        });

        renderGames(filteredGames, currentPage);
    }

    // Function to handle pagination
    function handlePagination() {
        const totalGames = games.length;
        const gamesPerPage = 25;
        const totalPages = Math.ceil(totalGames / gamesPerPage);

        const paginationContainer = document.querySelector('.pagination');
        const prevButton = paginationContainer.querySelector('button[aria-label="Previous Page"]');
        const nextButton = paginationContainer.querySelector('button[aria-label="Next Page"]');

        if (currentPage === 1) {
            prevButton.disabled = true;
        } else if (currentPage === totalPages) {
            nextButton.disabled = true;
        } else {
            prevButton.disabled = false;
            nextButton.disabled = false;
        }

        nextButton.addEventListener('click', () => {
            currentPage++;
            renderGames(games, currentPage);
        });

        prevButton.addEventListener('click', () => {
            currentPage--;
            renderGames(games, currentPage);
        });
    }

    // Initial load
    fetchGames();
    filterAndRender();
    handlePagination();

    // Event listeners for search and filters
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredGames = games.filter(game => {
            if (game.title.toLowerCase().includes(searchTerm) ||
                game.one_sentence_short_description.toLowerCase().includes(searchTerm) ||
                game.main_mechanism.toLowerCase().includes(searchTerm) ||
                game.game_category.toLowerCase().includes(searchTerm)) {
                return true;
            }
            return false;
        });
        renderGames(filteredGames, 1); // Reset to page 1 after search
    });

    // Event listener for filter changes
    applyButton.addEventListener('click', () => {
        filterAndRender();
    });

    // Event listeners for filter dropdown changes
    filterDropdowns.forEach(dropdown => {
        dropdown.addEventListener('change', () => {
            filterAndRender();
        });
    });

    // Toggle grid/list view
    const viewToggleBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');

    viewToggleBtn.addEventListener('click', () => {
        gameGridElement.classList.remove('grid-view');
        gameGridElement.classList.add('list-view');
    });

    listViewBtn.addEventListener('click', () => {
        gameGridElement.classList.remove('list-view');
        gameGridElement.classList.add('grid-view');
    });

    // Initialize pagination
    handlePagination();
});
