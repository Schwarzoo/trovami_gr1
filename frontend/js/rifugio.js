const API_RIFUGI = 'http://localhost:3000/api/users/rifugi/public';
const API_ANNOUNCEMENTS = 'http://localhost:3000/api/announcements';

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

function getCoordinates(rifugio) {
  const coords = rifugio?.rifugioData?.location?.coordinates || rifugio?.shelterData?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lng, lat] = coords.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

function getRifugioId() {
  return new URLSearchParams(window.location.search).get('rifugioId');
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return await res.json();
}

function getShelterAnnouncements(announcements, rifugioId) {
  return announcements.filter((announcement) => {
    const publisherId = announcement?.publisherId?._id || announcement?.publisherId;
    return publisherId === rifugioId && announcement?.publisherId?.role === 'shelter';
  });
}

function getAllContacts(rifugio) {
  return [rifugio?.phoneNumber, rifugio?.email].filter(Boolean).join(' · ');
}

function renderStats(rifugio, announcements) {
  const stats = document.getElementById('shelter-stats');
  const shelterAnnouncements = getShelterAnnouncements(announcements, rifugio._id);
  const coords = getCoordinates(rifugio);
  const totalSlots = rifugio?.rifugioData?.totalSlots ?? rifugio?.shelterData?.totalSlots;
  const availableSlots = rifugio?.rifugioData?.availableSlots ?? rifugio?.shelterData?.availableSlots;

  stats.innerHTML = `
    <div class="stat-card">
      <span>Posti disponibili</span>
      <strong>${escapeHtml(availableSlots ?? 'n/d')}</strong>
      <span>su ${escapeHtml(totalSlots ?? 'n/d')} posti totali</span>
    </div>
    <div class="stat-card">
      <span>Adozioni pubblicate</span>
      <strong>${escapeHtml(shelterAnnouncements.length)}</strong>
      <span>annunci collegati a questo rifugio</span>
    </div>
    
  `;
}

function renderInfo(rifugio) {
  const container = document.getElementById('shelter-info-grid');
  const coords = getCoordinates(rifugio);
  const address = [rifugio?.rifugioData?.address, rifugio?.rifugioData?.city].filter(Boolean).join(', ');
  const totalSlots = rifugio?.rifugioData?.totalSlots ?? rifugio?.shelterData?.totalSlots;
  const availableSlots = rifugio?.rifugioData?.availableSlots ?? rifugio?.shelterData?.availableSlots;
  const contacts = getAllContacts(rifugio) || 'Contatti non pubblici';
  const websiteLink = `/pages/announcements.html?rifugioId=${encodeURIComponent(rifugio._id)}`;

  container.innerHTML = `
    <div class="info-tile">
      <span>Indirizzo</span>
      <strong>${escapeHtml(address || 'Non disponibile')}</strong>
    </div>
    <div class="info-tile">
      <span>Disponibilità</span>
      <strong>${escapeHtml(availableSlots ?? 'n/d')} / ${escapeHtml(totalSlots ?? 'n/d')}</strong>
      <p>Capienza attuale dichiarata dal rifugio.</p>
    </div>
    <div class="info-tile">
      <span>Contatti</span>
      <strong>${escapeHtml(contacts)}</strong>
      <a href="${websiteLink}">Vai agli annunci del rifugio</a>
    </div>
    <div class="info-tile">
      <span>Descrizione</span>
      <p>${escapeHtml(rifugio?.rifugioData?.description || 'Nessuna descrizione disponibile.')}</p>
    </div>
    <div class="info-tile">
      <span>Coordinate</span>
      <strong>${coords ? `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}` : 'Non disponibili'}</strong>
    </div>
    <div class="info-tile">
      <span>Stato</span>
      <strong>${escapeHtml(rifugio?.rifugioStatus || 'non configurato')}</strong>
    </div>
  `;
}

function renderAnnouncements(announcements, rifugio) {
  const grid = document.getElementById('shelter-announcements-grid');
  const counter = document.getElementById('shelter-announcements-count');
  const shelterAnnouncements = getShelterAnnouncements(announcements, rifugio._id).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  counter.textContent = `${shelterAnnouncements.length} annunci`;

  if (shelterAnnouncements.length === 0) {
    grid.innerHTML = '<div class="empty-state">Nessun annuncio pubblicato da questo rifugio.</div>';
    return;
  }

  grid.innerHTML = shelterAnnouncements.map((announcement) => {
    const animal = announcement.animalId || {};
    const title = animal.name || animal.breed || animal.species || 'Animale in rifugio';
    const date = announcement.date ? new Date(announcement.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Data non disponibile';
    return `
      <article class="card" data-id="${escapeHtml(announcement._id)}">
        <div class="card-image">
          <div class="card-image-placeholder"><span>${escapeHtml(animal?.species?.[0] || '…')}</span></div>
          
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-species">${escapeHtml(animal?.species || 'Specie sconosciuta')}</span>
            <span class="card-date">${escapeHtml(date)}</span>
          </div>
          <h3 class="card-breed">${escapeHtml(title)}</h3>
          <p class="card-description">${escapeHtml(announcement.description || 'Nessuna descrizione pubblica disponibile.')}</p>
          <a class="text-link" href="/pages/announcements.html?highlight=${encodeURIComponent(announcement._id)}">Apri annuncio →</a>
        </div>
      </article>
    `;
  }).join('');

  // try to load photos for each announcement and replace placeholders (use same selectors as announcements)
  shelterAnnouncements.forEach((announcement) => {
    const card = grid.querySelector(`.card[data-id="${announcement._id}"]`);
    if (!card) return;
    const container = card.querySelector('.card-image');
    const placeholder = container.querySelector('.card-image-placeholder');
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
  });
}

function renderMap(rifugio) {
  const coords = getCoordinates(rifugio);
  const mapLink = document.getElementById('shelter-map-link');
  if (!coords) {
    document.getElementById('shelter-map').innerHTML = '<div class="empty-state">Posizione non disponibile.</div>';
    if (mapLink) mapLink.style.display = 'none';
    return;
  }

  if (mapLink) {
    mapLink.href = `https://www.google.com/maps?q=${coords[1]},${coords[0]}`;
    mapLink.target = '_blank';
    mapLink.rel = 'noreferrer';
  }

  const map = L.map('shelter-map', { scrollWheelZoom: false }).setView([coords[1], coords[0]], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  L.marker([coords[1], coords[0]]).addTo(map).bindPopup(`<strong>${escapeHtml(getRifugioName(rifugio))}</strong>`).openPopup();
  requestAnimationFrame(() => map.invalidateSize());
}

async function loadPage() {
  const rifugioId = getRifugioId();
  if (!rifugioId) {
    document.getElementById('shelter-name').textContent = 'Rifugio non specificato';
    document.getElementById('shelter-description').textContent = 'Aggiungi il parametro rifugioId all’URL.';
    document.getElementById('shelter-stats').innerHTML = '';
    document.getElementById('shelter-info-grid').innerHTML = '<div class="empty-state">Nessun rifugio selezionato.</div>';
    document.getElementById('shelter-announcements-grid').innerHTML = '<div class="empty-state">Nessun annuncio disponibile.</div>';
    return;
  }

  const [rifugi, announcements] = await Promise.all([
    fetchJson(API_RIFUGI),
    fetchJson(API_ANNOUNCEMENTS + `?rifugioId=${encodeURIComponent(rifugioId)}`)
  ]);

  const rifugio = Array.isArray(rifugi) ? rifugi.find((item) => item._id === rifugioId) : null;
  if (!rifugio) throw new Error('Rifugio non trovato o non pubblico');

  const name = getRifugioName(rifugio);
  const announcementsCount = getShelterAnnouncements(announcements, rifugio._id).length;

  document.title = `${name} — Trovami`;
  document.getElementById('shelter-name').textContent = name;
  document.getElementById('shelter-description').textContent = rifugio?.rifugioData?.description || 'Nessuna descrizione pubblica disponibile.';
  document.getElementById('shelter-announcements-link').href = `/pages/announcements.html?rifugioId=${encodeURIComponent(rifugio._id)}`;
  document.getElementById('shelter-announcements-link').textContent = `Vedi annunci (${announcementsCount})`;
  document.getElementById('shelter-map-link').href = '#scheda-rifugio';

  renderStats(rifugio, announcements);
  renderInfo(rifugio);
  renderAnnouncements(announcements, rifugio);
  renderMap(rifugio);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadPage();
  } catch (error) {
    console.error('Errore caricamento rifugio:', error);
    document.getElementById('shelter-name').textContent = 'Errore caricamento rifugio';
    document.getElementById('shelter-description').textContent = error?.message || 'Impossibile caricare i dati del rifugio.';
    const infoGrid = document.getElementById('shelter-info-grid');
    if (infoGrid) infoGrid.innerHTML = `<div class="empty-state">${escapeHtml(error?.message || 'Errore caricamento dati')}</div>`;
    const annGrid = document.getElementById('shelter-announcements-grid');
    if (annGrid) annGrid.innerHTML = '<div class="empty-state">Impossibile caricare gli annunci.</div>';
  }
});
