document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('game-container');
    const filterSection = document.getElementById('filter-section');
    const searchInput = document.getElementById('searchInput');

    let gamesData = [];
    let currentPage = 1;
    const itemsPerPage = 25;

    // Function to fetch data from CSV using PapaParse
    const fetchData = async () => {
        try {
            const response = await fetch('./data/games.csv');
            const csvText = await response.text();
            const results = Papa.parse(csvText, { header: true, dynamicTyping: true });
            gamesData = results.data;

            // Create filters dynamically
            createFilters(gamesData);

            displayGames();
        } catch (error) {
            console.error('Error fetching data:', error);
            gameContainer.innerHTML = '<p>Failed to load game data.</p>';
        }
    };

    // Function to create filters based on CSV headers
    const createFilters = (data) => {
        const headers = Object.keys(data[0]);

        headers.forEach((header) => {
            const filterDiv = document.createElement('div');
            const label = document.createElement('label');
            label.textContent = header + ':';
            const select = document.createElement('select');
            select.id = header;

            // Get unique values for the filter options
            const uniqueValues = [...new Set(data.map((item) => item[header]))];
            uniqueValues.forEach((value) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });

            filterDiv.appendChild(label);
            filterDiv.appendChild(select);
            filterSection.appendChild(filterDiv);

            // Add event listener to filter select element
            select.addEventListener('change', handleFilterChange);
        });
    };

    // Function to display games on the page
    const displayGames = () => {
        gameContainer.innerHTML = '';

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        const filteredGames = gamesData.filter((game) => {
            // Apply filters based on selected values
            const filterHeaders = Object.keys(document.getElementById('filter-section').children);

            for (const header of filterHeaders) {
                const selectElement = document.getElementById(header);
                if (selectElement && selectElement.value !== 'All') {
                    const selectedValue = selectElement.value;
                    if (game[header] !== selectedValue) {
                        return false;
                    }
                }
            }

            // Apply search filter
            const searchTerm = searchInput.value.toLowerCase();
            if (searchTerm !== '') {
                const gameTitle = game['Game Title'].toLowerCase();
                if (!gameTitle.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        const slicedGames = filteredGames.slice(startIndex, endIndex);

        slicedGames.forEach((game) => {
            const gameCard = document.createElement('div');
            gameCard.classList.add('game-card');

            const title = document.createElement('h3');
            title.textContent = game['Game Title'];

            const mechanism = document.createElement('p');
            mechanism.textContent = 'Mechanism: ' + game['Main Mechanism'];

            const description = document.createElement('p');
            description.textContent = game['One-Sentence Short Description'];

            const category = document.createElement('p');
            category.textContent = 'Category: ' + game['Game Category'];

            const players = document.createElement('p');
            players.textContent = 'Players: ' + game['Number of Players'];

            gameCard.appendChild(title);
            gameCard.appendChild(mechanism);
            gameCard.appendChild(description);
            gameCard.appendChild(category);
            gameCard.appendChild(players);

            gameContainer.appendChild(gameCard);
        });
    };

    // Function to handle filter changes
    const handleFilterChange = (event) => {
        displayGames();
    };

    // Function to handle search input changes
    searchInput.addEventListener('input', displayGames);

    // Function to update pagination controls
    const updatePagination = () => {
        // Calculate total pages
        const totalPages = Math.ceil(gamesData.length / itemsPerPage);

        // Create pagination buttons
        const paginationDiv = document.getElementById('pagination');
        paginationDiv.innerHTML = '';

        // Create previous button
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            currentPage--;
            displayGames();
            updatePagination();
        });

        // Create page number buttons
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => {
                currentPage = i;
                displayGames();
                updatePagination();
            });

            if (i === currentPage) {
                pageButton.disabled = true;
            }

            paginationDiv.appendChild(pageButton);
        }

        // Create next button
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            currentPage++;
            displayGames();
            updatePagination();
        });

        paginationDiv.appendChild(prevButton);
        paginationDiv.appendChild(nextButton);
    };

    // Fetch data and display games on page load
    fetchData();
});
