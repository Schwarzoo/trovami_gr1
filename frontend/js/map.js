const europeBounds = L.latLngBounds(
  [34.0, -25.0],
  [72.0, 45.0]
);

const TRENTO_CENTER = [46.0667, 11.08];

const map = L.map('map', {
  worldCopyJump: false,
  maxBounds: europeBounds,
  maxBoundsViscosity: 1.0,
  minZoom: 4,
  maxZoom: 15
}).setView(TRENTO_CENTER , 13);
const urlParams = new URLSearchParams(window.location.search);
const highlightId = urlParams.get('highlight');
const highlightRifugioId = urlParams.get('rifugioId');

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
  noWrap: true
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


let allAnnouncements = [];
let allRifugi = [];

let _visibleBounds = null;

/**
 * Normalizes a value for case-insensitive map filtering.
 * @param {*} value - Raw filter value or announcement field.
 * @returns {string} Lowercase trimmed text.
 */
function normalizeText(value) {
  return (value || '').toString().toLowerCase().trim();
}

/**
 * Checks whether unknown value.
 * @param {*} value - Animal field value to inspect.
 * @returns {boolean} True when the value is blank or marked as unknown.
 */
function isUnknownValue(value) {
  const text = normalizeText(value);
  return text === '' || text.startsWith('sconosciut') || text === 'unknown';
}

/**
 * Splits a search query into normalized tokens.
 * @param {*} query - Raw search query entered in a filter field.
 * @returns {string[]} Non-empty normalized query tokens.
 */
function tokenizeQuery(query) {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

/**
 * Checks whether a value contains every search token.
 * @param {*} value - Text value to search.
 * @param {string[]} tokens - Normalized tokens that must all be present.
 * @returns {boolean} True when all tokens match the normalized value.
 */
function matchesTokens(value, tokens) {
  if (tokens.length === 0) return true;
  const hay = normalizeText(value);
  return tokens.every(token => hay.includes(token));
}

/**
 * Parses a date filter input value.
 * @param {*} value - Raw value from a date input.
 * @returns {Date|null} Parsed date, or null when empty or invalid.
 */
function parseDateInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Expands a date filter to the last millisecond of that day.
 * @param {Date|null} date - Date selected as the upper bound.
 * @returns {Date|null} End-of-day date, or null when no date was provided.
 */
function endOfDay(date) {
  if (!date) return null;
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Returns announcements filtered by the current UI controls.
 * @returns {Array<Object>} Announcements matching the active map filters.
 */
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

/**
 * Updates the visible result counter.
 * @param {number} n - Number of currently visible announcements.
 * @returns {void}
 */
function updateCount(n) {
  const count = document.getElementById('result-count');
  if (!count) return;
  count.textContent = `${n} ${n === 1 ? 'annuncio trovato' : 'annunci trovati'}`;
}

/**
 * Renders announcements into the current list view.
 * @param {Array<Object>} announcements - Filtered announcements to place on the Leaflet map.
 * @returns {void}
 */
function renderAnnouncements(announcements) {
  let highlightedMarker = null;
  let highlightedRifugioMarker = null;

  if (window._tm_markers) { window._tm_markers.forEach(m => map.removeLayer(m)); }
  if (window._tm_rifugio_markers) { window._tm_rifugio_markers.forEach(m => map.removeLayer(m)); }
  window._tm_markers = [];
  window._tm_rifugio_markers = [];
  const bounds = L.latLngBounds([]);

  announcements.filter(a => a.publisherId?.role !== 'shelter').forEach(a => {
  const [lng, lat] = a.location.coordinates;
  const animal = a.animalId;
  const isLost = a.type === 'LostAnimal';
  const date = new Date(a.date).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' });

  const emoji = animal?.species?.toLowerCase().includes('gatt') ? '🐈' : '🐕';
  const mediaBlock = `
    <div class="popup-media" data-ann-id="${a._id}" style="width:100%;height:110px;overflow:hidden;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:42px;">
      <span>${emoji}</span>
    </div>`;

  const badgeStyle = isLost
    ? 'background:#FCEBEB;color:#A32D2D;'
    : 'background:#EAF3DE;color:#3B6D11;';

  const popupHTML = `
    <div style="width:260px;font-family:sans-serif;border-radius:12px;overflow:hidden;cursor:pointer;"
         onclick="window.location.href='/pages/announcements.html?highlight=${a._id}'">

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
            ${animal?.name ? escapeHtml(animal.name) + ' · ' : ''}${animal?.species ?? ''}${animal?.breed ? ' · ' + animal.breed : ''}
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
  (async () => {
    const photoUrl = `http://localhost:3000/api/v1/announcements/${a._id}/photo`;
    try {
      const res = await fetch(photoUrl, { method: 'GET' });
      if (!res.ok) throw new Error('no image');
      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith('image')) throw new Error('not image');
      const blob = await res.blob();
      const imgUrl = URL.createObjectURL(blob);
      const imgBlock = `<img src="${imgUrl}" style="width:100%;height:110px;object-fit:cover;display:block;"/>`;
      const newPopup = popupHTML.replace(/<div class="popup-media"[\s\S]*?<\/div>/, imgBlock);
      marker.getPopup().setContent(newPopup);
      marker._imgUrl = imgUrl;
      marker.on('popupclose', () => { if (marker._imgUrl) { URL.revokeObjectURL(marker._imgUrl); marker._imgUrl = null; } });
    } catch (err) {
    }
  })();

  marker.on('popupopen', async () => {
    const photoUrl = `http://localhost:3000/api/v1/announcements/${a._id}/photo`;
    try {
      const res = await fetch(photoUrl, { method: 'GET' });
      if (!res.ok) throw new Error('no image');
      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith('image')) throw new Error('not image');
      const blob = await res.blob();
      const imgUrl = URL.createObjectURL(blob);
      const imgBlock = `<img src="${imgUrl}" style="width:100%;height:110px;object-fit:cover;display:block;"/>`;
      const newPopup = popupHTML.replace(/<div class="popup-media"[\s\S]*?<\/div>/, imgBlock);
      marker.getPopup().setContent(newPopup);
      if (marker._imgUrl) { URL.revokeObjectURL(marker._imgUrl); }
      marker._imgUrl = imgUrl;
      marker.on('popupclose', () => { if (marker._imgUrl) { URL.revokeObjectURL(marker._imgUrl); marker._imgUrl = null; } });
    } catch (err) {
    }
  });

  allRifugi.forEach((rifugio) => {
    const coords = rifugio.rifugioData?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) return;
    const [lng, lat] = coords.map(Number);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    const name = rifugio.rifugioData?.rifugioName || rifugio.username || 'Rifugio';
    const address = [rifugio.rifugioData?.address, rifugio.rifugioData?.city].filter(Boolean).join(', ');
    const popupHTML = `
      <div style="width:300px;font-family:sans-serif;padding:4px 2px 2px;">
        <div style="font-size:17px;font-weight:700;margin-bottom:8px;color:#111;">${escapeHtml(name)}</div>
        ${rifugio.rifugioData?.description ? `<div style="font-size:13px;color:#555;line-height:1.45;margin-bottom:10px;">${escapeHtml(rifugio.rifugioData.description)}</div>` : ''}
        ${address ? `<div style="font-size:13px;color:#666;margin-bottom:8px;">${escapeHtml(address)}</div>` : ''}
        ${rifugio.phoneNumber ? `<div style="font-size:13px;color:#666;">Tel: ${escapeHtml(rifugio.phoneNumber)}</div>` : ''}
        ${rifugio.email ? `<div style="font-size:13px;color:#666;">Email: ${escapeHtml(rifugio.email)}</div>` : ''}
        <a href="/pages/rifugi.html?rifugioId=${encodeURIComponent(rifugio._id)}"
           style="display:inline-block;margin-top:12px;font-size:13px;font-weight:700;color:#C85A2A;text-decoration:none;">
          Apri pagina rifugi →
        </a>
      </div>
    `;

    const marker = L.marker([lat, lng], { icon: rifugioIcon })
      .addTo(map)
      .bindPopup(popupHTML, { maxWidth: 330, className: 'custom-popup' });

    window._tm_rifugio_markers.push(marker);
    bounds.extend([lat, lng]);
    if (highlightRifugioId === String(rifugio._id)) {
      highlightedRifugioMarker = marker;
    }
  });
  window._tm_markers.push(marker);
  bounds.extend([lat, lng]);
  if (highlightId === a._id) {
    highlightedMarker = marker;
  }
  });


  if (window._tm_markers.length > 0 && bounds.isValid()) {
    if (highlightedRifugioMarker) {
      const { lat, lng } = highlightedRifugioMarker.getLatLng();
      map.setView([lat, lng], 16, { animate: false });
      highlightedRifugioMarker.openPopup();
    } else if (highlightedMarker) {
      const { lat, lng } = highlightedMarker.getLatLng();
      map.setView([lat, lng], 16, { animate: false });
      map.panBy([0, -140], { animate: false });
      highlightedMarker.openPopup();
    } else {
      map.fitBounds(bounds, {
        paddingTopLeft: [60, 180],
        paddingBottomRight: [280, 60],
        animate: true,
        maxZoom: 12
      });
    }
  }

}

/**
 * Escapes HTML-sensitive characters before inserting text into markup.
 * @param {*} input - Value interpolated into popup markup.
 * @returns {string} HTML-safe string representation of the value.
 */
function escapeHtml(input) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}


/**
 * Builds select options from unique filter values.
 * @param {HTMLSelectElement|null} selectEl - Filter select element to populate.
 * @param {string[]} values - Sorted option labels to insert.
 * @param {string} placeholder - Placeholder label for the empty option.
 * @returns {void}
 */
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

/**
 * Formats a filter value as a human-readable label.
 * @param {string} value - Raw unique value collected from announcements.
 * @returns {string} Title-cased label for a select option.
 */
function formatLabel(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Adds a normalized option value to a map of unique values.
 * @param {Map<string,string>} map - Destination map keyed by normalized option value.
 * @param {string} value - Raw value from an announcement animal field.
 * @returns {void}
 */
function addUniqueOption(map, value) {
  if (!value) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  const key = normalizeText(trimmed);
  if (!map.has(key)) {
    map.set(key, formatLabel(trimmed));
  }
}

/**
 * Populates all filter controls from announcement data.
 * @param {Array<Object>} announcements - Announcements used to derive species, breed, and color filters.
 * @returns {void}
 */
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

/**
 * Loads announcements for the current frontend view.
 * @returns {Promise<void>} Promise resolving after map data, filters, and markers are refreshed.
 */
async function loadAnnouncements() {
  const [annRes, rifugiRes] = await Promise.all([
    fetch('http://localhost:3000/api/v1/announcements'),
    fetch('http://localhost:3000/api/v1/users/rifugi?isPublic=true')
  ]);
  if (!annRes.ok) { console.error('Errore fetch annunci'); return; }

  const announcementsPayload = await annRes.json();
  const rifugi = rifugiRes.ok ? await rifugiRes.json() : [];
  allAnnouncements = Array.isArray(announcementsPayload) ? announcementsPayload : announcementsPayload.data || [];
  allRifugi = Array.isArray(rifugi) ? rifugi : [];
  populateFilterOptions(allAnnouncements);
  const filtered = getFilteredAnnouncements();
  updateCount(filtered.length);
  renderAnnouncements(filtered);
}

/**
 * Binds filter controls to map/list rendering.
 * @returns {void}
 */
function wireFilters() {
  const typeInput = document.getElementById('filter-type');
  const speciesInput = document.getElementById('filter-species');
  const breedInput = document.getElementById('filter-breed');
  const colorInput = document.getElementById('filter-color');
  const dateFromInput = document.getElementById('filter-date-from');
  const dateToInput = document.getElementById('filter-date-to');
  const includeUnknownInput = document.getElementById('filter-include-unknown');
  /**
   * Recomputes filtered announcements and redraws the map after a filter change.
   * @returns {void}
   */
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

window.addEventListener('storage', (e) => {
  if (e.key === 'announcements:update') {
    loadAnnouncements();
  }
});

const locateBtn = document.getElementById('locate-btn');
let _userMarker = null;

/**
 * Shows the user location marker on the map.
 * @param {number} lat - User latitude from the browser geolocation API.
 * @param {number} lng - User longitude from the browser geolocation API.
 * @returns {void}
 */
function showUserLocation(lat, lng) {
  try {
    if (_userMarker) {
      map.removeLayer(_userMarker);
      _userMarker = null;
    }
    const circle = L.circleMarker([lat, lng], {
      radius: 6,
      color: '#1e3a8a',
      fillColor: '#1e3a8a',
      fillOpacity: 1,
      weight: 2
    }).addTo(map);

    circle.bindTooltip('Tu sei qui', { permanent: true, direction: 'right', offset: [10, 0], className: 'user-label' });
    _userMarker = circle;
  } catch (err) {
    console.error('Errore mostrando posizione utente', err);
  }
}

if (locateBtn) {
  locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Geolocalizzazione non supportata dal browser');
      return;
    }

    locateBtn.disabled = true;
    navigator.geolocation.getCurrentPosition((pos) => {
      locateBtn.disabled = false;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      showUserLocation(lat, lng);
      map.setView([lat, lng], 14, { animate: true });
    }, (err) => {
      locateBtn.disabled = false;
      console.error('Geolocation error', err);
      alert('Impossibile ottenere la posizione: ' + (err.message || err.code));
    }, { enableHighAccuracy: true, timeout: 10000 });
  });
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAnnouncements(); });
