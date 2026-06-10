/**
 * Initializes shelter profile widgets, animal management, and shelter announcement flows.
 * @param {Object} context - Shared profile dependencies and helper functions.
 * @param {string} context.myUserId - Current authenticated user identifier.
 * @returns {void}
 */
function initProfileShelter(context) {
  const {
    myUserId,
    token,
    authHeader,
    fetchAnnouncementById,
    fetchSimilarAnnouncements,
    displayValue,
    syncMyAnnouncementsVisibility
  } = context;

  /**
   * Renders the current shelter approval status in the profile page.
   * @param {Object} me - Current authenticated user profile.
   * @returns {void}
   */
  function renderRifugioStatus(me) {
    const box = document.getElementById('rifugio-status-box');
    if (!box) return;
    if (me.role !== 'shelter') {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }

    const name = me.rifugioData?.rifugioName || me.username || 'Rifugio';
    const labels = {
      pending: 'in attesa di approvazione admin',
      approved: 'approvato',
      rejected: 'rifiutato'
    };
    box.style.display = 'block';
    box.innerHTML = `
      <div class="comment-meta">
        <span class="comment-user">Account rifugio</span>
        <span class="comment-date">${escapeHtml(labels[me.rifugioStatus] || me.rifugioStatus || 'non configurato')}</span>
      </div>
      <div class="comment-text">${escapeHtml(name)}${me.rifugioStatus === 'pending' ? ': potrai pubblicare annunci dopo approvazione.' : ''}</div>
    `;
  }

  /**
   * Renders rifugio position into the current page.
   * @param {Object} me - Current authenticated user profile.
   * @returns {void}
   */
  function renderRifugioPosition(me) {
    const box = document.getElementById('rifugio-position-box');
    const text = document.getElementById('rifugio-position-text');
    const button = document.getElementById('editRifugioPosition');
    const message = document.getElementById('rifugio-position-message');
    if (!box || !text || !button) return;

    if (me.role !== 'shelter' || me.rifugioStatus !== 'approved') {
      box.style.display = 'none';
      return;
    }

    const coords = getRifugioCoordinates();
    const savedAddress = [me.rifugioData?.address, me.rifugioData?.city].filter(Boolean).join(', ');
    box.style.display = 'block';
    text.textContent = coords
      ? (savedAddress
        ? `Posizione salvata: ${savedAddress}. Puoi modificarla dalla mappa.`
        : 'Posizione salvata. Puoi modificarla dalla mappa.')
      : 'Aggiungi la posizione del rifugio: puoi cercarla per indirizzo e città , usare la tua posizione o scegliere un punto sulla mappa.';
    button.textContent = coords ? 'Modifica posizione' : 'Aggiungi posizione';
    if (message) message.textContent = coords ? '' : 'Prima di creare annunci rifugio salva un punto sulla mappa o cerca l\'indirizzo.';
    setRifugioPositionEditingState(document.getElementById('profile-section')?.classList.contains('is-editing'));
  }

  /**
   * Toggles shelter position controls between locked and editable state.
   * @param {boolean} enabled - Whether the shelter position UI should be interactive.
   * @returns {void}
   */
  function setRifugioPositionEditingState(enabled) {
    const box = document.getElementById('rifugio-position-box');
    if (!box) return;

    box.classList.toggle('is-locked', !enabled);

    [
      'rifugio-search-address',
      'rifugio-search-city',
      'searchRifugioPosition',
      'useRifugioLocation',
      'editRifugioPosition',
      'saveRifugioPosition'
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') {
        el.disabled = !enabled;
      }
    });

    const map = document.getElementById('rifugio-position-map');
    if (map) {
      map.style.pointerEvents = enabled ? 'auto' : 'none';
      map.style.filter = enabled ? '' : 'grayscale(0.15) opacity(0.72)';
    }

    const hint = document.getElementById('rifugio-position-message');
    if (hint && !enabled) {
      hint.textContent = 'Clicca Modifica in basso per sbloccare la posizione del rifugio.';
    }
  }

  /**
   * Ensures the shelter-position Leaflet map exists and is visible.
   * @returns {Object|null} Leaflet map instance, or null when the map container is missing.
   */
  function ensureRifugioMap() {
    const mapEl = document.getElementById('rifugio-position-map');
    if (!mapEl) return null;
    mapEl.style.display = 'block';

    if (!rifugioMapInstance) {
      rifugioMapInstance = L.map('rifugio-position-map').setView([46.0667, 11.1333], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(rifugioMapInstance);
      rifugioMapInstance.on('click', (e) => {
        setPendingRifugioLocation(e.latlng.lng, e.latlng.lat, { lookupAddress: true });
      });
    }

    requestAnimationFrame(() => rifugioMapInstance.invalidateSize());
    return rifugioMapInstance;
  }

  /**
   * Sets pending rifugio location.
   * @param {number} lng - Selected shelter longitude.
   * @param {number} lat - Selected shelter latitude.
   * @returns {void}
   */
  function setPendingRifugioLocation(lng, lat, options = {}) {
    pendingRifugioLocation = [lng, lat];
    const map = ensureRifugioMap();
    if (!map) return;
    if (rifugioMapMarker) {
      rifugioMapMarker.setLatLng([lat, lng]);
    } else {
      rifugioMapMarker = L.marker([lat, lng]).addTo(map);
    }
    map.setView([lat, lng], 15);
    document.getElementById('saveRifugioPosition').style.display = 'inline-block';
    document.getElementById('rifugio-position-message').textContent = 'Punto selezionato. Salva la posizione.';

    if (options.lookupAddress) {
      void reverseGeocodeRifugioPosition(lng, lat).then((location) => {
        if (!location) return;
        const addressInput = document.getElementById('rifugio-search-address');
        const cityInput = document.getElementById('rifugio-search-city');
        if (addressInput && location.address) addressInput.value = location.address;
        if (cityInput && location.city) cityInput.value = location.city;
        const message = document.getElementById('rifugio-position-message');
        if (message) message.textContent = 'Indirizzo trovato dalla posizione. Puoi modificarlo prima di salvare.';
      });
    }
  }

  /**
   * Opens the rifugio position editor UI.
   * @returns {void}
   */
  function openRifugioPositionEditor() {
    const map = ensureRifugioMap();
    const coords = getRifugioCoordinates();
    const addressInput = document.getElementById('rifugio-search-address');
    const cityInput = document.getElementById('rifugio-search-city');

    if (addressInput && !addressInput.value.trim()) addressInput.value = currentUser?.rifugioData?.address || '';
    if (cityInput && !cityInput.value.trim()) cityInput.value = currentUser?.rifugioData?.city || '';

    if (coords) {
      setPendingRifugioLocation(coords[0], coords[1]);
    } else if (map) {
      map.setView([46.0667, 11.1333], 13);
      document.getElementById('saveRifugioPosition').style.display = 'none';
      document.getElementById('rifugio-position-message').textContent = 'Clicca sulla mappa per scegliere il punto del rifugio.';
    }
    requestAnimationFrame(() => map && map.invalidateSize());
  }

  /**
   * Searches a rifugio location by address and city, then updates the pending marker.
   * @returns {Promise<void>} Promise resolving after the lookup is completed or rejected.
   */
  async function searchRifugioPosition() {
    const address = document.getElementById('rifugio-search-address')?.value.trim() || '';
    const city = document.getElementById('rifugio-search-city')?.value.trim() || '';
    const query = [address, city].filter(Boolean).join(', ');
    const message = document.getElementById('rifugio-position-message');

    if (!query) {
      if (message) message.textContent = 'Inserisci almeno indirizzo o città .';
      return;
    }

    const map = ensureRifugioMap();
    if (!map) return;

    if (message) message.textContent = 'Ricerca posizione in corso...';

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=it&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Ricerca posizione non disponibile');

      const results = await res.json();
      const result = Array.isArray(results) ? results[0] : null;
      const longitude = Number(result?.lon);
      const latitude = Number(result?.lat);

      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        if (message) message.textContent = 'Nessun risultato trovato per la ricerca inserita.';
        return;
      }

      setPendingRifugioLocation(longitude, latitude);
      if (message) message.textContent = `Posizione trovata per ${query}. Controlla la mappa e salva.`;
    } catch (err) {
      console.error('Errore ricerca rifugio:', err);
      if (message) message.textContent = 'Errore durante la ricerca della posizione.';
    }
  }

  /**
   * Uses the browser geolocation to set the pending rifugio position.
   * @returns {void}
   */
  function useRifugioCurrentLocation() {
    const message = document.getElementById('rifugio-position-message');

    if (!navigator.geolocation) {
      showSiteAlert('Geolocalizzazione non disponibile nel browser.');
      return;
    }

    ensureRifugioMap();
    if (message) message.textContent = 'Recupero la tua posizione...';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setPendingRifugioLocation(longitude, latitude, { lookupAddress: true });
        if (message) message.textContent = 'Posizione attuale rilevata. Controlla la mappa e salva.';
      },
      (error) => {
        console.error('Geolocation error:', error);
        let msg = 'Errore nella geolocalizzazione.';
        if (error.code === error.PERMISSION_DENIED) msg = 'Permesso negato per la geolocalizzazione.';
        if (error.code === error.POSITION_UNAVAILABLE) msg = 'Posizione non disponibile.';
        if (error.code === error.TIMEOUT) msg = 'Timeout della richiesta di posizione.';
        if (message) message.textContent = msg;
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  }

  /**
   * Saves the pending shelter map position to the current user profile.
   * @returns {Promise<void>} Promise resolving after the profile UI is updated or an error is shown.
   */
  async function saveRifugioPosition() {
    if (!pendingRifugioLocation) {
      showSiteAlert('Seleziona un punto sulla mappa');
      return;
    }

    const [lng, lat] = pendingRifugioLocation;
    const addressInput = document.getElementById('rifugio-search-address');
    const cityInput = document.getElementById('rifugio-search-city');
    let address = addressInput?.value.trim() || '';
    let city = cityInput?.value.trim() || '';

    if (!address || !city) {
      const resolvedLocation = await reverseGeocodeRifugioPosition(lng, lat);
      if (resolvedLocation) {
        if (!address && resolvedLocation.address) address = resolvedLocation.address;
        if (!city && resolvedLocation.city) city = resolvedLocation.city;
        if (addressInput && !addressInput.value.trim() && resolvedLocation.address) addressInput.value = resolvedLocation.address;
        if (cityInput && !cityInput.value.trim() && resolvedLocation.city) cityInput.value = resolvedLocation.city;
      }
    }

    const res = await fetch('/api/v1/users/me', {
      method: 'PUT',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rifugioData: {
          location: { type: 'Point', coordinates: [lng, lat] },
          ...(address ? { address } : {}),
          ...(city ? { city } : {})
        }
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showSiteAlert(data.userMessage || data.message || 'Errore salvataggio posizione');
      return;
    }

    const savedCoords = data?.rifugioData?.location?.coordinates;
    if (!Array.isArray(savedCoords) || savedCoords.length !== 2) {
      showSiteAlert('La posizione non risulta salvata. Riprova.');
      return;
    }

    currentUser = data;
    pendingRifugioLocation = getRifugioCoordinates();
    renderRifugioPosition(currentUser);
    document.getElementById('saveRifugioPosition').style.display = 'none';
    document.getElementById('rifugio-position-message').textContent = 'Posizione salvata.';
  }

  /**
   * Fetches admin reports data from the API.
   * @returns {Promise<Array<Object>>} Report records visible to admins.
   */

  function openAnimalCreateModal() {
    const overlay = document.getElementById('animal-create-overlay');
    const form = document.getElementById('animal-create-form');
    const title = document.getElementById('animal-create-title');
    const status = document.getElementById('animal-create-status');
    if (!overlay || !form) return;

    form.reset();
    if (title) title.textContent = 'Aggiungi animale';
    if (status) status.textContent = '';
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const adoptable = document.getElementById('animal-create-adoptable');
    if (adoptable) adoptable.checked = currentUser?.role === 'shelter';
    const photo = document.getElementById('animal-create-photo');
    if (photo) photo.value = '';
  }

  /**
   * Closes the shelter animal creation modal.
   * @returns {void}
   */
  function closeAnimalCreateModal() {
    const overlay = document.getElementById('animal-create-overlay');
    const status = document.getElementById('animal-create-status');
    const photo = document.getElementById('animal-create-photo');
    if (overlay) overlay.style.display = 'none';
    if (status) status.textContent = '';
    if (photo) photo.value = '';
    document.body.style.overflow = '';
  }
  /**
   * Loads my announcements data and updates the UI.
   * @returns {Promise<void>} Promise resolving after the current user's announcement grid is rendered.
   */
  async function loadMyAnnouncements() {
    if (!syncMyAnnouncementsVisibility()) return;
    const res = await fetch('/api/v1/announcements');
    if (!res.ok) return;
    const payload = await res.json();
    const all = Array.isArray(payload) ? payload : payload.data || [];
    const mine = all.filter(a => a.publisherId && ((a.publisherId._id || a.publisherId) == myUserId || (a.publisherId._id && a.publisherId._id == myUserId)));

    const grid = document.getElementById('announcements-grid');
    grid.innerHTML = '';
    mine.forEach(a => {
      const div = document.createElement('article');
      div.className = 'card profile-announcement-card';
      div.dataset.id = a._id;
      const photoUrl = `/api/v1/announcements/${a._id}/photo`;
      const statusLabel = a.status === 'RESOLVED' ? 'Risolto' : 'Attivo';
      const statusClass = a.status === 'RESOLVED' ? 'is-resolved' : 'is-active';
      const titleText = a.animalId?.name ? `${escapeHtml(a.animalId.name)} - ${escapeHtml(a.animalId.species || '')}` : escapeHtml(a.animalId?.species || 'Animale');
      div.innerHTML = `
        <div class="card-image"><div class="card-image-placeholder"><span>...</span></div></div>
        <div class="card-body">
          <div class="profile-announcement-card__meta">
            <span class="profile-announcement-status ${statusClass}">${statusLabel}</span>
            <span class="profile-announcement-kind">Il tuo annuncio</span>
          </div>
          <h3 class="card-breed profile-announcement-card__title">${titleText}</h3>
          <p class="card-description profile-announcement-card__description">${escapeHtml(a.description || 'Nessuna descrizione disponibile.')}</p>
          <div class="profile-announcement-card__actions">
            <button data-id="${a._id}" class="edit btn btn--ghost profile-announcement-card__button">Modifica</button>
            ${a.status !== 'RESOLVED' && !isShelterAnnouncement(a) ? `<button data-id="${a._id}" class="close btn btn--ghost profile-announcement-card__button">Chiudi</button>` : ''}
            <button data-id="${a._id}" class="del btn btn--danger profile-announcement-card__button">Elimina</button>
          </div>
        </div>
      `;

      grid.appendChild(div);

      (async () => {
        const container = div.querySelector('.card-image');
        try {
          const res = await fetch(photoUrl, { method: 'GET' });
          if (!res.ok) throw new Error('no image');
          const ct = res.headers.get('content-type') || '';
          if (!ct.startsWith('image')) throw new Error('not image');
          const blob = await res.blob();
          const img = document.createElement('img');
          img.src = URL.createObjectURL(blob);
          img.onload = () => { URL.revokeObjectURL(img.src); };
          const placeholder = container.querySelector('.card-image-placeholder');
          if (placeholder) placeholder.replaceWith(img);
        } catch (err) {
          const placeholder = container.querySelector('.card-image-placeholder');
          if (placeholder) placeholder.innerHTML = '🐾';
        }
      })();
    });

    if (!grid.dataset.eventsBound) {
      grid.dataset.eventsBound = '1';
      grid.addEventListener('click', async (e) => {
        const closeButton = e.target.closest('button.close');
        if (closeButton) {
          const id = closeButton.dataset.id;
          const confirmed = await showProfileConfirm({
            title: 'Segna come risolto',
            message: 'Segni l\'annuncio come risolto? Non comparirà  più nella lista pubblica.',
            confirmLabel: 'Segna come risolto',
            danger: false
          });
          if (!confirmed) return;
          const res = await fetch(`/api/v1/announcements/${id}`, {
            method: 'PATCH',
            headers: authHeader,
            body: JSON.stringify({ status: 'RESOLVED' })
          });
          if (res.ok) {
            loadMyAnnouncements();
            window.dispatchEvent(new Event('announcements:resolved-updated'));
          } else {
            showSiteAlert('Errore chiusura');
          }
          return;
        }

        const deleteButton = e.target.closest('button.del');
        if (deleteButton) {
          const id = deleteButton.dataset.id;
          const confirmed = await showProfileConfirm({
            title: 'Elimina annuncio',
            message: 'Eliminare annuncio? Questa azione rimuove anche i dati collegati.',
            confirmLabel: 'Elimina',
            danger: true
          });
          if (!confirmed) return;
          try {
            const res = await fetch(`/api/v1/announcements/${id}`, { method: 'DELETE', headers: authHeader });
            if (res.ok) {
              loadMyAnnouncements();
            } else {
              const d = await res.json().catch(() => ({}));
              showSiteAlert(d.userMessage || d.message || ('Errore eliminazione (' + res.status + ')'));
            }
          } catch (err) {
            showSiteAlert('Errore di rete: ' + (err.message || err));
          }
          return;
        }

        const clickedCard = e.target.closest('.card');
        if (!clickedCard || !grid.contains(clickedCard)) return;
        if (e.target.closest('button, a, input, select, textarea')) return;
        const id = clickedCard.dataset.id;
        if (id) openAnnouncementModal(id);
      });
    }
  }

  /**
   * Loads my animals data and updates the UI.
   * @returns {Promise<void>} Promise resolving after the current shelter's animal grid is rendered.
   */
  async function loadMyAnimals() {
    const section = document.getElementById('my-animals');
    const grid = document.getElementById('my-animals-grid');
    const counter = document.getElementById('my-animals-count');
    const addAnimalBtn = document.getElementById('addAnimalBtn');
    if (!section || !grid) return;
    if (currentUser?.role !== 'shelter') {
      section.style.display = 'none';
      if (addAnimalBtn) addAnimalBtn.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    if (addAnimalBtn) addAnimalBtn.style.display = 'inline-flex';
    try {
      const res = await fetch(`${API_ANIMALS}?shelterId=${encodeURIComponent(currentUser._id)}`, { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } });
      if (!res.ok) throw new Error('Errore recupero animali');
      const payload = await res.json();
      const list = Array.isArray(payload) ? payload : payload.data || [];
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
              <div class="animal-status">${escapeHtml(status)}</div>
            </div>
          </article>
        `;
      }).join('');
      list.forEach(a => {
        const card = grid.querySelector(`.card[data-id="${a._id}"]`);
        if (!card) return;
        const container = card.querySelector('.card-image');
        const placeholder = container.querySelector('.card-image-placeholder');
        const photo = Array.isArray(a.photos) && a.photos.length ? a.photos[0] : null;
        if (!photo) {
          if (placeholder) placeholder.innerHTML = '🐾';
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
            if (placeholder) placeholder.innerHTML = '🐾';
          }
        })();
      });

      grid.addEventListener('click', (e) => {
        const clicked = e.target.closest('.card');
        if (!clicked || !grid.contains(clicked)) return;
        if (e.target.closest('button, a, input, textarea')) return;
        const id = clicked.dataset.id;
        if (id) openAnimalModal(id);
      });
    } catch (err) {
      grid.innerHTML = `<div class="empty-state">${escapeHtml(err.message || 'Errore')}</div>`;
      if (counter) counter.textContent = '';
    }
  }

  /**
   * Opens the animal modal UI.
   * @param {string} animalId - Animal identifier to load for editing.
   * @returns {Promise<void>} Promise resolving after the animal modal is populated or an error is shown.
   */
  async function openAnimalModal(animalId) {
    try {
      const res = await fetch(`/api/v1/animals/${encodeURIComponent(animalId)}`, { headers: { 'Authorization': 'Bearer ' + token } });
      if (!res.ok) throw new Error('Animale non trovato');
      const a = await res.json();
      document.getElementById('animal-modal-title').textContent = a.name || (a.species || 'Animale');
      document.getElementById('animal-name').value = a.name || '';
      document.getElementById('animal-species').value = a.species || '';
      document.getElementById('animal-breed').value = a.breed || '';
      document.getElementById('animal-dateArrived').value = a.dateArrived ? new Date(a.dateArrived).toISOString().slice(0,10) : '';
      document.getElementById('animal-age').value = a.age || '';
      document.getElementById('animal-otherInfo').value = a.otherInfo || '';
      /**
       * Sets segmented value.
       * @param {string} segId - Id of the segmented control element.
       * @param {boolean} boolVal - Boolean value to mark as active.
       * @returns {void}
       */
      function setSegmentedValue(segId, boolVal) {
        const seg = document.getElementById(segId);
        if (!seg) return;
        const buttons = Array.from(seg.querySelectorAll('button'));
        buttons.forEach(b => b.classList.toggle('is-active', String(b.dataset.value) === String(!!boolVal)));
      }
      /**
       * Returns segmented value.
       * @param {string} segId - Id of the segmented control element.
       * @returns {boolean} Active segmented-control value, defaulting to false.
       */
      function getSegmentedValue(segId) {
        const seg = document.getElementById(segId);
        if (!seg) return false;
        const active = seg.querySelector('button.is-active');
        return active ? String(active.dataset.value) === 'true' : false;
      }
      setSegmentedValue('seg-animal-adoptable', !!a.adoptable);
      const seg = document.getElementById('seg-animal-adoptable');
      if (seg) {
        Array.from(seg.querySelectorAll('button')).forEach(btn => {
          btn.onclick = () => {
            seg.querySelectorAll('button').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
          };
        });
      }

      const notesContainer = document.getElementById('animal-medicalNotes');
      notesContainer.innerHTML = '';
      const notes = Array.isArray(a.medicalNotes) ? a.medicalNotes.slice().reverse() : [];
      if (notes.length === 0) notesContainer.innerHTML = '<div class="muted">Nessuna nota medica</div>';
      notes.forEach(n => {
        const el = document.createElement('div');
        el.className = 'medical-note';
        el.innerHTML = `<div class="medical-note-date">${escapeHtml(new Date(n.createdAt).toLocaleString())}</div><div>${escapeHtml(n.text)}</div>`;
        notesContainer.appendChild(el);
      });

      const gallery = document.getElementById('animal-modal-gallery');
      gallery.innerHTML = '';
      const photo = Array.isArray(a.photos) && a.photos.length ? a.photos[0] : null;
      if (photo) {
        const img = document.createElement('img');
        img.src = photo;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        gallery.appendChild(img);
      }

      document.getElementById('animal-modal-overlay').style.display = 'flex';
      document.body.style.overflow = 'hidden';

      document.getElementById('animal-modal-close').onclick = () => { document.getElementById('animal-modal-overlay').style.display = 'none'; document.body.style.overflow = ''; };
      const deleteButton = document.getElementById('animal-delete');
      if (deleteButton) {
        deleteButton.disabled = false;
        deleteButton.onclick = async () => {
          const confirmed = await showProfileConfirm({
            title: 'Elimina animale',
            message: "Vuoi eliminare questo animale? Se e collegato a un annuncio, verra eliminato anche l'annuncio.",
            confirmLabel: 'Elimina',
            danger: true
          });
          if (!confirmed) return;
          deleteButton.disabled = true;
          try {
            const delRes = await fetch(`/api/v1/animals/${encodeURIComponent(animalId)}`, {
              method: 'DELETE',
              headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!delRes.ok) {
              const data = await delRes.json().catch(() => ({}));
              throw new Error(data.userMessage || data.message || 'Errore eliminazione animale');
            }
            document.getElementById('animal-modal-overlay').style.display = 'none';
            document.body.style.overflow = '';
            await loadMyAnimals();
            await loadMyAnnouncements();
          } catch (err) {
            showSiteAlert(err.message || 'Errore eliminazione animale');
          } finally {
            deleteButton.disabled = false;
          }
        };
      }

      document.getElementById('animal-save').onclick = async () => {
        const payload = {
          name: document.getElementById('animal-name').value.trim() || undefined,
          dateArrived: document.getElementById('animal-dateArrived').value || undefined,
          age: document.getElementById('animal-age').value.trim() || undefined,
          otherInfo: document.getElementById('animal-otherInfo').value || undefined,
          adoptable: getSegmentedValue('seg-animal-adoptable')
        };
        const newNote = document.getElementById('animal-newMedicalNote').value.trim();
        if (newNote) payload.medicalNote = newNote;
        try {
          const upr = await fetch(`/api/v1/animals/${encodeURIComponent(animalId)}`, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!upr.ok) {
            const data = await upr.json().catch(()=>({}));
            throw new Error(data.userMessage || data.message || 'Errore salvataggio');
          }
          document.getElementById('animal-modal-overlay').style.display = 'none';
          document.body.style.overflow = '';
          await loadMyAnimals();
        } catch (err) {
          showSiteAlert(err.message || 'Errore salvataggio');
        }
      };

    } catch (err) {
      showSiteAlert(err.message || 'Errore apertura scheda animale');
    }
  }

/**
   * Opens the announcement modal UI.
   * @param {string} announcementId - Announcement identifier to load for viewing.
   * @returns {Promise<void>} Promise resolving after the announcement modal is populated.
   * @throws {Error} When the announcement cannot be loaded.
   */
  async function openAnnouncementModal(announcementId) {
    const data = await fetchAnnouncementById(announcementId);
    if (!data) {
      showSiteAlert('Annuncio non trovato');
      return;
    }

    const animal = data.animalId || {};
    const publisher = data.publisherId || {};
    const isLost = data.type === 'LostAnimal';
    const rifugioName = publisher?.role === 'shelter'
      ? (publisher?.rifugioData?.rifugioName || publisher?.username)
      : '';

    const date = new Date(data.date).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    document.getElementById('view-modal-title').textContent =
      animal?.name || (isLost ? `${animal?.species || 'Animale'} smarrito/a` : `Avvistamento: ${animal?.species || 'Animale'}`);

    const gallery = document.getElementById('view-modal-gallery');
    gallery.innerHTML = '<div class="view-modal-no-photo">Caricamento...</div>';
    (async () => {
      const photoUrl = `/api/v1/announcements/${data._id}/photo`;
      try {
        const res = await fetch(photoUrl, { method: 'GET' });
        if (!res.ok) throw new Error('no image');
        const ct = res.headers.get('content-type') || '';
        if (!ct.startsWith('image')) throw new Error('not image');
        const blob = await res.blob();
        const img = document.createElement('img');
        img.src = URL.createObjectURL(blob);
        img.alt = 'foto animale';
        img.onload = () => { URL.revokeObjectURL(img.src); };
        gallery.innerHTML = '';
        gallery.appendChild(img);
      } catch (err) {
        gallery.innerHTML = '<div class="view-modal-no-photo">Non è presente alcuna foto</div>';
      }
    })();

    document.getElementById('view-modal-body').innerHTML = `
        <div class="view-modal-summary">
          <dl class="detail-list view-modal-details">
        ${animal?.name ? `<dt>Nome</dt><dd>${escapeHtml(animal.name)}</dd>` : ''}
        <dt>Specie</dt><dd>${displayValue(animal?.species)}</dd>
        <dt>Razza</dt><dd>${displayValue(animal?.breed)}</dd>
        <dt>Colore</dt><dd>${displayValue(animal?.color)}</dd>
        <dt>Sesso</dt><dd>${displayValue(animal?.gender)}</dd>
        <dt>Lunghezza pelo</dt><dd>${displayValue(animal?.lunghezzaPelo)}</dd>
        <dt>Segni particolari</dt><dd>${displayValue(animal?.distinctiveFeatures)}</dd>
        <dt>Microchip</dt><dd>${displayValue(animal?.microchipId)}</dd>
        <dt>Data</dt><dd>${date}</dd>
        <dt>Condizioni</dt><dd>${displayValue(data.healthCondition)}</dd>
        <dt>Comportamento</dt><dd>${displayValue(data.animalBehaviour)}</dd>
        <dt>Stato</dt><dd>${displayValue(data.status)}</dd>
        </dl>
        <div class="view-modal-aside">
          <section class="view-modal-block">
            <h4>Descrizione</h4>
            <p class="modal-description">${escapeHtml(data.description || 'Nessuna descrizione disponibile.')}</p>
          </section>
          ${rifugioName ? `<section class="view-modal-block view-modal-contact-block"><h4>Rifugio</h4><div class="modal-contact"><span>${escapeHtml(rifugioName)}</span></div></section>` : ''}
        </div>
      </div>
    `;

    try {
      const bodyEl = document.getElementById('view-modal-body');
      const isOwner = (publisher && ((publisher._id && String(publisher._id) === String(myUserId)) || (String(publisher) === String(myUserId))));
      if (isOwner && bodyEl) {
        const actions = document.createElement('div');
        actions.style = 'margin-top:12px;display:flex;gap:8px;';
        const btn = document.createElement('button');
        btn.className = 'btn btn--ghost';
        btn.id = 'downloadFlyerBtn';
        btn.dataset.id = data._id;
        btn.textContent = 'Genera Volantino';
        actions.appendChild(btn);
        bodyEl.appendChild(actions);

        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          try {
            const res = await fetch(`/api/v1/announcements/${id}/flyer`, { method: 'GET', headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) {
              const d = await res.json().catch(()=>({}));
              showSiteAlert(d.userMessage || d.message || ('Errore generazione volantino (' + res.status + ')'));
              return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `volantino-${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          } catch (err) {
            showSiteAlert('Errore generazione volantino: ' + (err.message || err));
          }
        });
      }
    } catch (err) {
      console.warn('Errore preparazione pulsante volantino:', err);
    }

    document.getElementById('view-modal-overlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const similarGrid = document.getElementById('view-similar-grid');
    similarGrid.innerHTML = '<div class="comments-empty">Caricamento annunci simili...</div>';
    const matches = await fetchSimilarAnnouncements(data._id, 6);
    renderSimilarAnnouncements(matches);
  }

  /**
   * Renders similar announcements into the current page.
   * @param {Array<Object>} matches - Smart-match results containing announcement and score data.
   * @returns {void}
   */
  function renderSimilarAnnouncements(matches) {
    const grid = document.getElementById('view-similar-grid');
    grid.innerHTML = '';

    if (!matches || matches.length === 0) {
      grid.innerHTML = '<div class="comments-empty">Nessun annuncio simile trovato.</div>';
      return;
    }

    matches.forEach((match) => {
      const ann = match.announcement;
      if (!ann) return;

      const animal = ann.animalId || {};
      const isLost = ann.type === 'LostAnimal';
      const card = document.createElement('article');
      card.className = 'card';
      card.dataset.id = ann._id;
      const score = typeof match.score === 'number' ? `${(match.score * 100).toFixed(1)}%` : '';

      card.innerHTML = `
        <div class="card-image">
          <div class="card-image-placeholder"><span>...</span></div>
          <span class="badge badge--${isLost ? 'lost' : 'sighting'}">
            ${isLost ? 'Smarrito' : 'Avvistato'}
          </span>
          ${score ? `<span class="badge badge--score">${escapeHtml(score)}</span>` : ''}
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-species">${escapeHtml(animal?.species || 'Specie')}</span>
            <span class="card-date">${new Date(ann.date).toLocaleDateString('it-IT')}</span>
          </div>
          <h3 class="card-breed">${escapeHtml(animal?.name || animal?.breed || animal?.species || 'Animale')}</h3>
          <p class="card-description">${escapeHtml(ann.description || '')}</p>
        </div>
      `;

      card.addEventListener('click', () => openAnnouncementModal(ann._id));

      (async () => {
        const container = card.querySelector('.card-image');
        try {
          const res = await fetch(`/api/v1/announcements/${ann._id}/photo`, { method: 'GET' });
          if (!res.ok) throw new Error('no image');
          const ct = res.headers.get('content-type') || '';
          if (!ct.startsWith('image')) throw new Error('not image');
          const blob = await res.blob();
          const img = document.createElement('img');
          img.src = URL.createObjectURL(blob);
          img.alt = animal?.species || 'Animale';
          img.loading = 'lazy';
          img.onload = () => { URL.revokeObjectURL(img.src); };
          const placeholder = container.querySelector('.card-image-placeholder');
          if (placeholder) placeholder.replaceWith(img);
        } catch (err) {
          const placeholder = container.querySelector('.card-image-placeholder');
          if (placeholder) placeholder.innerHTML = `<span>${escapeHtml(animal?.species?.[0] || '?')}</span>`;
        }
      })();

      grid.appendChild(card);
    });
  }

  /**
   * Binds shelter profile controls, animal forms, and shelter announcement actions.
   * @returns {void}
   */
  function bindShelterEvents() {
  document.getElementById('editRifugioPosition')?.addEventListener('click', openRifugioPositionEditor);
  document.getElementById('saveRifugioPosition')?.addEventListener('click', saveRifugioPosition);
  document.getElementById('searchRifugioPosition')?.addEventListener('click', searchRifugioPosition);
  document.getElementById('useRifugioLocation')?.addEventListener('click', useRifugioCurrentLocation);
  document.getElementById('addAnimalBtn')?.addEventListener('click', () => {
    openAnimalCreateModal();
  });

  document.getElementById('animal-create-close')?.addEventListener('click', closeAnimalCreateModal);
  document.getElementById('animal-create-cancel')?.addEventListener('click', closeAnimalCreateModal);
  document.getElementById('animal-create-overlay')?.addEventListener('click', (e) => {
    if (e.target?.id === 'animal-create-overlay') closeAnimalCreateModal();
  });
  document.getElementById('animal-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('animal-create-status');
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const photoFile = document.getElementById('animal-create-photo')?.files?.[0] || null;
    const payload = {
      name: document.getElementById('animal-create-name').value.trim() || undefined,
      species: document.getElementById('animal-create-species').value.trim(),
      breed: document.getElementById('animal-create-breed').value.trim(),
      gender: document.getElementById('animal-create-gender').value,
      color: document.getElementById('animal-create-color').value.trim(),
      age: document.getElementById('animal-create-age').value.trim() || undefined,
      lunghezzaPelo: document.getElementById('animal-create-lunghezzaPelo').value || undefined,
      distinctiveFeatures: document.getElementById('animal-create-distinctiveFeatures').value.trim() || undefined,
      microchipId: document.getElementById('animal-create-microchipId').value.trim() || undefined,
      adoptable: currentUser?.role === 'shelter' ? !!document.getElementById('animal-create-adoptable').checked : false
    };

    if (status) status.textContent = 'Salvataggio...';

    try {
      const body = photoFile ? new FormData() : JSON.stringify(payload);
      if (photoFile) {
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') body.append(key, value);
        });
        body.append('photo', photoFile);
      }

      const requestInit = photoFile
        ? { method: 'POST', headers: { Authorization: authHeader.Authorization }, body }
        : { method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' }, body };

      const res = await fetch('/api/v1/animals', requestInit);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.userMessage || data.message || 'Errore creazione animale');
      }
      closeAnimalCreateModal();
      await loadMyAnimals();
    } catch (err) {
      if (status) status.textContent = err.message || 'Errore creazione animale';
    }
  });
  }

  bindShelterEvents();

  return {
    renderRifugioStatus,
    renderRifugioPosition,
    setRifugioPositionEditingState,
    openRifugioPositionEditor,
    loadMyAnnouncements,
    loadMyAnimals
  };
}
