const HOME_API = 'http://localhost:3000/api/v1/announcements';
const HOME_MAX_CARDS = 6;
const HOME_EMPTY_VALUE = '- -';
const HOME_RESOLVED_API = 'http://localhost:3000/api/v1/announcements/count?status=resolved';
const HOME_PUBLIC_RIFUGI_API = 'http://localhost:3000/api/v1/users/rifugi?isPublic=true';

/**
 * Formats a value for the home-page announcement UI.
 * @param {*} value - Announcement field value to display.
 * @returns {string} Trimmed display text or the home empty-value placeholder.
 */
function homeDisplayValue(value) {
  if (value === null || value === undefined) return HOME_EMPTY_VALUE;
  const text = String(value).trim();
  return text ? text : HOME_EMPTY_VALUE;
}

/**
 * Escapes HTML-sensitive characters before inserting text into home markup.
 * @param {*} input - Value that will be interpolated into HTML.
 * @returns {string} HTML-safe string representation of the value.
 */
function homeEscapeHtml(input) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Fetches home announcements data from the API.
 * @returns {Promise<Array<Object>>} Announcement list for the home page, or an empty array on failure.
 */
async function fetchHomeAnnouncements() {
  try {
    const res = await fetch(HOME_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? json : json.data || [];
  } catch (err) {
    console.error('Errore fetch annunci home', err);
    return [];
  }
}

/**
 * Fetches home announcement by id data from the API.
 * @param {string} id - Announcement identifier to load.
 * @returns {Promise<Object|null>} Announcement detail payload, or null when loading fails.
 */
async function fetchHomeAnnouncementById(id) {
  try {
    const res = await fetch(`${HOME_API}/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

/**
 * Fetches public rifugi count data from the API.
 * @returns {Promise<number>} Number of public shelters returned by the API, or 0 on failure.
 */
async function fetchPublicRifugiCount() {
  try {
    const res = await fetch(HOME_PUBLIC_RIFUGI_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? json.length : 0;
  } catch (err) {
    console.error('Errore fetch rifugi pubblici', err);
    return 0;
  }
}

/**
 * Fetches resolved announcements count data from the API.
 * @returns {Promise<number>} Total resolved-announcement count, or 0 on failure.
 */
async function fetchResolvedAnnouncementsCount() {
  try {
    const res = await fetch(HOME_RESOLVED_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Number(json?.count ?? json?.resolvedCount ?? 0);
  } catch (err) {
    console.error('Errore fetch annunci risolti', err);
    return 0;
  }
}

/**
 * Returns home announcement date.
 * @param {Object} announcement - Announcement record that may contain date fields.
 * @returns {Date|null} Parsed announcement date, or null when no valid date exists.
 */
function getHomeAnnouncementDate(announcement) {
  const rawDate = announcement?.createdAt || announcement?.date || announcement?.updatedAt;
  if (!rawDate) return null;
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Checks whether same day.
 * @param {Date|null} left - First date to compare.
 * @param {Date|null} right - Second date to compare.
 * @returns {boolean} True when both dates fall on the same calendar day.
 */
function isSameDay(left, right) {
  if (!left || !right) return false;
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

/**
 * Checks whether within last24 hours.
 * @param {Date|null} date - Date to compare with the current time.
 * @returns {boolean} True when the date is within the last 24 hours.
 */
function isWithinLast24Hours(date) {
  if (!date) return false;
  return Date.now() - date.getTime() <= 24 * 60 * 60 * 1000;
}

/**
 * Posts a new comment for an announcement shown on the home page.
 * @param {string} id - Announcement identifier receiving the comment.
 * @param {string} text - Comment text submitted by the user.
 * @returns {Promise<Object>} API response containing the new comment and updated comment list.
 * @throws {Error} When the user is not logged in or the API rejects the comment.
 */
async function postHomeAnnouncementComment(id, text) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('not logged in');

  const res = await fetch(`${HOME_API}/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ text })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || 'Errore invio commento');
  }
  return json;
}

/**
 * Fetches home public user data from the API.
 * @param {string} userId - User identifier whose public contact data should be loaded.
 * @returns {Promise<Object>} Public user payload containing visible contact fields.
 * @throws {Error} When the user is not logged in or the API rejects the request.
 */
async function fetchHomePublicUser(userId) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('not logged in');

  const res = await fetch(`http://localhost:3000/api/v1/users/${encodeURIComponent(userId)}/public`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || 'Errore caricamento contatti');
  return json;
}

/**
 * Builds a home-page announcement card and wires detail-opening interactions.
 * @param {Object} ann - Announcement record to render.
 * @returns {HTMLElement} Interactive card element for the home announcement grid.
 */
function buildHomeCard(ann) {
  const animal = ann.animalId;
  const isLost = ann.type === 'LostAnimal';
  const photoUrl = `http://localhost:3000/api/v1/announcements/${ann._id}/photo`;
  const date = new Date(ann.date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = ann._id;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Vedi dettagli annuncio ${animal?.species || 'animale'}`);

  /**
   * Opens the details UI.
   * @returns {void}
   */
  const openDetails = () => openHomeModal(ann);

  card.addEventListener('click', openDetails);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDetails();
    }
  });

  const description = ann.description || '';
  card.innerHTML = `
    <div class="card-image">
      <div class="card-image-placeholder"><span>…</span></div>
      <span class="badge badge--${isLost ? 'lost' : 'sighting'}">
        ${isLost ? 'Smarrito' : 'Avvistato'}
      </span>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-species">${animal?.species || 'Specie sconosciuta'}</span>
        <span class="card-date">${date}</span>
      </div>
      <h3 class="card-breed">${animal?.breed || '—'}</h3>
      <p class="card-description">${description}</p>
    </div>
  `;

  (async () => {
    const container = card.querySelector('.card-image');
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
      const placeholder = container.querySelector('.card-image-placeholder');
      if (placeholder) placeholder.replaceWith(img);
    } catch (err) {
      const placeholder = container.querySelector('.card-image-placeholder');
      if (placeholder) placeholder.innerHTML = `<span>${animal?.species?.[0] || '?'}</span>`;
    }
  })();

  return card;
}

/**
 * Opens the home modal UI.
 * @param {Object} ann - Announcement summary used to seed the modal while details load.
 * @returns {Promise<void>} Promise resolving after the modal is populated and shown.
 */
async function openHomeModal(ann) {
  const isLoggedIn = !!localStorage.getItem('token');
  const full = await fetchHomeAnnouncementById(ann._id);
  const data = full || ann;
  const animal = data.animalId;
  const publisher = data.publisherId;
  const isLost = data.type === 'LostAnimal';
  const comments = Array.isArray(data.comments) ? data.comments : [];
  const coords = data.location?.coordinates;

  const date = new Date(data.date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const locationInfo = coords?.length === 2
    ? `<dt>Posizione</dt><dd><a class="position-link" href="/pages/map.html?highlight=${encodeURIComponent(data._id)}"><em>trovami</em></a></dd>`
    : '';

  document.getElementById('modal-title').textContent =
    isLost ? `${animal?.species} smarrito/a` : `Avvistamento: ${animal?.species}`;

  const gallery = document.getElementById('modal-gallery');
  gallery.innerHTML = '<div class="modal-spinner">...</div>';
  loadHomeModalPhoto(gallery, data._id);

  const commentBoxHtml = isLoggedIn
    ? `
      <form class="comment-form" data-announcement-id="${homeEscapeHtml(data._id)}">
        <label class="comment-label" for="home-comment-text">Commento</label>
        <textarea id="home-comment-text" class="comment-textarea" rows="3" maxlength="500" placeholder="Scrivi un aggiornamento (es. direzione)..."></textarea>
        <div class="comment-actions">
          <span class="comment-hint">Max 500 caratteri</span>
          <button type="submit" class="comment-submit">Invia</button>
        </div>
        <div class="comment-error" role="status" aria-live="polite"></div>
      </form>
    `
    : `<div class="comments-locked">Accedi per commentare</div>`;

  document.getElementById('modal-body').innerHTML = `
    <dl class="detail-list">
      <dt>Specie</dt><dd>${homeDisplayValue(animal?.species)}</dd>
      <dt>Razza</dt><dd>${homeDisplayValue(animal?.breed)}</dd>
      <dt>Colore</dt><dd>${homeDisplayValue(animal?.color)}</dd>
      <dt>Sesso</dt><dd>${homeDisplayValue(animal?.gender)}</dd>
      <dt>Lunghezza pelo</dt><dd>${homeDisplayValue(animal?.lunghezzaPelo)}</dd>
      <dt>Segni particolari</dt><dd>${homeDisplayValue(animal?.distinctiveFeatures)}</dd>
      <dt>Microchip</dt><dd>${homeDisplayValue(animal?.microchipId)}</dd>
      ${locationInfo}
      <dt>Data</dt><dd>${date}</dd>
      <dt>Condizioni</dt><dd>${homeDisplayValue(data.healthCondition)}</dd>
      <dt>Comportamento</dt><dd>${homeDisplayValue(data.animalBehaviour)}</dd>
    </dl>
    <p class="modal-description">${homeEscapeHtml(data.description)}</p>

    <section class="comments-section" aria-label="Commenti">
      <div class="comments-header">
        <h3>Commenti</h3>
        <span class="comments-count">${comments.length}</span>
      </div>
      ${commentBoxHtml}
      <div id="comments-list" class="comments-list">
        ${renderHomeCommentsHtml(comments)}
      </div>
    </section>

    <div class="modal-contact">
      ${isLoggedIn
        ? `<strong>Contatto:</strong>
           <span>${homeEscapeHtml(publisher?.username || '-')}</span>
           ${publisher?.phoneNumber ? `<a href="tel:${homeEscapeHtml(publisher.phoneNumber)}">${homeEscapeHtml(publisher.phoneNumber)}</a>` : ''}
           ${publisher?.email ? `<a href="mailto:${homeEscapeHtml(publisher.email)}">${homeEscapeHtml(publisher.email)}</a>` : ''}`
        : `<span class="contact-locked">Accedi per vedere i contatti</span>`
      }
    </div>
  `;

  bindHomeCommentForm(data._id);
  bindHomeCommentContacts();

  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Loads home modal photo data and updates the UI.
 * @param {HTMLElement} gallery - Modal gallery element that receives the image or empty state.
 * @param {string} id - Announcement identifier whose photo should be loaded.
 * @returns {Promise<void>} Promise resolving after the gallery is updated.
 */
async function loadHomeModalPhoto(gallery, id) {
  try {
    const res = await fetch(`${HOME_API}/${encodeURIComponent(id)}/photo`, { method: 'GET' });
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
    gallery.innerHTML = '<div class="modal-no-photo">Non e presente alcuna foto</div>';
  }
}

/**
 * Renders home comments html into the current page.
 * @param {Array<Object>} comments - Comment records attached to the announcement.
 * @returns {string} HTML markup for the comments list or empty state.
 */
function renderHomeCommentsHtml(comments) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return `<div class="comments-empty">Nessun commento</div>`;
  }

  const sorted = [...comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return sorted.map((c) => {
    const when = c?.createdAt
      ? new Date(c.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const uid = (c?.userId && typeof c.userId === 'object') ? (c.userId._id || c.userId.id) : c?.userId;
    const slotId = `home-comment-contact-${homeEscapeHtml(c?._id || uid || Math.random().toString(16).slice(2))}`;
    return `
      <div class="comment-item">
        <div class="comment-meta">
          <button type="button" class="comment-user-link comment-user" data-user-id="${homeEscapeHtml(uid || '')}" data-slot-id="${slotId}">${homeEscapeHtml(c?.username || 'utente')}</button>
          <span class="comment-date">${homeEscapeHtml(when)}</span>
        </div>
        <div class="comment-text">${homeEscapeHtml(c?.text || '')}</div>
        <div id="${slotId}" class="comment-contact-slot" style="display:none;"></div>
      </div>
    `;
  }).join('');
}

/**
 * Binds the comment form inside the currently open home announcement modal.
 * @param {string} announcementId - Announcement identifier used when submitting the comment.
 * @returns {void}
 */
function bindHomeCommentForm(announcementId) {
  const form = document.querySelector('#modal-body .comment-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const textarea = form.querySelector('.comment-textarea');
    const errorBox = form.querySelector('.comment-error');
    const list = document.getElementById('comments-list');
    const count = document.querySelector('#modal-body .comments-count');
    const submit = form.querySelector('.comment-submit');
    const text = (textarea?.value ?? '').trim();

    if (!text) {
      errorBox.textContent = 'Scrivi testo';
      return;
    }

    errorBox.textContent = '';
    submit.disabled = true;

    try {
      const result = await postHomeAnnouncementComment(announcementId, text);
      const updated = Array.isArray(result.comments) ? result.comments : [];
      textarea.value = '';
      if (list) list.innerHTML = renderHomeCommentsHtml(updated);
      if (count) count.textContent = String(updated.length);
    } catch (err) {
      errorBox.textContent = err.message || 'Errore invio commento';
    } finally {
      submit.disabled = false;
    }
  });
}

/**
 * Binds click handlers that reveal public contact data for comment authors.
 * @returns {void}
 */
function bindHomeCommentContacts() {
  const modalBody = document.getElementById('modal-body');
  if (!modalBody || modalBody.dataset.homeCommentContactsBound === 'true') return;

  modalBody.dataset.homeCommentContactsBound = 'true';
  modalBody.addEventListener('click', async (event) => {
    const btn = event.target?.closest?.('.comment-user-link');
    if (!btn) return;
    const userId = btn.getAttribute('data-user-id');
    const slot = document.getElementById(btn.getAttribute('data-slot-id'));
    if (!userId || !slot) return;

    if (slot.dataset.loaded === 'true') {
      slot.dataset.loaded = 'false';
      slot.innerHTML = '';
      slot.style.display = 'none';
      return;
    }

    slot.dataset.loaded = 'true';
    slot.style.display = 'block';
    slot.innerHTML = '<div class="comment-text">Caricamento...</div>';

    try {
      const user = await fetchHomePublicUser(userId);
      const parts = [];
      if (user.phoneNumber) parts.push(`<a href="tel:${homeEscapeHtml(user.phoneNumber)}">${homeEscapeHtml(user.phoneNumber)}</a>`);
      if (user.email) parts.push(`<a href="mailto:${homeEscapeHtml(user.email)}">${homeEscapeHtml(user.email)}</a>`);
      slot.innerHTML = `
        <div class="modal-contact" style="margin-top:8px;">
          <strong>Contatto:</strong>
          <span>${homeEscapeHtml(user.username || '-')}</span>
          ${parts.join('')}
          ${parts.length === 0 ? '<span class="contact-locked">Nessun contatto pubblico</span>' : ''}
        </div>
      `;
    } catch (err) {
      slot.innerHTML = `<div class="comment-error">${homeEscapeHtml(err.message || 'Errore')}</div>`;
    }
  });
}

/**
 * Closes the home modal UI.
 * @returns {void}
 */
function closeHomeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * Renders hero stats into the current page.
 * @returns {Promise<void>} Promise resolving after hero counters are refreshed.
 */
async function renderHeroStats() {
  const resolvedCounter = document.getElementById('resolved-announcements-count');
  const activeCounter = document.getElementById('active-announcements-count');
  const rifugiCounter = document.getElementById('public-rifugi-count');
  if (!resolvedCounter && !activeCounter && !rifugiCounter) return;

  const [announcements, rifugiCount] = await Promise.all([
    fetchHomeAnnouncements(),
    fetchPublicRifugiCount()
  ]);

  const activeCount = Array.isArray(announcements)
    ? announcements.filter((announcement) => announcement?.status === 'ACTIVE').length
    : 0;
  const resolvedCount = await fetchResolvedAnnouncementsCount();

  if (resolvedCounter) resolvedCounter.textContent = String(resolvedCount);
  if (activeCounter) activeCounter.textContent = String(activeCount);
  if (rifugiCounter) rifugiCounter.textContent = String(rifugiCount);
}

/**
 * Renders home stats strip into the current page.
 * @returns {Promise<void>} Promise resolving after the home stats strip is refreshed.
 */
async function renderHomeStatsStrip() {
  const last24hCounter = document.getElementById('home-last-24h-count');
  const createdTodayCounter = document.getElementById('home-created-today-count');
  const resolvedTotalCounter = document.getElementById('home-resolved-total-count');
  const resolvedTotalInline = document.getElementById('home-resolved-total-inline');
  if (!last24hCounter && !createdTodayCounter && !resolvedTotalCounter && !resolvedTotalInline) return;

  const [announcements, resolvedTotalCount] = await Promise.all([
    fetchHomeAnnouncements(),
    fetchResolvedAnnouncementsCount()
  ]);
  const now = new Date();

  const last24hCount = Array.isArray(announcements)
    ? announcements.filter((announcement) => isWithinLast24Hours(getHomeAnnouncementDate(announcement))).length
    : 0;

  const createdTodayCount = Array.isArray(announcements)
    ? announcements.filter((announcement) => isSameDay(getHomeAnnouncementDate(announcement), now)).length
    : 0;

  if (last24hCounter) last24hCounter.textContent = String(last24hCount);
  if (createdTodayCounter) createdTodayCounter.textContent = String(createdTodayCount);
  if (resolvedTotalCounter) resolvedTotalCounter.textContent = String(resolvedTotalCount);
  if (resolvedTotalInline) resolvedTotalInline.textContent = String(resolvedTotalCount);
}

/**
 * Loads the home announcement grid and binds modal controls.
 * @returns {Promise<void>} Promise resolving after initial home announcements are rendered.
 */
async function initHomeAnnouncements() {
  const grid = document.getElementById('home-announcements-grid');
  const empty = document.getElementById('home-empty');
  if (!grid || !empty) return;

  document.getElementById('modal-overlay')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeHomeModal();
  });
  document.getElementById('modal-close')?.addEventListener('click', closeHomeModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeHomeModal();
  });

  const announcements = await fetchHomeAnnouncements();
  const trimmed = announcements.slice(0, HOME_MAX_CARDS);

  if (trimmed.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  trimmed.forEach((ann) => grid.appendChild(buildHomeCard(ann)));
}

/**
 * Initializes home page data and recurring stats refresh after the DOM is ready.
 * @returns {Promise<void>} Promise resolving when the initial home widgets are loaded.
 */
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([initHomeAnnouncements(), renderHeroStats(), renderHomeStatsStrip()]);
  window.addEventListener('announcements:resolved-updated', renderHeroStats);
  setInterval(renderHeroStats, 30000);
});
