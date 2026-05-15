const map = L.map('map').setView([46.0667, 11.1333], 13);
const urlParams = new URLSearchParams(window.location.search);
const highlightId = urlParams.get('highlight');

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


const redIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.25 14 24 14 24S28 23.25 28 14C28 6.27 21.73 0 14 0z" fill="#E24B4A"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`,
  iconSize: [28, 38],
  iconAnchor: [14, 38],
  popupAnchor: [0, -40]
});

const greenIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.25 14 24 14 24S28 23.25 28 14C28 6.27 21.73 0 14 0z" fill="#3B6D11"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`,
  iconSize: [28, 38],
  iconAnchor: [14, 38],
  popupAnchor: [0, -40]
});

const secondaryIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.25 14 24 14 24S28 23.25 28 14C28 6.27 21.73 0 14 0z" fill="#9CA3AF"/>
    <circle cx="14" cy="14" r="6" fill="#F3F4F6"/>
    <text x="14" y="18" text-anchor="middle" font-size="12" font-family="Arial" fill="#6B7280">?</text>
  </svg>`,
  iconSize: [28, 38],
  iconAnchor: [14, 38],
  popupAnchor: [0, -40]
});


let allAnnouncements = [];

function normalizeText(value) {
  return (value || '').toString().toLowerCase().trim();
}

function isUnknownValue(value) {
  const text = normalizeText(value);
  return text === '' || text.startsWith('sconosciut') || text === 'unknown';
}

function tokenizeQuery(query) {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

function matchesTokens(value, tokens) {
  if (tokens.length === 0) return true;
  const hay = normalizeText(value);
  return tokens.every(token => hay.includes(token));
}

function parseDateInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(date) {
  if (!date) return null;
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getFilteredAnnouncements() {
  const typeInput = document.getElementById('filter-type');
  const speciesInput = document.getElementById('filter-species');
  const breedInput = document.getElementById('filter-breed');
  const colorInput = document.getElementById('filter-color');
  const dateFromInput = document.getElementById('filter-date-from');
  const dateToInput = document.getElementById('filter-date-to');
  const includeUnknownInput = document.getElementById('filter-include-unknown');

  const typeQuery = normalizeText(typeInput ? typeInput.value : '');
  const speciesQuery = normalizeText(speciesInput ? speciesInput.value : '');
  const breedQuery = normalizeText(breedInput ? breedInput.value : '');
  const colorQuery = normalizeText(colorInput ? colorInput.value : '');
  const includeUnknown = includeUnknownInput ? includeUnknownInput.checked : true;
  const hasSpeciesFilter = !!speciesQuery;
  const hasBreedFilter = !!breedQuery;
  const hasColorFilter = !!colorQuery;

  const dateFrom = parseDateInput(dateFromInput ? dateFromInput.value : '');
  const dateTo = endOfDay(parseDateInput(dateToInput ? dateToInput.value : ''));

  let filtered = [...allAnnouncements];

  if (typeQuery) {
    filtered = filtered.filter(a => normalizeText(a.type) === typeQuery);
  }

  if (speciesQuery) {
    filtered = filtered.filter(a => {
      const species = normalizeText(a.animalId?.species);
      if (species === speciesQuery) return true;
      return includeUnknown && isUnknownValue(species);
    });
  }

  if (breedQuery) {
    filtered = filtered.filter(a => {
      const breed = normalizeText(a.animalId?.breed);
      if (breed === breedQuery) return true;
      return includeUnknown && isUnknownValue(breed);
    });
  }

  if (colorQuery) {
    filtered = filtered.filter(a => {
      const color = normalizeText(a.animalId?.color);
      if (color === colorQuery) return true;
      return includeUnknown && isUnknownValue(color);
    });
  }

  if (dateFrom || dateTo) {
    filtered = filtered.filter(a => {
      const annDate = new Date(a.date);
      if (Number.isNaN(annDate.getTime())) return false;
      if (dateFrom && annDate < dateFrom) return false;
      if (dateTo && annDate > dateTo) return false;
      return true;
    });
  }

  return filtered.map(a => {
    const speciesUnknown = hasSpeciesFilter && isUnknownValue(a.animalId?.species);
    const breedUnknown = hasBreedFilter && isUnknownValue(a.animalId?.breed);
    const colorUnknown = hasColorFilter && isUnknownValue(a.animalId?.color);
    a._matchType = includeUnknown && (speciesUnknown || breedUnknown || colorUnknown) ? 'secondary' : 'primary';
    return a;
  });
}

function updateCount(n) {
  const count = document.getElementById('result-count');
  if (!count) return;
  count.textContent = `${n} ${n === 1 ? 'annuncio trovato' : 'annunci trovati'}`;
}

function renderAnnouncements(announcements) {
  let highlightedMarker = null;

  // remove existing markers
  if (window._tm_markers) { window._tm_markers.forEach(m => map.removeLayer(m)); }
  window._tm_markers = [];

  announcements.forEach(a => {
  const [lng, lat] = a.location.coordinates;
  const animal = a.animalId;
  const isLost = a.type === 'LostAnimal';
  const date = new Date(a.date).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' });

  // immagine o emoji
  const hasImage = animal?.images?.length > 0;
  const emoji = animal?.species?.toLowerCase().includes('gatt') ? '🐈' : '🐕';
  const mediaBlock = hasImage
    ? `<img src="${animal.images[0]}" alt="foto animale"
            style="width:100%;height:110px;object-fit:cover;display:block;"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
       <div style="display:none;width:100%;height:110px;align-items:center;
                   justify-content:center;background:#f5f5f5;font-size:42px;">${emoji}</div>`
    : `<div style="width:100%;height:110px;background:#f5f5f5;
                   display:flex;align-items:center;justify-content:center;font-size:42px;">${emoji}</div>`;

  const badgeStyle = isLost
    ? 'background:#FCEBEB;color:#A32D2D;'
    : 'background:#EAF3DE;color:#3B6D11;';

  const popupHTML = `
    <div style="width:260px;font-family:sans-serif;border-radius:12px;overflow:hidden;cursor:pointer;"
         onclick="window.location.href='/annuncio/${a._id}'">

      <div style="position:relative;">
        ${mediaBlock}
        <span style="position:absolute;top:8px;left:8px;font-size:11px;font-weight:600;
                     padding:3px 9px;border-radius:20px;${badgeStyle}">
          ${isLost ? 'Smarrito' : 'Avvistato'}
        </span>
      </div>

      <div style="padding:12px 14px 14px;">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
          <div style="width:26px;height:26px;border-radius:50%;background:#E6F1FB;
                      display:flex;align-items:center;justify-content:center;font-size:13px;">🐾</div>
          <span style="font-size:12px;color:#666;">
            ${animal?.species ?? ''}${animal?.breed ? ' · ' + animal.breed : ''}
          </span>
        </div>

        <div style="font-size:14px;font-weight:600;color:#111;margin-bottom:4px;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${a.description.length > 40 ? a.description.slice(0,40)+'…' : a.description}
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;">
          <span style="font-size:11px;color:#999;">📅 ${date}</span>
          <span style="font-size:12px;font-weight:500;color:#1a73e8;">Vedi annuncio →</span>
        </div>
      </div>
    </div>
  `;

  const markerIcon = a._matchType === 'secondary' ? secondaryIcon : (isLost ? redIcon : greenIcon);
  const marker = L.marker([lat, lng], { icon: markerIcon })
    .addTo(map)
    .bindPopup(popupHTML, { maxWidth: 280, className: 'custom-popup' });
  window._tm_markers.push(marker);
  if (highlightId === a._id) {
    highlightedMarker = marker;
  }
  });

  if (highlightedMarker) {
    const { lat, lng } = highlightedMarker.getLatLng();
    map.setView([lat, lng], 16, { animate: false });
    map.panBy([0, -140], { animate: false });
    highlightedMarker.openPopup();
  }
}

function buildSelectOptions(selectEl, values, placeholder) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = '';

  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  selectEl.appendChild(first);

  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });

  if (current && values.includes(current)) {
    selectEl.value = current;
  }
}

function formatLabel(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function addUniqueOption(map, value) {
  if (!value) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  const key = normalizeText(trimmed);
  if (!map.has(key)) {
    map.set(key, formatLabel(trimmed));
  }
}

function populateFilterOptions(announcements) {
  const speciesSelect = document.getElementById('filter-species');
  const breedSelect = document.getElementById('filter-breed');
  const colorSelect = document.getElementById('filter-color');

  const species = new Map();
  const breeds = new Map();
  const colors = new Map();

  announcements.forEach(a => {
    const animal = a.animalId || {};
    addUniqueOption(species, animal.species);
    addUniqueOption(breeds, animal.breed);
    addUniqueOption(colors, animal.color);
  });

  const sortedSpecies = Array.from(species.values()).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  const sortedBreeds = Array.from(breeds.values()).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  const sortedColors = Array.from(colors.values()).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));

  buildSelectOptions(speciesSelect, sortedSpecies, 'Tutte');
  buildSelectOptions(breedSelect, sortedBreeds, 'Tutte');
  buildSelectOptions(colorSelect, sortedColors, 'Tutti');
}

async function loadAnnouncements() {
  const res = await fetch('http://localhost:3000/api/announcements');
  if (!res.ok) { console.error('Errore fetch annunci'); return; }

  const announcements = await res.json();
  allAnnouncements = Array.isArray(announcements) ? announcements : [];
  populateFilterOptions(allAnnouncements);
  const filtered = getFilteredAnnouncements();
  updateCount(filtered.length);
  renderAnnouncements(filtered);
}

function wireFilters() {
  const typeInput = document.getElementById('filter-type');
  const speciesInput = document.getElementById('filter-species');
  const breedInput = document.getElementById('filter-breed');
  const colorInput = document.getElementById('filter-color');
  const dateFromInput = document.getElementById('filter-date-from');
  const dateToInput = document.getElementById('filter-date-to');
  const includeUnknownInput = document.getElementById('filter-include-unknown');
  const handler = () => {
    const filtered = getFilteredAnnouncements();
    updateCount(filtered.length);
    renderAnnouncements(filtered);
  };

  if (typeInput) typeInput.addEventListener('change', handler);
  if (speciesInput) speciesInput.addEventListener('change', handler);
  if (breedInput) breedInput.addEventListener('change', handler);
  if (colorInput) colorInput.addEventListener('change', handler);
  if (dateFromInput) dateFromInput.addEventListener('change', handler);
  if (dateToInput) dateToInput.addEventListener('change', handler);
  if (includeUnknownInput) includeUnknownInput.addEventListener('change', handler);
}

wireFilters();
loadAnnouncements();

// Listen for updates from other pages (profile) and refresh
window.addEventListener('storage', (e) => {
  if (e.key === 'announcements:update') {
    loadAnnouncements();
  }
});

// Also refresh when tab becomes visible (helpful after redirect)
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAnnouncements(); });
