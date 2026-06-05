const API_RIFUGI = '/api/v1/users/shelters?isPublic=true';
const API_ANIMALS = '/api/v1/animals';

const state = {
  rifugi: [],
  animals: [],
  selectedRifugioId: '',
  map: null,
  markers: [],
};

const rifugioIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 34 34">
    <circle cx="17" cy="17" r="15" fill="#C85A2A"/>
    <path d="M8 17.5L17 9l9 8.5v8.5a1 1 0 0 1-1 1h-5v-6h-6v6H9a1 1 0 0 1-1-1v-8.5z" fill="white"/>
    <path d="M6.5 18L17 8l10.5 10" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -14]
});

function getRifugioAddress(rifugio) {
  return [rifugio?.rifugioData?.address, rifugio?.rifugioData?.city].filter(Boolean).join(', ');
}

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function getHighlightId() {
  return new URLSearchParams(window.location.search).get('rifugioId');
}

function getAdoptableAnimals() {
  return state.animals.filter(animal => animal.adoptable === true);
}

function getVisibleAdoptableAnimals() {
  const list = getAdoptableAnimals();
  if (!state.selectedRifugioId) return list;
  return list.filter(animal => normalizeAnimalShelterId(animal) === normalizeId(state.selectedRifugioId));
}

function countAdoptableAnimalsForRifugio(rifugioId) {
  return getAdoptableAnimals().filter(animal => normalizeAnimalShelterId(animal) === normalizeId(rifugioId)).length;
}

function updateCounters() {
  const rifugiCount = state.rifugi.length;
  const adoptableCount = getAdoptableAnimals().length;

  document.getElementById('stat-rifugi').textContent = formatNumber(rifugiCount);
  document.getElementById('stat-animali').textContent = formatNumber(adoptableCount);
  document.getElementById('rifugi-count').textContent = `${formatNumber(rifugiCount)} rifugi trovati`;
}

function setEmptyState(container, message) {
  container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function selectRifugio(id, options = {}) {
  const { openPopup = true, panTo = true } = options;
  const rifugio = state.rifugi.find((item) => item._id === id) || null;
  if (!rifugio) return;

  const marker = state.markers.find((entry) => entry.id === id)?.marker;
  if (marker && state.map) {
    const latLng = marker.getLatLng();
    if (panTo) state.map.setView([latLng.lat, latLng.lng], 15, { animate: true });
    if (openPopup) marker.openPopup();
  }
}

function renderRifugiGrid() {
  const grid = document.getElementById('rifugi-grid');
  if (!grid) return;

  if (state.rifugi.length === 0) {
    setEmptyState(grid, 'Nessun rifugio pubblico disponibile al momento.');
    return;
  }

  grid.innerHTML = state.rifugi.map((rifugio) => {
    const id = rifugio._id;
    const name = getRifugioName(rifugio);
    const address = getRifugioAddress(rifugio);
    const description = rifugio?.rifugioData?.description || 'Descrizione non disponibile.';
    const adoptableAnimals = countAdoptableAnimalsForRifugio(id);
    const rifugioLink = `/pages/rifugio.html?rifugioId=${encodeURIComponent(id)}`;

    return `
      <article class="rifugio-card" data-id="${escapeHtml(id)}" tabindex="0" role="button" aria-label="Apri pagina di ${escapeHtml(name)}">
        <div class="rifugio-card-hero">
          <div>
            <h3 class="rifugio-name">${escapeHtml(name)}</h3>
            <p class="rifugio-city">${escapeHtml(address || 'Indirizzo non disponibile')}</p>
          </div>
          <div class="rifugio-chip-stack">
            <span class="rifugio-chip">${escapeHtml(adoptableAnimals)} animali adottabili</span>
          </div>
        </div>
        <p class="rifugio-description">${escapeHtml(description)}</p>
        <div class="card-actions">
          <a class="primary" href="${rifugioLink}">Apri pagina rifugio</a>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.rifugio-card').forEach((card) => {
    const id = card.dataset.id;
    const openPage = () => {
      window.location.href = `/pages/rifugio.html?rifugioId=${encodeURIComponent(id)}`;
    };
    card.addEventListener('click', openPage);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPage();
      }
    });
  });
}

function populateAdoptionsFilter() {
  const select = document.getElementById('adoptions-rifugio-filter');
  if (!select) return;

  select.innerHTML = '<option value="">Tutti i rifugi</option>';
  state.rifugi
    .slice()
    .sort((a, b) => getRifugioName(a).localeCompare(getRifugioName(b), 'it', { sensitivity: 'base' }))
    .forEach((rifugio) => {
      const option = document.createElement('option');
      option.value = rifugio._id;
      option.textContent = getRifugioName(rifugio);
      select.appendChild(option);
    });

  select.value = state.selectedRifugioId;
  select.classList.toggle('is-placeholder', !select.value);
}

function getRifugioById(id) {
  return state.rifugi.find(rifugio => normalizeId(rifugio._id) === normalizeId(id)) || null;
}

function renderAdoptions() {
  const grid = document.getElementById('adoptions-grid');
  if (!grid) return;

  const animals = getVisibleAdoptableAnimals()
    .slice()
    .sort((a, b) => new Date(b.dateArrived || b.createdAt || 0) - new Date(a.dateArrived || a.createdAt || 0));

  if (animals.length === 0) {
    setEmptyState(grid, 'Nessun animale adottabile disponibile al momento.');
    return;
  }

  grid.innerHTML = animals.map((animal) => {
    const rifugio = getRifugioById(normalizeAnimalShelterId(animal));
    return createAdoptableAnimalCard(animal, { rifugio });
  }).join('');

  animals.forEach((animal) => {
    const card = grid.querySelector(`.card[data-id="${CSS.escape(String(animal._id))}"]`);
    if (!card) return;
    (async () => {
      await hydrateAdoptableAnimalCardImage(card, animal);
    })();

    const openPage = () => {
      const rifugioId = normalizeAnimalShelterId(animal);
      if (!rifugioId || !animal._id) return;
      window.location.href = `/pages/rifugio.html?rifugioId=${encodeURIComponent(rifugioId)}&animalId=${encodeURIComponent(animal._id)}`;
    };

    card.addEventListener('click', openPage);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPage();
      }
    });
  });
}

function initAdoptionsFilter() {
  const select = document.getElementById('adoptions-rifugio-filter');
  if (!select) return;

  select.addEventListener('change', () => {
    state.selectedRifugioId = select.value;
    select.classList.toggle('is-placeholder', !select.value);
    renderAdoptions();
  });
}

function initMap() {
  if (state.map) return state.map;
  state.map = L.map('rifugi-map', {
    worldCopyJump: false,
    minZoom: 4,
    maxZoom: 16
  }).setView([46.0667, 11.08], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
    noWrap: true
  }).addTo(state.map);

  return state.map;
}

function renderMap() {
  const map = initMap();

  state.markers.forEach(({ marker }) => map.removeLayer(marker));
  state.markers = [];

  const bounds = L.latLngBounds([]);
  state.rifugi.forEach((rifugio) => {
    const coords = getCoordinates(rifugio);
    if (!coords) return;

    const [lng, lat] = coords;
    const name = getRifugioName(rifugio);
    const address = getRifugioAddress(rifugio);
    const adoptableAnimals = countAdoptableAnimalsForRifugio(rifugio._id);
    const popupHtml = `
      <div class="rifugi-popup">
        <div class="rifugi-popup__title">${escapeHtml(name)}</div>
        ${address ? `<div class="rifugi-popup__address">${escapeHtml(address)}</div>` : ''}
        <div class="rifugi-popup__count">Animali adottabili: ${escapeHtml(adoptableAnimals)}</div>
        <div class="rifugi-popup__actions">
          <a class="rifugi-popup__link" href="/pages/rifugio.html?rifugioId=${encodeURIComponent(rifugio._id)}">Apri pagina rifugio</a>
        </div>
      </div>
    `;

    const marker = L.marker([lat, lng], { icon: rifugioIcon })
      .addTo(map)
      .bindPopup(popupHtml, { maxWidth: 320, className: 'custom-popup' });

    marker.on('click', () => selectRifugio(rifugio._id, { scrollIntoView: false, openPopup: true, panTo: true }));

    state.markers.push({ id: rifugio._id, marker });
    bounds.extend([lat, lng]);
  });

  requestAnimationFrame(() => map.invalidateSize());

  if (bounds.isValid()) {
    map.fitBounds(bounds, {
      paddingTopLeft: [40, 40],
      paddingBottomRight: [40, 40],
      maxZoom: 13,
      animate: true
    });
  }
}

function selectInitialRifugio() {
  const highlightId = getHighlightId();
  const match = highlightId ? state.rifugi.find((rifugio) => rifugio._id === highlightId) : state.rifugi[0];
  if (match) {
    selectRifugio(match._id, { openPopup: true });
  }
}

function showLoadError(error) {
  const grid = document.getElementById('rifugi-grid');
  const adoptionsGrid = document.getElementById('adoptions-grid');
  if (grid) setEmptyState(grid, 'Impossibile caricare i rifugi. Riprova piu tardi.');
  if (adoptionsGrid) setEmptyState(adoptionsGrid, 'Impossibile caricare le adozioni.');
}

async function fetchAnimalsForRifugio(rifugioId) {
  const animals = [];
  let page = 1;
  let totalPages = 1;

  do {
    const payload = await fetchJson(`${API_ANIMALS}?shelterId=${encodeURIComponent(rifugioId)}&limit=50&page=${page}`);
    const list = Array.isArray(payload) ? payload : payload.data || [];
    animals.push(...list);
    totalPages = Math.max(Number(payload?.meta?.totalPages) || 1, 1);
    page += 1;
  } while (page <= totalPages);

  return animals;
}

async function fetchAllRifugiAnimals(rifugi) {
  const batches = await Promise.all(rifugi.map(async (rifugio) => {
    try {
      return await fetchAnimalsForRifugio(rifugio._id);
    } catch (error) {
      console.warn('Errore caricamento animali rifugio', rifugio._id, error);
      return [];
    }
  }));

  return batches.flat();
}

document.addEventListener('DOMContentLoaded', async () => {
  initAdoptionsFilter();
  try {
    const rifugi = await fetchJson(API_RIFUGI);
    state.rifugi = Array.isArray(rifugi) ? rifugi : [];
    state.animals = await fetchAllRifugiAnimals(state.rifugi);

    populateAdoptionsFilter();
    updateCounters();
    renderRifugiGrid();
    renderAdoptions();
    renderMap();
    selectInitialRifugio();

    const highlightId = getHighlightId();
    if (highlightId && !state.rifugi.some((rifugio) => rifugio._id === highlightId)) {
      const grid = document.getElementById('rifugi-grid');
      if (grid) {
        const notice = document.createElement('div');
        notice.className = 'empty-state';
        notice.textContent = 'Il rifugio richiesto non risulta disponibile o approvato.';
        grid.prepend(notice);
      }
    }
  } catch (error) {
    console.error('Errore caricamento pagina rifugi:', error);
    showLoadError(error);
  }
});
