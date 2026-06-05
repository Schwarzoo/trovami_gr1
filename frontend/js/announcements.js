let allAnnouncements = [];
let currentLocation = null;
let sortByProximity = false;
const PER_PAGE = 9;
let currentPageFiltered = [];
let currentPageIndex = 1;

/**
 * Renders announcement cards into the announcements grid and toggles the empty state.
 * @param {Array<Object>} announcements - Announcements to render (full filtered list).
 * @returns {void}
 */
function renderCards(announcements) {
  const empty = document.getElementById('empty-state');

  currentPageFiltered = announcements;
  currentPageIndex = 1;

  if (announcements.length === 0) {
    document.getElementById('announcements-grid').innerHTML = '';
    empty.style.display = 'flex';
    updatePaginationControls();
    return;
  }

  empty.style.display = 'none';
  renderCurrentPageCards();
  updatePaginationControls();
}

/**
 * Navigates to the specified page of the current filtered announcements.
 * @param {number} page - Page number to navigate to (1-based).
 * @returns {void}
 */
function goToPage(page) {
  const totalPages = Math.ceil(currentPageFiltered.length / PER_PAGE);
  if (page < 1 || page > totalPages) return;

  currentPageIndex = page;
  renderCurrentPageCards();
  updatePaginationControls();
  updateCount(currentPageFiltered.length);
}

/**
 * Renders the card slice for the current page.
 * @returns {void}
 */
function renderCurrentPageCards() {
  const start = (currentPageIndex - 1) * PER_PAGE;
  const slice = currentPageFiltered.slice(start, start + PER_PAGE);
  const grid = document.getElementById('announcements-grid');

  grid.innerHTML = '';
  slice.forEach((ann, i) => {
    const card = createAnnouncementCard(ann);
    card.style.animationDelay = `${i * 60}ms`;
    grid.appendChild(card);
  });
}

/**
 * Updates the pagination navigation buttons and page indicator.
 * @returns {void}
 */
function updatePaginationControls() {
  const totalPages = Math.ceil(currentPageFiltered.length / PER_PAGE) || 1;
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const indicator = document.getElementById('page-indicator');

  indicator.textContent = `Pagina ${currentPageIndex} di ${totalPages}`;
  prevBtn.disabled = currentPageIndex <= 1;
  nextBtn.disabled = currentPageIndex >= totalPages;
}

/**
 * Populates the shelter filter with unique shelter publishers found in announcements.
 * @param {Array<Object>} announcements - Announcements used to derive shelter filter options.
 * @returns {void}
 */
function populateRifugioFilter(announcements) {
  const select = document.getElementById('filter-rifugio');
  if (!select) return;

  const rifugi = new Map();
  announcements.forEach((ann) => {
    const publisher = ann.publisherId;
    const id = publisher?._id || publisher;
    if (!id || publisher?.role !== 'shelter') return;
    const name = publisher?.rifugioData?.rifugioName || publisher?.username || 'Rifugio';
    rifugi.set(id, name);
  });

  select.innerHTML = '<option value="">Tutti</option>';
  [...rifugi.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'it'))
    .forEach(([id, name]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = name;
      select.appendChild(option);
    });
}

/**
 * Applies the current UI filter state to the cached announcements list.
 * @returns {Array<Object>} Filtered announcements, optionally sorted by proximity.
 */
function getFilteredAnnouncements() {
  const type = document.getElementById('filter-type').value;
  const species = document.getElementById('filter-species').value.trim();
  const rifugioId = document.getElementById('filter-rifugio')?.value || '';

  let filtered = [...allAnnouncements];

  if (type) filtered = filtered.filter(a => a.type === type);
  if (species) {
    filtered = filtered.filter(a => a.animalId?.species?.toLowerCase().includes(species.toLowerCase()));
  }
  if (rifugioId) filtered = filtered.filter(a => (a.publisherId?._id || a.publisherId) === rifugioId);

  if (sortByProximity && currentLocation) {
    filtered = sortAnnouncementsByDistance(filtered, currentLocation);
  }

  return filtered;
}

/**
 * Re-renders the announcement list using the active filters and updates the result count.
 * @returns {void}
 */
function applyFilters() {
  const filtered = getFilteredAnnouncements();
  renderCards(filtered);
  updateCount(filtered.length);
}

/**
 * Updates the visible result counter.
 * @param {number} n - Number of announcements currently shown.
 * @returns {void}
 */
function updateCount(n) {
  document.getElementById('result-count').textContent =
    `${n} ${n === 1 ? 'annuncio trovato' : 'annunci trovati'}`;
}

/**
 * Clears and hides the global error banner.
 * @returns {void}
 */
function clearError() {
  const banner = document.getElementById('error-banner');
  banner.textContent = '';
  banner.style.display = 'none';
}

/**
 * Updates the text shown in the location status area.
 * @param {string} text - Status text to display.
 * @returns {void}
 */
function updateLocationStatus(text) {
  const status = document.getElementById('location-status');
  status.textContent = text || '';
}

/**
 * Requests the user's current browser geolocation.
 * @returns {Promise<Array<number>>} Promise resolving to [latitude, longitude].
 */
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalizzazione non supportata'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve([position.coords.latitude, position.coords.longitude]),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

/**
 * Computes the great-circle distance between two latitude/longitude points.
 * @param {number} lat1 - Latitude of the first point.
 * @param {number} lon1 - Longitude of the first point.
 * @param {number} lat2 - Latitude of the second point.
 * @param {number} lon2 - Longitude of the second point.
 * @returns {number} Distance between the two points in meters.
 */
function computeDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Adds distance metadata to announcements and sorts them by distance from the user.
 * @param {Array<Object>} announcements - Announcements to sort.
 * @param {Array<number>} userLocation - User location as [latitude, longitude].
 * @returns {Array<Object>} New announcement objects sorted from nearest to farthest.
 */
function sortAnnouncementsByDistance(announcements, [userLat, userLng]) {
  return announcements
    .map((ann) => {
      const coords = ann.location?.coordinates;
      if (!coords || coords.length !== 2) return { ...ann, _distance: Infinity };

      const [lng, lat] = coords;
      return { ...ann, _distance: computeDistanceMeters(userLat, userLng, lat, lng) };
    })
    .sort((a, b) => (a._distance || 0) - (b._distance || 0));
}

/**
 * Sorts announcements by date in descending order without mutating the input array.
 * @param {Array<Object>} announcements - Announcements to sort.
 * @returns {Array<Object>} Announcements sorted from newest to oldest.
 */
function sortAnnouncementsByDate(announcements) {
  return [...announcements].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Shows a message in the global error banner.
 * @param {string} msg - Error message to display.
 * @returns {void}
 */
function showError(msg) {
  const banner = document.getElementById('error-banner');
  banner.textContent = msg;
  banner.style.display = 'block';
}

/**
 * Opens and highlights an announcement requested by URL.
 * @returns {void}
 */
function openHighlightedAnnouncement() {
  try {
    const highlight = new URLSearchParams(window.location.search).get('highlight');
    if (!highlight) return;

    setTimeout(() => {
      const ann = allAnnouncements.find(a => a._id === highlight);
      if (!ann) return;

      const card = document.querySelector(`.card[data-id="${highlight}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.transition = 'box-shadow 250ms ease';
        card.style.boxShadow = '0 6px 20px rgba(26,115,232,0.25)';
        setTimeout(() => { card.style.boxShadow = ''; }, 2000);
      }
      openAnnouncementModal(ann);
    }, 120);
  } catch (err) {
    console.warn('Error handling highlight param', err);
  }
}

/**
 * Initializes the announcements page after the DOM is ready.
 * @returns {Promise<void>} Promise resolving when initial announcements are loaded and handlers are bound.
 */
document.addEventListener('DOMContentLoaded', async () => {
  allAnnouncements = await fetchAnnouncements({ limit: 50 });
  allAnnouncements = sortAnnouncementsByDate(allAnnouncements);
  populateRifugioFilter(allAnnouncements);

  const initialRifugioId = new URLSearchParams(window.location.search).get('rifugioId');
  if (initialRifugioId && document.getElementById('filter-rifugio')) {
    document.getElementById('filter-rifugio').value = initialRifugioId;
  }

  const initialFiltered = getFilteredAnnouncements();
  renderCards(initialFiltered);
  updateCount(initialFiltered.length);

  document.getElementById('filter-type').addEventListener('change', applyFilters);
  document.getElementById('filter-species').addEventListener('input', applyFilters);
  document.getElementById('filter-rifugio')?.addEventListener('change', applyFilters);
  document.getElementById('prev-page').addEventListener('click', () => goToPage(currentPageIndex - 1));
  document.getElementById('next-page').addEventListener('click', () => goToPage(currentPageIndex + 1));
  document.getElementById('nearby-button').addEventListener('click', async () => {
    const button = document.getElementById('nearby-button');
    if (sortByProximity) {
      sortByProximity = false;
      currentLocation = null;
      updateLocationStatus('');
      applyFilters();
      return;
    }

    button.disabled = true;
    button.textContent = 'Ricerca posizione...';
    clearError();
    updateLocationStatus('Sto cercando la tua posizione...');

    try {
      currentLocation = await getUserLocation();
      sortByProximity = true;
      updateLocationStatus('Annunci ordinati dai piu vicini');
      applyFilters();
    } catch (err) {
      sortByProximity = false;
      currentLocation = null;
      updateLocationStatus('');
      showError('Impossibile ottenere la tua posizione. Controlla i permessi del browser.');
    } finally {
      button.disabled = false;
      button.textContent = 'Piu vicini a me';
    }
  });

  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAnnouncementModal();
  });
  document.getElementById('modal-close').addEventListener('click', closeAnnouncementModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAnnouncementModal();
  });

  openHighlightedAnnouncement();
});
