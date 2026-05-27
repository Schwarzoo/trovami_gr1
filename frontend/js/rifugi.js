const API_RIFUGI = 'http://localhost:3000/api/users/rifugi/public';
const API_ANNOUNCEMENTS = 'http://localhost:3000/api/announcements';
const API_ANIMALS = 'http://localhost:3000/api/animals';

const state = {
  rifugi: [],
  announcements: [],
  animals: [],
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

function escapeHtml(input) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('it-IT') : '0';
}

function getRifugioName(rifugio) {
  return rifugio?.rifugioData?.rifugioName || rifugio?.shelterData?.shelterName || rifugio?.username || 'Rifugio';
}

function getRifugioAddress(rifugio) {
  return [rifugio?.rifugioData?.address, rifugio?.rifugioData?.city].filter(Boolean).join(', ');
}

function getCoordinates(rifugio) {
  const coords = rifugio?.rifugioData?.location?.coordinates || rifugio?.shelterData?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lng, lat] = coords.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return await res.json();
}

function getShelterAnnouncements() {
  return state.announcements.filter((announcement) => announcement?.publisherId?.role === 'shelter');
}

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function countAnnouncementsForRifugio(rifugioId) {
  return getShelterAnnouncements().filter((announcement) => {
    const publisherId = announcement?.publisherId?._id || announcement?.publisherId;
    return normalizeId(publisherId) === normalizeId(rifugioId);
  }).length;
}

function countAvailableAnimalsForRifugio(rifugioId) {
  const fromAnimalsApi = state.animals.filter((animal) => {
    const shelterId = animal?.shelterId?._id || animal?.shelterId;
    return normalizeId(shelterId) === normalizeId(rifugioId);
  }).length;

  if (fromAnimalsApi > 0) return fromAnimalsApi;
  return countAnnouncementsForRifugio(rifugioId);
}

function getHighlightId() {
  return new URLSearchParams(window.location.search).get('rifugioId');
}

function updateCounters() {
  const rifugiCount = state.rifugi.length;
  const totalAvailableAnimals = state.animals.length > 0
    ? state.animals.length
    : getShelterAnnouncements().length;
  const adoptionsCount = getShelterAnnouncements().filter(a => !!a?.animalId?.adoptable).length;

  document.getElementById('stat-rifugi').textContent = formatNumber(rifugiCount);
  document.getElementById('stat-animali').textContent = formatNumber(totalAvailableAnimals);
  document.getElementById('stat-adozioni').textContent = formatNumber(adoptionsCount);
  document.getElementById('rifugi-count').textContent = `${formatNumber(rifugiCount)} rifugi trovati`;
  document.getElementById('adoptions-count').textContent = `${formatNumber(adoptionsCount)} annunci`;
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
    const availableAnimals = countAvailableAnimalsForRifugio(id);
    const announcementCount = countAnnouncementsForRifugio(id);
    const rifugioLink = `/pages/rifugio.html?rifugioId=${encodeURIComponent(id)}`;
    const announcementsLink = `/pages/announcements.html?rifugioId=${encodeURIComponent(id)}`;

    return `
      <article class="rifugio-card" data-id="${escapeHtml(id)}" tabindex="0" role="button" aria-label="Apri pagina di ${escapeHtml(name)}">
        <div class="rifugio-card-hero">
          <div>
            <h3 class="rifugio-name">${escapeHtml(name)}</h3>
            <p class="rifugio-city">${escapeHtml(address || 'Indirizzo non disponibile')}</p>
          </div>
          <div class="rifugio-chip-stack">
            <span class="rifugio-chip">${escapeHtml(availableAnimals)} animali disponibili</span>
            <span class="rifugio-chip rifugio-chip--soft">${escapeHtml(announcementCount)} adozioni</span>
          </div>
        </div>
        <p class="rifugio-description">${escapeHtml(description)}</p>
        <div class="rifugio-meta">
          <div class="meta-row"><strong>Animali disponibili</strong><span>${escapeHtml(availableAnimals)}</span></div>
          <div class="meta-row"><strong>Contatti</strong><span>${escapeHtml(rifugio?.phoneNumber || rifugio?.email || 'Non pubblici')}</span></div>
        </div>
        <div class="card-actions">
          <a class="primary" href="${rifugioLink}">Apri pagina rifugio</a>
          <a href="${announcementsLink}">Vedi annunci</a>
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

function renderAdoptions() {
  const grid = document.getElementById('adoptions-grid');
  if (!grid) return;

  const adoptions = getShelterAnnouncements()
    .filter(a => !!a?.animalId?.adoptable)
    .slice()
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 6);
  if (adoptions.length === 0) {
    setEmptyState(grid, 'Nessun annuncio di rifugio disponibile al momento.');
    return;
  }

  grid.innerHTML = adoptions.map((announcement) => {
    const publisher = announcement.publisherId || {};
    const rifugioName = getRifugioName(publisher);
    const animal = announcement.animalId || {};
    const title = animal.name || animal.species || 'Animale in rifugio';
    const details = [animal.species, animal.breed, animal.color].filter(Boolean).join(' · ');
    const date = announcement.date ? new Date(announcement.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Data non disponibile';
    const rifugioLink = `/pages/rifugio.html?rifugioId=${encodeURIComponent(publisher._id || publisher)}${animal?._id ? `&animalId=${encodeURIComponent(animal._id)}` : ''}`;

    return `
      <article class="adoption-card" data-announcement-id="${escapeHtml(announcement._id)}" tabindex="0" role="button" aria-label="Apri annuncio di ${escapeHtml(title)}">
        <div class="adoption-media">
          <div class="adoption-media-placeholder"><span>${escapeHtml(animal?.species?.[0] || '…')}</span></div>
          
        </div>
        <div class="adoption-body">
          <div class="adoption-meta">
            <span class="adoption-species">${escapeHtml(animal?.species || 'Specie sconosciuta')}</span>
            <span class="adoption-date">${escapeHtml(date)}</span>
          </div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(announcement.description || 'Nessuna descrizione pubblica disponibile.')}</p>
          ${details ? `<div class="adoption-details">${escapeHtml(details)}</div>` : ''}
          ${rifugioName ? `<div class="adoption-kicker">${escapeHtml(rifugioName)}</div>` : ''}
          <a class="text-link" href="${rifugioLink}">Apri scheda animale →</a>
        </div>
      </article>
    `;
  }).join('');

  adoptions.forEach((announcement) => {
    const card = grid.querySelector(`.adoption-card[data-announcement-id="${CSS.escape(String(announcement._id))}"]`);
    if (!card) return;

    const media = card.querySelector('.adoption-media');
    const placeholder = media?.querySelector('.adoption-media-placeholder');
    const animal = announcement.animalId || {};
    const photoUrl = `http://localhost:3000/api/announcements/${announcement._id}/photo`;

    (async () => {
      try {
        const res = await fetch(photoUrl, { method: 'GET' });
        if (!res.ok) throw new Error('no image');
        const ct = res.headers.get('content-type') || '';
        if (!ct.startsWith('image')) throw new Error('not image');
        const blob = await res.blob();
        const img = document.createElement('img');
        img.src = URL.createObjectURL(blob);
        img.alt = animal?.species || 'Animale';
        img.loading = 'lazy';
        img.onload = () => { URL.revokeObjectURL(img.src); };
        if (placeholder) placeholder.replaceWith(img);
      } catch (err) {
        if (placeholder) placeholder.innerHTML = `<span>${escapeHtml(animal?.species?.[0] || '?')}</span>`;
      }
    })();

    const publisher = announcement.publisherId || {};
    const rifugioLink = `/pages/rifugio.html?rifugioId=${encodeURIComponent(publisher._id || publisher)}${animal?._id ? `&animalId=${encodeURIComponent(animal._id)}` : ''}`;

    card.addEventListener('click', () => {
      window.location.href = rifugioLink;
    });

    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.href = rifugioLink;
      }
    });
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
    const availableAnimals = countAvailableAnimalsForRifugio(rifugio._id);
    const popupHtml = `
      <div style="width:280px;padding:2px 2px 4px;font-family:sans-serif;">
        <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:#111;">${escapeHtml(name)}</div>
        ${address ? `<div style="font-size:13px;color:#555;line-height:1.45;margin-bottom:8px;">${escapeHtml(address)}</div>` : ''}
        <div style="font-size:13px;color:#666;margin-bottom:10px;">Animali disponibili: ${escapeHtml(availableAnimals)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a href="/pages/rifugio.html?rifugioId=${encodeURIComponent(rifugio._id)}" style="font-size:13px;font-weight:700;color:#C85A2A;text-decoration:none;">Apri pagina rifugio</a>
          <a href="/pages/announcements.html?rifugioId=${encodeURIComponent(rifugio._id)}" style="font-size:13px;font-weight:700;color:#C85A2A;text-decoration:none;">Vedi annunci</a>
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
  if (grid) setEmptyState(grid, 'Impossibile caricare i rifugi. Riprova più tardi.');
  if (adoptionsGrid) setEmptyState(adoptionsGrid, 'Impossibile caricare le adozioni.');
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [rifugi, announcements] = await Promise.all([
      fetchJson(API_RIFUGI),
      fetchJson(API_ANNOUNCEMENTS)
    ]);
    const animals = await fetchJson(API_ANIMALS).catch(() => []);

    state.rifugi = Array.isArray(rifugi) ? rifugi : [];
    state.announcements = Array.isArray(announcements) ? announcements : [];
    state.animals = Array.isArray(animals) ? animals : [];

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
