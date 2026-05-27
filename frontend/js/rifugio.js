const API_RIFUGI = 'http://localhost:3000/api/v1/users/rifugi/public';
const API_ANNOUNCEMENTS = 'http://localhost:3000/api/v1/announcements';
const API_ANIMALS = 'http://localhost:3000/api/v1/animals';
const API_CONTACT_REQUESTS = 'http://localhost:3000/api/v1/contact-requests';

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

function getAnimalId() {
  return new URLSearchParams(window.location.search).get('animalId');
}

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return await res.json();
}

// announcements removed from shelter page; no helper needed

function getAllContacts(rifugio) {
  return [rifugio?.phoneNumber, rifugio?.email].filter(Boolean).join(' · ');
}

function summarizeAnimals(animals) {
  const list = Array.isArray(animals) ? animals : [];
  return {
    total: list.length,
    available: list.filter(a => !!a?.adoptable).length
  };
}

function renderStats(rifugio, animals) {
  const stats = document.getElementById('shelter-stats');
  const { total, available } = summarizeAnimals(animals);

  stats.innerHTML = `
    <div class="stat-card">
      <span>Animali disponibili</span>
      <strong>${escapeHtml(available)}</strong>
      <span>su ${escapeHtml(total)} animali registrati</span>
    </div>
  `;
}

function renderInfo(rifugio, animals) {
  const container = document.getElementById('shelter-info-grid');
  const coords = getCoordinates(rifugio);
  const address = [rifugio?.rifugioData?.address, rifugio?.rifugioData?.city].filter(Boolean).join(', ');
  const { total, available } = summarizeAnimals(animals);
  const contacts = getAllContacts(rifugio) || 'Contatti non pubblici';
  const websiteLink = `/pages/announcements.html?rifugioId=${encodeURIComponent(rifugio._id)}`;

  container.innerHTML = `
    <div class="info-tile">
      <span>Indirizzo</span>
      <strong>${escapeHtml(address || 'Non disponibile')}</strong>
    </div>
    <div class="info-tile">
      <span>Animali disponibili</span>
      <strong>${escapeHtml(available)} / ${escapeHtml(total)}</strong>
      <p>Animali adottabili rispetto al totale registrato.</p>
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

// Announcements section removed from shelter page

async function renderAnimalsForShelter(rifugioId) {
  const grid = document.getElementById('shelter-animals-grid');
  const counter = document.getElementById('shelter-animals-count');
  if (!grid || !counter) return;
  try {
    const res = await fetch(`${API_ANIMALS}?shelterId=${encodeURIComponent(rifugioId)}`);
    if (!res.ok) throw new Error('Errore recupero animali');
    const list = await res.json();
    counter.textContent = `${(list && list.length) || 0} animali`;
    if (!list || list.length === 0) {
      grid.innerHTML = '<div class="empty-state">Nessun animale registrato.</div>';
      return;
    }
    grid.innerHTML = list.map(a => {
      const name = a.name || a.breed || a.species || 'Animale';
      const status = a.adoptable ? 'Adottabile' : 'Non disponibile';
      return `
        <article class="card" data-id="${escapeHtml(a._id)}">
          <div class="card-image"><div class="card-image-placeholder"><span>${escapeHtml((a.species||'A')[0])}</span></div></div>
          <div class="card-body">
            <div class="card-meta"><span class="card-species">${escapeHtml(a.species || '')}</span></div>
            <h3 class="card-breed">${escapeHtml(name)}</h3>
            <p class="card-description">${escapeHtml(a.distinctiveFeatures || '')}</p>
            <div style="margin-top:8px;font-size:0.9rem;color:var(--text-muted)">${escapeHtml(status)}</div>
          </div>
        </article>
      `;
    }).join('');
    // load photos for animals
    list.forEach(a => {
      const card = grid.querySelector(`.card[data-id="${a._id}"]`);
      if (!card) return;
      const container = card.querySelector('.card-image');
      const placeholder = container.querySelector('.card-image-placeholder');
      const photo = Array.isArray(a.photos) && a.photos.length ? a.photos[0] : null;
      if (!photo) {
        if (placeholder) placeholder.innerHTML = `<span>${escapeHtml(a.species?.[0] || '?')}</span>`;
        return;
      }
      (async () => {
        try {
          const res = await fetch(photo, { method: 'GET' });
          if (!res.ok) throw new Error('no image');
          const ct = res.headers.get('content-type') || '';
          if (!ct.startsWith('image')) throw new Error('not image');
          const blob = await res.blob();
          const img = document.createElement('img');
          img.src = URL.createObjectURL(blob);
          img.alt = a.species || 'Animale';
          img.loading = 'lazy';
          img.onload = () => { URL.revokeObjectURL(img.src); };
          if (placeholder) placeholder.replaceWith(img);
        } catch (err) {
          if (placeholder) placeholder.innerHTML = `<span>${escapeHtml(a.species?.[0] || '?')}</span>`;
        }
      })();
    });
    // attach click handler to open animal detail modal (view-only)
    grid.addEventListener('click', (e) => {
      const clicked = e.target.closest('.card');
      if (!clicked || !grid.contains(clicked)) return;
      if (e.target.closest('button, a, input, textarea')) return;
      const id = clicked.dataset.id;
      if (id) openShelterAnimalModal(id);
    });
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(err.message || 'Errore')}</div>`;
    counter.textContent = '0 animali';
  }
}

function renderContactRequestPanel(animal) {
  const panel = document.getElementById('animal-contact-request');
  if (!panel) return;

  const token = localStorage.getItem('token');
  const payload = token ? decodeJwt(token) : null;
  const role = payload?.role || localStorage.getItem('role');
  const nextUrl = `${window.location.pathname}${window.location.search ? window.location.search : `?rifugioId=${encodeURIComponent(getRifugioId() || '')}`}`;
  const next = new URL(nextUrl, window.location.origin);
  next.searchParams.set('animalId', animal._id);
  const loginUrl = `/pages/login.html?next=${encodeURIComponent(next.pathname + next.search)}`;

  if (!token) {
    panel.innerHTML = `
      <div class="contact-request-box">
        <strong>Ti interessa questo animale?</strong>
        <p>Accedi come utente registrato per inviare una richiesta al rifugio.</p>
        <a class="button" href="${escapeHtml(loginUrl)}">Accedi</a>
      </div>
    `;
    return;
  }

  if (role !== 'user') {
    panel.innerHTML = '';
    return;
  }

  panel.innerHTML = `
    <form id="contact-request-form" class="contact-request-box">
      <strong>Richiedi informazioni per l'adozione</strong>
      <textarea id="contact-request-message" maxlength="1000" placeholder="Scrivi cosa vuoi chiedere o quando vorresti vedere l'animale"></textarea>
      <div class="contact-request-actions">
        <button type="submit" class="button primary">Invia richiesta</button>
        <span id="contact-request-status"></span>
      </div>
    </form>
  `;

  panel.querySelector('#contact-request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = panel.querySelector('#contact-request-status');
    const textarea = panel.querySelector('#contact-request-message');
    const message = textarea.value.trim();
    if (!message) {
      status.textContent = 'Scrivi un messaggio.';
      return;
    }

    status.textContent = 'Invio...';
    const res = await fetch(API_CONTACT_REQUESTS, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ animalId: animal._id, message })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      status.textContent = data.message || 'Errore invio richiesta';
      return;
    }

    textarea.value = '';
    status.textContent = 'Richiesta inviata.';
  });
}

async function openShelterAnimalModal(animalId) {
  try {
    const res = await fetch(`${API_ANIMALS}/${encodeURIComponent(animalId)}`);
    if (!res.ok) throw new Error('Animale non trovato');
    const a = await res.json();
    const titleEl = document.getElementById('animal-modal-title');
    const nameEl = document.getElementById('animal-name-display');
    const speciesEl = document.getElementById('animal-species-display');
    const breedEl = document.getElementById('animal-breed-display');
    const dateEl = document.getElementById('animal-dateArrived-display');
    const ageEl = document.getElementById('animal-age-display');
    const otherEl = document.getElementById('animal-otherInfo-display');
    const notesContainer = document.getElementById('animal-medicalNotes');
    const gallery = document.getElementById('animal-modal-gallery');

    if (titleEl) titleEl.textContent = a.name || (a.species || 'Animale');
    if (nameEl) nameEl.textContent = a.name || '-';
    if (speciesEl) speciesEl.textContent = a.species || '-';
    if (breedEl) breedEl.textContent = a.breed || '-';
    if (dateEl) dateEl.textContent = a.dateArrived ? new Date(a.dateArrived).toLocaleDateString('it-IT') : '-';
    if (ageEl) ageEl.textContent = a.age || '-';
    if (otherEl) otherEl.textContent = a.otherInfo || '-';

    const adoptableText = a.adoptable ? 'Sì' : 'No';
    const adoptableEl = document.getElementById('animal-adoptable-display');
    if (adoptableEl) adoptableEl.textContent = adoptableText;

    // notes
    if (notesContainer) {
      notesContainer.innerHTML = '';
      const notes = Array.isArray(a.medicalNotes) ? a.medicalNotes.slice().reverse() : [];
      if (notes.length === 0) notesContainer.innerHTML = '<div class="muted">Nessuna nota medica</div>';
      notes.forEach(n => {
        const el = document.createElement('div');
        el.style.padding = '6px 0';
        el.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted)">${escapeHtml(new Date(n.createdAt).toLocaleString())}</div><div>${escapeHtml(n.text)}</div>`;
        notesContainer.appendChild(el);
      });
    }

    // gallery
    if (gallery) {
      gallery.innerHTML = '';
      const photo = Array.isArray(a.photos) && a.photos.length ? a.photos[0] : null;
      if (photo) {
        const img = document.createElement('img');
        img.src = photo;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        gallery.appendChild(img);
      }
    }

    renderContactRequestPanel(a);

    document.getElementById('animal-modal-overlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    document.getElementById('animal-modal-close').onclick = () => {
      document.getElementById('animal-modal-overlay').style.display = 'none';
      document.body.style.overflow = '';
    };
  } catch (err) {
    alert(err.message || 'Errore apertura scheda animale');
  }
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
  const animalId = getAnimalId();
  if (!rifugioId) {
    document.getElementById('shelter-name').textContent = 'Rifugio non specificato';
    document.getElementById('shelter-description').textContent = 'Aggiungi il parametro rifugioId all’URL.';
    document.getElementById('shelter-stats').innerHTML = '';
    document.getElementById('shelter-info-grid').innerHTML = '<div class="empty-state">Nessun rifugio selezionato.</div>';
    return;
  }

  const rifugi = await fetchJson(API_RIFUGI);

  const rifugio = Array.isArray(rifugi) ? rifugi.find((item) => item._id === rifugioId) : null;
  if (!rifugio) throw new Error('Rifugio non trovato o non pubblico');

  const name = getRifugioName(rifugio);
  document.title = `${name} — Trovami`;
  document.getElementById('shelter-name').textContent = name;
  document.getElementById('shelter-description').textContent = rifugio?.rifugioData?.description || 'Nessuna descrizione pubblica disponibile.';
  document.getElementById('shelter-map-link').href = '#scheda-rifugio';
  const animals = await fetchJson(`${API_ANIMALS}?shelterId=${encodeURIComponent(rifugio._id)}`);
  renderStats(rifugio, animals);
  renderInfo(rifugio, animals);
  renderMap(rifugio);
  // load animals for this shelter
  await renderAnimalsForShelter(rifugio._id);
  if (animalId) {
    await openShelterAnimalModal(animalId).catch(() => {});
  }
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
  }
});
