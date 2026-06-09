const API_BASE = '/api/v1/announcements';
const ADMIN_BASE = '/api/v1/admin';

/**
 * Shows an error message in the page error area.
 * @param {string} message - Error text displayed in the page banner.
 * @returns {void}
 */
function showError(message) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.textContent = message;
  banner.style.display = 'block';
}


/**
 * Sends an admin warning for the selected announcement publisher.
 * @param {string} userId - User identifier to warn.
 * @returns {Promise<void>} Promise resolving after the warning API call succeeds.
 * @throws {Error} When the admin API rejects the warning.
 */
async function warnUser(userId) {
  const reason = await showSitePrompt('Motivo avvertimento:', {
    title: 'Avverti utente',
    defaultValue: 'Ammonimento da moderazione account',
    confirmLabel: 'Invia'
  });
  if (reason === null) return;
  const warnReason = reason.trim() || 'Ammonimento da moderazione account';
  const res = await fetch(`${ADMIN_BASE}/users/${encodeURIComponent(userId)}/warnings`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({ reason: warnReason })
  });
  if (!res.ok) throw new Error(await readResponseError(res, 'Errore avvertimento'));
  await showSiteAlert('Avvertimento inviato', { title: 'Operazione completata', tone: 'success' });
}

/**
 * Blocks an account from the user announcements moderation page.
 * @param {string} userId - User identifier to block.
 * @returns {Promise<void>} Promise resolving after the account is blocked and the list reloads.
 * @throws {Error} When the admin API rejects the block request.
 */
async function blockUser(userId) {
  const reason = await showSitePrompt('Motivo blocco account:', {
    title: 'Blocca account',
    defaultValue: 'Violazione delle regole della community',
    confirmLabel: 'Blocca'
  });
  if (reason === null) return;
  const blockReason = reason.trim() || 'Account bloccato da admin';
  const res = await fetch(`${ADMIN_BASE}/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: authJsonHeaders(),
    body: JSON.stringify({ status: 'blocked', reason: blockReason })
  });
  if (!res.ok) throw new Error(await readResponseError(res, 'Errore blocco'));
  await showSiteAlert('Account bloccato', { title: 'Operazione completata', tone: 'success' });
  await loadUserAnnouncements();
}

/**
 * Renders announcement comments as HTML markup.
 * @param {Array<Object>} comments - Comment records attached to the announcement.
 * @returns {string} HTML markup for the comment list or empty state.
 */
function renderCommentsHtml(comments) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return '<div class="comments-empty">Nessun commento</div>';
  }

  return [...comments]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((comment) => {
      const when = comment?.createdAt ? new Date(comment.createdAt).toLocaleString('it-IT') : '';
      return `
        <div class="comment-item">
          <div class="comment-meta">
            <span class="comment-user">${escapeHtml(comment?.username || 'utente')}</span>
            <span class="comment-date">${escapeHtml(when)}</span>
          </div>
          <div class="comment-text">${escapeHtml(comment?.text || '')}</div>
        </div>
      `;
    })
    .join('');
}

/**
 * Closes the current modal and restores page scrolling.
 * @returns {void}
 */
function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * Opens and populates the announcement detail modal.
 * @param {Object} ann - Announcement summary used to open the modal.
 * @returns {Promise<void>} Promise resolving after the modal is populated and shown.
 */
async function openModal(ann) {
  let data = ann;
  try {
    data = await fetchAnnouncementById(ann._id, { throwOnError: true });
  } catch (err) {
    showError(err.message || 'Errore caricamento annuncio');
  }

  const animal = data.animalId || {};
  const publisher = data.publisherId || {};
  const isLost = data.type === 'LostAnimal';
  const isRifugioAnnouncement = publisher?.role === 'shelter';
  const comments = Array.isArray(data.comments) ? data.comments : [];
  const coords = data.location?.coordinates;
  const date = data.date
    ? new Date(data.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
  const locationInfo = coords?.length === 2
    ? `<dt>Posizione</dt><dd><a class="position-link" href="map.html?highlight=${encodeURIComponent(data._id)}"><em>trovami</em></a></dd>`
    : '';
  const rifugioAddress = [publisher?.rifugioData?.address, publisher?.rifugioData?.city].filter(Boolean).join(', ');
  const rifugioCoords = publisher?.rifugioData?.location?.coordinates;
  const rifugioLocationHtml = publisher?.role === 'shelter'
    ? `
        ${rifugioAddress ? `<span>${escapeHtml(rifugioAddress)}</span>` : ''}
        ${Array.isArray(rifugioCoords) && rifugioCoords.length === 2 ? `<a href="map.html?rifugioId=${encodeURIComponent(publisher._id)}">Vedi posizione rifugio</a>` : ''}
      `
    : '';

  document.getElementById('modal-title').textContent =
    animal?.name || (isRifugioAnnouncement ? 'Animale in rifugio' : (isLost ? `${animal?.species} smarrito/a` : `Avvistamento: ${animal?.species}`));

  const gallery = document.getElementById('modal-gallery');
  gallery.innerHTML = '<div class="modal-spinner">...</div>';
  (async () => {
    await loadImageIntoGallery({
      gallery,
      url: `${API_BASE}/${encodeURIComponent(data._id)}/photo`,
      loading: null
    });
  })();

  document.getElementById('modal-body').innerHTML = `
    ${renderAnimalDetailsListHtml(animal, data, {
      date,
      extraLocationHtml: locationInfo,
      includeStatus: true
    })}
    <p class="modal-description">${escapeHtml(data.description || '')}</p>

    <section class="comments-section" aria-label="Commenti">
      <div class="comments-header">
        <h3>Commenti</h3>
        <span class="comments-count">${comments.length}</span>
      </div>
      <div id="comments-list" class="comments-list">
        ${renderCommentsHtml(comments)}
      </div>
    </section>

    <div class="modal-contact">
      <strong>Contatto:</strong>
      <span>${escapeHtml(publisher?.rifugioData?.rifugioName || publisher?.username || '-')}</span>
      ${publisher?.phoneNumber ? `<a href="tel:${publisher.phoneNumber}">${escapeHtml(publisher.phoneNumber)}</a>` : ''}
      ${publisher?.email ? `<a href="mailto:${publisher.email}">${escapeHtml(publisher.email)}</a>` : ''}
      ${rifugioLocationHtml}
    </div>
  `;

  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Builds a DOM card for an announcement and binds its interactions.
 * @param {Object} ann - Announcement record to render in the grid.
 * @returns {HTMLElement} Interactive announcement card element.
 */
function buildCard(ann) {
  const animal = ann.animalId || {};
  const publisher = ann.publisherId || {};
  const isLost = ann.type === 'LostAnimal';
  const isRifugioAnnouncement = publisher?.role === 'shelter';
  const date = ann.date ? new Date(ann.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-image">
      <div class="card-image-placeholder"><span>...</span></div>
      <span class="badge badge--${isRifugioAnnouncement ? 'rifugio' : (isLost ? 'lost' : 'sighting')}">
        ${isRifugioAnnouncement ? 'Animale in rifugio' : (isLost ? 'Smarrito' : 'Avvistato')}
      </span>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-species">${escapeHtml(animal.species || 'Specie sconosciuta')}</span>
        <span class="card-date">${escapeHtml(date)}</span>
      </div>
      <h3 class="card-breed">${escapeHtml(animal.name || animal.breed || animal.species || 'Animale')}</h3>
      <p class="card-description">${escapeHtml(ann.description || '')}</p>
      <div class="card-details">
        <span class="card-detail-label">Razza</span><span>${displayValue(animal.breed)}</span>
        <span class="card-detail-label">Colore</span><span>${displayValue(animal.color)}</span>
        <span class="card-detail-label">Stato</span><span>${displayValue(ann.status)}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openModal(ann));

  const photoUrl = `${API_BASE}/${encodeURIComponent(ann._id)}/photo`;
  (async () => {
    const container = card.querySelector('.card-image');
    await loadImageIntoPlaceholder({
      container,
      url: photoUrl,
      alt: animal.species || 'Animale',
      fallbackText: (animal.species || '?')[0]
    });
  })();

  return card;
}

/**
 * Loads user announcements data and updates the UI.
 * @returns {Promise<void>} Promise resolving after the user's announcement grid is updated.
 */
async function loadUserAnnouncements() {
  const userId = getQueryParam('userId');
  const user = getQueryParam('user');
  setupAdminActions(userId);
  if (user) {
    document.getElementById('user-announcements-title').textContent = `Annunci di: ${user}`;
  }
  if (!userId) {
    showError('Utente non specificato.');
    return;
  }

  const res = await fetch(`${API_BASE}?userId=${encodeURIComponent(userId)}&status=all`);
  const payload = await res.json().catch(() => []);
  const data = Array.isArray(payload) ? payload : payload.data || [];
  if (!res.ok || !Array.isArray(data)) {
    showError('Impossibile caricare gli annunci utente.');
    return;
  }

  const grid = document.getElementById('announcements-grid');
  const empty = document.getElementById('empty-state');
  grid.innerHTML = '';
  if (data.length === 0) {
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  data.forEach((ann) => grid.appendChild(buildCard(ann)));
}

/**
 * Sets up admin actions.
 * @param {string} userId - User identifier targeted by warn and block controls.
 * @returns {void}
 */
function setupAdminActions(userId) {
  const warnButton = document.getElementById('warn-user');
  const blockButton = document.getElementById('block-user');
  if (!userId) {
    warnButton?.setAttribute('disabled', 'disabled');
    blockButton?.setAttribute('disabled', 'disabled');
    return;
  }

  warnButton?.addEventListener('click', async () => {
    try {
      await warnUser(userId);
    } catch (err) {
      showSiteAlert(err.message || 'Errore avvertimento');
    }
  });

  blockButton?.addEventListener('click', async () => {
    try {
      await blockUser(userId);
    } catch (err) {
      showSiteAlert(err.message || 'Errore blocco');
    }
  });
}

document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', (event) => {
  if (event.target?.id === 'modal-overlay') closeModal();
});

loadUserAnnouncements();
