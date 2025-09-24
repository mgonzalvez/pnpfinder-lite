document.addEventListener('DOMContentLoaded', function() {
  const filterBar = document.querySelector('.filter-bar');
  const gameGrid = document.querySelector('.game-grid');
  const loadingIndicator = document.getElementById('loading'); // Assuming you have a loading element in your HTML

  let games = [];
  let currentPage = 1;
  const gamesPerPage = 25;

  // Function to fetch data
  async function fetchGames() {
    loadingIndicator.style.display = 'block'; // Show loading indicator

    try {
      const response = await fetch('/data/games.csv'); // Corrected path
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json(); // Assuming the CSV is being treated as JSON by PapaParse
      games = data;
      renderGames();
    } catch (error) {
      console.error('Error fetching games:', error);
      gameGrid.innerHTML = '<p>Error loading games. Please try again later.</p>';
      loadingIndicator.style.display = 'none'; // Hide loading indicator on error
    } finally {
      loadingIndicator.style.display = 'none'; // Hide loading indicator
    }
  }

  // Function to render games in the grid
  function renderGames() {
    gameGrid.innerHTML = ''; // Clear previous games

    const startIndex = (currentPage - 1) * gamesPerPage;
    const endIndex = startIndex + gamesPerPage;
    const displayedGames = games.slice(startIndex, endIndex);

    displayedGames.forEach(game => {
      const card = document.createElement('div');
      card.classList.add('game-card');
      card.innerHTML = `
        <h3>${game.title}</h3>
        <p>${game.description}</p>
        <p>Players: ${game.players}</p>
        <p>Playtime: ${game.playtime}</p>
        <p>Price: ${game.price}</p>
        <p>Mechanic: ${game.mechanic}</p>
        <a href="${game.downloadLink}" download>Download</a>
      `;
      gameGrid.appendChild(card);
    });

    // Render pagination
    renderPagination();
  }

  // Function to render pagination
  function renderPagination() {
    const totalPages = Math.ceil(games.length / gamesPerPage);
    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }

    const pagination = document.createElement('div');
    pagination.classList.add('pagination');

    pageNumbers.forEach(page => {
      const button = document.createElement('button');
      button.textContent = page;
      button.addEventListener('click', () => {
        currentPage = parseInt(page);
        renderGames();
      });
      pagination.appendChild(button);
    });

    gameGrid.appendChild(pagination);
  }

  // Initial load of games
  fetchGames();

  // Event listeners for filters and sorting (implement these based on your filter logic)
  // ... (Implementation for handling filter changes and sorting)

});
