document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('game-container');
    const searchInput = document.getElementById('searchInput');
    const filtersContainer = document.querySelector('.filters');
    const gameList = document.getElementById('game-list');
    const paginationContainer = document.getElementById('pagination');

    let games = [];
    let currentPage = 1;
    const itemsPerPage = 25;

    // Load games from CSV
    fetch('data/games.csv')
        .then(response => response.text())
        .then(csvText => {
            const lines = csvText.split('\n');
            const headers = lines[0].split(',');
            for (let i = 1; i < lines.length; i++) {
                const data = lines[i].split(',');
                const game = {};
                for (let j = 0; j < headers.length; j++) {
                    game[headers[j].trim()] = data[j].trim(); // Trim whitespace
                }
                games.push(game);
            }

            // Generate filters dynamically
            generateFilters(headers);

            // Display games
            displayGames();
        })
        .catch(error => console.error('Error loading CSV:', error));

    // Function to generate filters
    function generateFilters(headers) {
        const uniqueValues = {};

        headers.forEach(header => {
            uniqueValues[header] = new Set();
            games.forEach(game => uniqueValues[header].add(game[header]));
        });

        for (const header in uniqueValues) {
            const label = header.replace(/_/g, ' '); // Replace underscores with spaces

            const selectElement = document.createElement('select');
            selectElement.id = header;
            selectElement.innerHTML += `<option value="">All ${label}s</option>`;

            uniqueValues[header].forEach(value => {
                const optionElement = document.createElement('option');
                optionElement.value = value;
                optionElement.textContent = value;
                selectElement.appendChild(optionElement);
            });

            filtersContainer.appendChild(selectElement);

            selectElement.addEventListener('change', filterGames);
        }
    }

    // Function to display games
    function displayGames() {
        gameList.innerHTML = '';

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        const filteredGames = games.filter(game => {
            // Apply filters
            for (const header in document.querySelectorAll('select')) {
                const selectElement = document.getElementById(header);
                if (selectElement.value && selectElement.value !== 'All') {
                    if (game[header] !== selectElement.value) {
                        return false;
                    }
                }
            }

            // Apply search term
            const searchTerm = searchInput.value.toLowerCase();
            if (searchTerm) {
                for (const key in game) {
                    if (game[key].toLowerCase().includes(searchTerm)) {
                        return true;
                    }
                }
            }

            return true;
        });

        const displayedGames = filteredGames.slice(startIndex, endIndex);

        displayedGames.forEach(game => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('game-card');

            cardElement.innerHTML = `
                <h2>${game['Game Title']}</h2>
                <p><strong>Main Mechanism:</strong> ${game['Main Mechanism']}</p>
                <p><strong>Short Description:</strong> ${game['One-Sentence Short Description']}</p>
                <p><strong>Category:</strong> ${game['Game Category']}</p>
                <p><strong>Players:</strong> ${game['Number of Players']}</p>
            `;

            gameList.appendChild(cardElement);
        });
    }

    // Function to filter games (called on select change)
    function filterGames() {
        displayGames();
    }

    // Function to update pagination controls (not fully implemented)
    function updatePagination() {
        // Calculate total pages
        const totalPages = Math.ceil(games.length / itemsPerPage);

        // Clear existing pagination controls
        paginationContainer.innerHTML = '';

        // Create buttons for each page
        for (let i = 1; i <= totalPages; i++) {
            const buttonElement = document.createElement('button');
            buttonElement.textContent = i;
            buttonElement.addEventListener('click', () => {
                currentPage = i;
                displayGames();
            });
            paginationContainer.appendChild(buttonElement);
        }
    }

    // Event listener for search input (live update)
    searchInput.addEventListener('input', displayGames);

});
