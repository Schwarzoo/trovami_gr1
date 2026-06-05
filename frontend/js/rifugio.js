const API_RIFUGI = '/api/v1/users/shelters?isPublic=true';
const API_ANIMALS = '/api/v1/animals';
const API_CONTACT_REQUESTS = '/api/v1/contact-requests';
const API_FOLLOWED_SHELTERS = '/api/v1/users/me/followed-shelters';
let currentRifugio = null;
let isFollowingCurrentRifugio = false;

/**
 * Returns rifugio id.
 * @returns {string|null} Shelter id from the page query string.
 */
function getRifugioId() {
  return new URLSearchParams(window.location.search).get('rifugioId');
}

/**
 * Returns animal id.
 * @returns {string|null} Animal id from the page query string.
 */
function getAnimalId() {
  return new URLSearchParams(window.location.search).get('animalId');
}

/**
 * Reads the current user role from local storage.
 * @returns {string|null} Role from the JWT payload or stored role fallback.
 */
function getLoggedRole() {
  const token = localStorage.getItem('token');
  const payload = token ? decodeJwt(token) : null;
  return payload?.role || localStorage.getItem('role') || null;
}

/**
 * Closes the follow modal UI.
 * @returns {void}
 */
function closeFollowModal() {
  const overlay = document.getElementById('follow-shelter-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  const status = document.getElementById('follow-shelter-status');
  if (status) status.textContent = '';
}

/**
 * Opens the follow modal UI.
 * @returns {void}
 */
function openFollowModal() {
  const overlay = document.getElementById('follow-shelter-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

/**
 * Sets follow button state.
 * @param {boolean} isFollowing - Whether the current user follows this shelter.
 * @returns {void}
 */
function setFollowButtonState(isFollowing) {
  isFollowingCurrentRifugio = isFollowing;
  const button = document.getElementById('follow-shelter-button');
  if (!button) return;
  const role = getLoggedRole();
  button.style.display = role === 'user' || !localStorage.getItem('token') ? 'inline-flex' : 'none';
  button.textContent = isFollowing ? 'Non seguire più' : 'Segui rifugio';
  button.classList.toggle('primary', !isFollowing);
}

/**
 * Loads follow state data and updates the UI.
 * @param {string} rifugioId - Shelter identifier shown on the current page.
 * @returns {Promise<void>} Promise resolving after the follow button is updated.
 */
async function loadFollowState(rifugioId) {
  const token = localStorage.getItem('token');
  if (!token || getLoggedRole() !== 'user') {
    setFollowButtonState(false);
    return;
  }

  try {
    const followed = await fetchAuthJson(API_FOLLOWED_SHELTERS);
    const isFollowing = Array.isArray(followed) && followed.some(item => String(item._id) === String(rifugioId));
    setFollowButtonState(isFollowing);
  } catch (err) {
    setFollowButtonState(false);
  }
}

/**
 * Saves the current user's follow preference for the open shelter.
 * @param {boolean} emailEnabled - Whether shelter updates should also be sent by email.
 * @returns {Promise<void>} Promise resolving after the preference is saved or an error is shown.
 */
async function saveFollowPreference(emailEnabled) {
  if (!currentRifugio?._id) return;
  const status = document.getElementById('follow-shelter-status');
  if (status) status.textContent = 'Salvataggio...';
  try {
    await fetchAuthJson(`${API_FOLLOWED_SHELTERS}/${encodeURIComponent(currentRifugio._id)}`, {
      method: 'POST',
      body: JSON.stringify({ emailEnabled })
    });
    setFollowButtonState(true);
    closeFollowModal();
  } catch (err) {
    if (status) status.textContent = err.message || 'Errore salvataggio';
  }
}

/**
 * Removes the current shelter from the user's followed shelters.
 * @returns {Promise<void>} Promise resolving after the follow state is updated.
 */
async function unfollowCurrentShelter() {
  if (!currentRifugio?._id) return;
  const button = document.getElementById('follow-shelter-button');
  if (button) button.disabled = true;
  try {
    await fetchAuthJson(`${API_FOLLOWED_SHELTERS}/${encodeURIComponent(currentRifugio._id)}`, {
      method: 'DELETE'
    });
    setFollowButtonState(false);
  } catch (err) {
    alert(err.message || 'Errore: impossibile smettere di seguire il rifugio');
  } finally {
    if (button) button.disabled = false;
  }
}

/**
 * Binds follow, unfollow, and follow-preference controls.
 * @returns {void}
 */
function initFollowControls() {
  document.getElementById('follow-shelter-button')?.addEventListener('click', () => {
    const token = localStorage.getItem('token');
    if (!token) {
      const next = window.location.pathname + window.location.search;
      window.location.href = `/pages/login.html?next=${encodeURIComponent(next)}`;
      return;
    }
    if (getLoggedRole() !== 'user') return;
    if (isFollowingCurrentRifugio) {
      unfollowCurrentShelter();
      return;
    }
    openFollowModal();
  });

  document.getElementById('follow-shelter-close')?.addEventListener('click', closeFollowModal);
  document.getElementById('follow-shelter-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeFollowModal();
  });
  document.getElementById('follow-site-only')?.addEventListener('click', () => saveFollowPreference(false));
  document.getElementById('follow-site-email')?.addEventListener('click', () => saveFollowPreference(true));
}

/**
 * Collects visible shelter contact fields into a list.
 * @param {Object} rifugio - Shelter user object with public phone and email fields.
 * @returns {string} Contact summary joined for display.
 */
function getAllContacts(rifugio) {
  return [rifugio?.phoneNumber, rifugio?.email].filter(Boolean).join(' · ');
}

/**
 * Summarizes shelter animals by total and adoptable counts.
 * @param {Array<Object>} animals - Animals registered for the shelter.
 * @returns {{total: number, available: number}} Total and adoptable animal counts.
 */
function summarizeAnimals(animals) {
  const list = Array.isArray(animals) ? animals : [];
  return {
    total: list.length,
    available: list.filter(a => !!a?.adoptable).length
  };
}

/**
 * Renders shelter statistics into the page.
 * @param {Object} rifugio - Shelter user object for the current page.
 * @param {Array<Object>} animals - Animals used to calculate visible shelter stats.
 * @returns {void}
 */
function renderStats(rifugio, animals) {
  const stats = document.getElementById('shelter-stats');
  const { available } = summarizeAnimals(animals);

  stats.innerHTML = `
    <div class="stat-card">
      <span>Animali adottabili:</span>
      <strong>${escapeHtml(available)}</strong>
    </div>
  `;
}

/**
 * Renders shelter profile information and contacts.
 * @param {Object} rifugio - Shelter user object for the current page.
 * @param {Array<Object>} animals - Animals used to show availability totals.
 * @returns {void}
 */
function renderInfo(rifugio, animals) {
  const container = document.getElementById('shelter-info-grid');
  const coords = getCoordinates(rifugio);
  const address = [rifugio?.rifugioData?.address, rifugio?.rifugioData?.city].filter(Boolean).join(', ');
  const { total, available } = summarizeAnimals(animals);
  const contacts = getAllContacts(rifugio) || 'Contatti non pubblici';

  container.innerHTML = `
    <div class="info-tile">
      <span>Indirizzo</span>
      <strong>${escapeHtml(address || 'Non disponibile')}</strong>
    </div>
    <div class="info-tile">
      <span>Animali adottabili</span>
      <strong>${escapeHtml(available)} / ${escapeHtml(total)}</strong>
      <p>Animali adottabili rispetto al totale registrato.</p>
    </div>
    <div class="info-tile">
      <span>Contatti</span>
      <strong>${escapeHtml(contacts)}</strong>
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


/**
 * Renders animals for shelter into the current page.
 * @param {string} rifugioId - Shelter identifier used to fetch animals.
 * @returns {Promise<void>} Promise resolving after animal cards are rendered.
 */
async function renderAnimalsForShelter(rifugioId) {
  const grid = document.getElementById('shelter-animals-grid');
  const counter = document.getElementById('shelter-animals-count');
  if (!grid || !counter) return;
  try {
    const res = await fetch(`${API_ANIMALS}?shelterId=${encodeURIComponent(rifugioId)}`);
    if (!res.ok) throw new Error('Errore recupero animali');
    const payload = await res.json();
    const list = Array.isArray(payload) ? payload : payload.data || [];
    counter.textContent = `${(list && list.length) || 0} animali`;
    if (!list || list.length === 0) {
      grid.innerHTML = '<div class="empty-state">Nessun animale registrato.</div>';
      return;
    }
    grid.innerHTML = list.map(a => createAdoptableAnimalCard(a, { rifugio: currentRifugio })).join('');
    list.forEach(a => {
      const card = grid.querySelector(`.card[data-id="${a._id}"]`);
      if (!card) return;
      (async () => {
        await hydrateAdoptableAnimalCardImage(card, a);
      })();
    });
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

/**
 * Renders contact request panel into the current page.
 * @param {Object} animal - Animal shown in the open shelter animal modal.
 * @returns {void}
 */
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

  const form = document.getElementById('contact-request-form');
  const textarea = document.getElementById('contact-request-message');
  const status = document.getElementById('contact-request-status');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (status) status.textContent = '';

    const message = textarea?.value.trim();
    if (!message) {
      if (status) status.textContent = 'Inserisci un messaggio';
      return;
    }

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
      if (status) status.textContent = data.userMessage || data.message || 'Errore invio richiesta';
      return;
    }

    if (textarea) textarea.value = '';
    if (status) status.textContent = 'Richiesta inviata.';
  });
}

/**
 * Opens the shelter animal modal UI.
 * @param {string} animalId - Animal identifier to load and show.
 * @returns {Promise<void>} Promise resolving after the modal is populated or an error is shown.
 */
async function openShelterAnimalModal(animalId) {
  try {
    const a = await fetchJson(`${API_ANIMALS}/${encodeURIComponent(animalId)}`);
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

    if (notesContainer) {
      notesContainer.innerHTML = '';
      const notes = Array.isArray(a.medicalNotes) ? a.medicalNotes.slice().reverse() : [];
      if (notes.length === 0) notesContainer.innerHTML = '<div class="muted">Nessuna nota medica</div>';
      notes.forEach(n => {
        const el = document.createElement('div');
        el.className = 'medical-note';
        el.innerHTML = `<div class="medical-note-date">${escapeHtml(new Date(n.createdAt).toLocaleString())}</div><div>${escapeHtml(n.text)}</div>`;
        notesContainer.appendChild(el);
      });
    }

    if (gallery) {
      gallery.innerHTML = '';
      const photo = Array.isArray(a.photos) && a.photos.length ? a.photos[0] : null;
      if (photo) {
        await loadImageIntoGallery({
          gallery,
          url: photo,
          alt: a.species || 'Animale',
          fallbackText: 'Non è presente alcuna foto',
          style: { maxWidth: '100%', borderRadius: '8px' }
        });
      } else {
        gallery.innerHTML = '<div class="modal-no-photo">Non è presente alcuna foto</div>';
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

/**
 * Renders map markers and related map UI.
 * @param {Object} rifugio - Shelter user object containing the location to map.
 * @returns {void}
 */
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

/**
 * Loads the page data and initializes the view.
 * @returns {Promise<void>} Promise resolving after shelter data, animals, follow state, and map are initialized.
 * @throws {Error} When the requested shelter cannot be loaded.
 */
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
  currentRifugio = rifugio;

  const name = getRifugioName(rifugio);
  document.title = `${name} — Trovami`;
  document.getElementById('shelter-name').textContent = name;
  document.getElementById('shelter-description').textContent = rifugio?.rifugioData?.description || 'Nessuna descrizione pubblica disponibile.';
  document.getElementById('shelter-map-link').href = '#scheda-rifugio';
  const animalsPayload = await fetchJson(`${API_ANIMALS}?shelterId=${encodeURIComponent(rifugio._id)}`);
  const animals = Array.isArray(animalsPayload) ? animalsPayload : animalsPayload.data || [];
  renderStats(rifugio, animals);
  renderInfo(rifugio, animals);
  renderMap(rifugio);
  await loadFollowState(rifugio._id);
  await renderAnimalsForShelter(rifugio._id);
  if (animalId) {
    await openShelterAnimalModal(animalId).catch(() => {});
  }
}

/**
 * Initializes the single shelter page after the DOM is ready.
 * @returns {Promise<void>} Promise resolving when shelter data and controls are initialized.
 */
document.addEventListener('DOMContentLoaded', async () => {
  initFollowControls();
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
