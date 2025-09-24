// script.js

document.addEventListener('DOMContentLoaded', () => {
    const filterBar = document.getElementById('filter-bar');
    const gameListContainer = document.getElementById('game-list');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Replace with your actual CSV URL
    const csvUrl = '/data/games.csv';

    let games = [];
    let filteredGames = [];

    // Function to fetch data from CSV
    async function fetchAndParseData() {
        try {
            const response = await fetch(csvUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.status}`);
            }
            const text = await response.text();
            const papa = Papa.parse(text);
            games = papa.data;
            renderGames();
        } catch (error) {
            console.error('Error fetching or parsing data:', error);
            displayError(error.message);
        } finally {
            loadingIndicator.style.display = 'none'; // Hide loading indicator
        }
    }

    // Function to render games in the UI
    function renderGames() {
        renderFilterOptions();
        renderGameCards(games);
    }

    // Function to render filter options in the UI
    function renderFilterOptions() {
        const filterElements = document.querySelectorAll('.filter-option');
        filterElements.forEach(option => {
            option.addEventListener('change', filterGames);
        });
    }

    // Function to render game cards in the UI
    function renderGameCards(gameData) {
        gameListContainer.innerHTML = ''; // Clear existing cards

        if (gameData.length === 0) {
            const noGamesElement = document.createElement('div');
            noGamesElement.textContent = 'No games found matching the current filters.';
            gameListContainer.appendChild(noGamesElement);
            return;
        }

        gameData.forEach(game => {
            const card = document.createElement('div');
            card.classList.add('game-card');
            card.innerHTML = `
                <h3>${game.title}</h3>
                <p>${game.description}</p>
                <p>Players: ${game.players}</p>
                <p>Playtime: ${game.playtime}</p>
                <p>Price: ${game.price}</p>
                <p>Mechanic: ${game.mechanic}</p>
                <a href="${game.downloadLink}" target="_blank">Download</a>
            `;
            gameListContainer.appendChild(card);
        });
    }

    // Function to filter games based on selected filters
    function filterGames() {
        const filters = getFilterValues();
        filteredGames = games.filter(game => {
            for (const key in filters) {
                if (filters[key] && game[key] !== filters[key]) {
                    return false;
                }
            }
            return true;
        });
        renderGameCards(filteredGames);
    }

    // Function to get selected filter values
    function getFilterValues() {
        const filters = {};
        const filterElements = document.querySelectorAll('.filter-option:checked');
        filterElements.forEach(option => {
            filters[option.name] = option.value;
        });
        return filters;
    }

    // Function to display error messages
    function displayError(message) {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } else {
            console.error(message);
            alert(message); // Fallback for error display
        }
    }

    // Initial data fetching and rendering
    fetchAndParseData();
});
