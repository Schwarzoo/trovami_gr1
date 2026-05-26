// Initialize map centered on Trento (approx) and clamp to world bounds to avoid repeated worlds when zooming out
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

// Disable tile wrapping (noWrap: true) to prevent seeing multiple copies of the world
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

// Keep track of current visible markers bounds so we can restrict zoom/pan
let _visibleBounds = null;

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
  let highlightedRifugioMarker = null;

  // remove existing markers
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

  // media placeholder (we'll try to fetch announcement photo and replace if present)
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
  // try to load announcement photo and update popup content if found
  (async () => {
    const photoUrl = `http://localhost:3000/api/announcements/${a._id}/photo`;
    try {
      const res = await fetch(photoUrl, { method: 'GET' });
      if (!res.ok) throw new Error('no image');
      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith('image')) throw new Error('not image');
      const blob = await res.blob();
      const imgUrl = URL.createObjectURL(blob);
      // build a new media block with the image
      const imgBlock = `<img src="${imgUrl}" style="width:100%;height:110px;object-fit:cover;display:block;"/>`;
      // replace media block in popup HTML
      const newPopup = popupHTML.replace(/<div class="popup-media"[\s\S]*?<\/div>/, imgBlock);
      marker.getPopup().setContent(newPopup);
      // store image url on marker for later revoke
      marker._imgUrl = imgUrl;
      // revoke object URL when popup closes to free memory
      marker.on('popupclose', () => { if (marker._imgUrl) { URL.revokeObjectURL(marker._imgUrl); marker._imgUrl = null; } });
    } catch (err) {
      // leave emoji placeholder
    }
  })();

  // ensure we (re)fetch the image every time the popup opens (handles revoke on close)
  marker.on('popupopen', async () => {
    const photoUrl = `http://localhost:3000/api/announcements/${a._id}/photo`;
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
      // revoke when closed
      marker.on('popupclose', () => { if (marker._imgUrl) { URL.revokeObjectURL(marker._imgUrl); marker._imgUrl = null; } });
    } catch (err) {
      // keep placeholder
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

  // // If we have markers, fit map to them but do not constrain user movement
  // if (window._tm_markers.length > 0 && bounds.isValid()) {
  //   if (highlightedMarker) {
  //     const { lat, lng } = highlightedMarker.getLatLng();
  //     map.setView([lat, lng], 16, { animate: false });
  //     map.panBy([0, -140], { animate: false });
  //     highlightedMarker.openPopup();
  //   } else {
  //     map.fitBounds(bounds, {
  //       paddingTopLeft: [120, 120],
  //       paddingBottomRight: [120, 120],
  //       animate: true,
  //       maxZoom: 12
  //     });
  //   }
  // }
  // try {
  //   map.setMinZoom(2);
  // } catch (err) {
  //   console.warn('Could not set min zoom', err);
  // }
}

function escapeHtml(input) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
  const [annRes, rifugiRes] = await Promise.all([
    fetch('http://localhost:3000/api/announcements'),
    fetch('http://localhost:3000/api/users/rifugi/public')
  ]);
  if (!annRes.ok) { console.error('Errore fetch annunci'); return; }

  const announcements = await annRes.json();
  const rifugi = rifugiRes.ok ? await rifugiRes.json() : [];
  allAnnouncements = Array.isArray(announcements) ? announcements : [];
  allRifugi = Array.isArray(rifugi) ? rifugi : [];
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

// --- User locate button: geolocation, marker and centering ---
const locateBtn = document.getElementById('locate-btn');
let _userMarker = null;

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

// Also refresh when tab becomes visible (helpful after redirect)
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAnnouncements(); });
