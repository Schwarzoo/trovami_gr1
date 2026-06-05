let notificationBadgeTimer = null;
const ANNOUNCEMENTS_API = '/api/v1/announcements';

/**
 * Escapes HTML-sensitive characters before inserting text into markup.
 * @param {*} input - Value to escape.
 * @returns {string} HTML-safe string representation of the input.
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
 * Formats a value for UI display, replacing null, undefined, or blank text with a placeholder.
 * @param {*} value - Value to format for UI display.
 * @param {string} [fallback='- -'] - Text shown when the value is empty.
 * @returns {string} Trimmed display text or the fallback placeholder.
 */
function displayValue(value, fallback = '- -') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

/**
 * Formats a numeric value for Italian UI display.
 * @param {*} value - Numeric value or numeric string to format.
 * @returns {string} Localized number string, or `0` for invalid values.
 */
function formatNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('it-IT') : '0';
}

/**
 * Returns the best available shelter display name.
 * @param {Object} rifugio - Shelter user object from the public shelters API.
 * @returns {string} Shelter display name.
 */
function getRifugioName(rifugio) {
  return rifugio?.rifugioData?.rifugioName || rifugio?.username || 'Rifugio';
}

/**
 * Returns shelter GeoJSON coordinates when available.
 * @param {Object} rifugio - Shelter user object containing location data.
 * @returns {number[]|null} `[longitude, latitude]` coordinates, or null when unavailable.
 */
function getCoordinates(rifugio) {
  const coords = rifugio?.rifugioData?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lng, lat] = coords.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

/**
 * Fetches JSON from an API endpoint and throws on HTTP failures.
 * @param {string} url - API endpoint to request.
 * @returns {Promise<Object|Array<Object>>} Parsed JSON response.
 * @throws {Error} When the API response is not successful.
 */
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.userMessage || json?.message || `HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Fetches JSON from an authenticated API endpoint and throws on HTTP failures.
 * @param {string} url - Authenticated API endpoint to request.
 * @param {Object} options - Fetch options merged with the bearer authorization header.
 * @returns {Promise<Object|Array<Object>>} Parsed JSON response.
 * @throws {Error} When the API response is not successful.
 */
async function fetchAuthJson(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.userMessage || json?.message || `HTTP ${res.status}`);
  return json;
}

/**
 * Builds authorization headers for JSON API requests.
 * @returns {{'Content-Type': string, Authorization: string}} JSON request headers with the stored bearer token.
 */
function authJsonHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || ''}`
  };
}

/**
 * Reads an API error message, falling back to a status-aware default.
 * @param {Response} res - Failed fetch response.
 * @param {string} fallback - Message prefix used when the response body has no message.
 * @returns {Promise<string>} Error message suitable for display.
 */
async function readResponseError(res, fallback) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json().catch(() => ({}));
    if (json?.userMessage || json?.message) return json.userMessage || json.message;
  }
  return `${fallback} (${res.status})`;
}

/**
 * Fetches an image resource, verifies its content type, and returns an object URL.
 * @param {string} url - Image endpoint or absolute image URL.
 * @param {Object} [fetchOptions={}] - Fetch options for the image request.
 * @returns {Promise<string>} Browser object URL for the fetched image blob.
 * @throws {Error} When the response is not an image.
 */
async function fetchImageObjectUrl(url, fetchOptions = {}) {
  const res = await fetch(url, { method: 'GET', ...fetchOptions });
  if (!res.ok) throw new Error('no image');

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image')) throw new Error('not image');

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Creates an image element backed by an object URL and revokes the URL after load.
 * @param {string} objectUrl - Object URL returned by `fetchImageObjectUrl`.
 * @param {Object} [options={}] - Image rendering options.
 * @param {string} [options.alt=''] - Image alt text.
 * @param {string} [options.className=''] - Optional image class.
 * @param {string|null} [options.loading='lazy'] - Optional loading attribute.
 * @param {Object} [options.style] - Inline styles to apply.
 * @returns {HTMLImageElement} Configured image element.
 */
function createObjectUrlImage(objectUrl, options = {}) {
  const {
    alt = '',
    className = '',
    loading = 'lazy',
    style = null
  } = options;
  const img = document.createElement('img');
  img.src = objectUrl;
  img.alt = alt;
  if (className) img.className = className;
  if (loading) img.loading = loading;
  if (style && typeof style === 'object') Object.assign(img.style, style);
  img.onload = () => { URL.revokeObjectURL(img.src); };
  return img;
}

/**
 * Sets a placeholder fallback using escaped text wrapped in a span.
 * @param {HTMLElement|null} placeholder - Placeholder element to update.
 * @param {string} fallbackText - Text or initial to show.
 * @returns {void}
 */
function setImagePlaceholderFallback(placeholder, fallbackText) {
  if (placeholder) placeholder.innerHTML = `<span>${escapeHtml(fallbackText || '?')}</span>`;
}

/**
 * Loads an image into a card/placeholder slot, falling back to an initial or text.
 * @param {Object} options - Placeholder image options.
 * @param {HTMLElement} options.container - Parent element containing the placeholder.
 * @param {string} options.url - Image URL to fetch.
 * @param {string} [options.placeholderSelector='.card-image-placeholder'] - Placeholder selector.
 * @param {string} [options.alt='Animale'] - Image alt text.
 * @param {string} [options.fallbackText='?'] - Fallback text or initial.
 * @param {string} [options.className=''] - Optional image class.
 * @param {string|null} [options.loading='lazy'] - Optional image loading mode.
 * @param {Object} [options.style] - Inline styles for the image.
 * @param {Object} [options.fetchOptions] - Fetch options for the image request.
 * @returns {Promise<HTMLImageElement|null>} Inserted image, or null on fallback.
 */
async function loadImageIntoPlaceholder(options) {
  const {
    container,
    url,
    placeholderSelector = '.card-image-placeholder',
    alt = 'Animale',
    fallbackText = '?',
    className = '',
    loading = 'lazy',
    style = null,
    fetchOptions = {}
  } = options;
  const placeholder = container?.querySelector(placeholderSelector);
  if (!placeholder || !url) {
    setImagePlaceholderFallback(placeholder, fallbackText);
    return null;
  }

  try {
    const objectUrl = await fetchImageObjectUrl(url, fetchOptions);
    const img = createObjectUrlImage(objectUrl, { alt, className, loading, style });
    placeholder.replaceWith(img);
    return img;
  } catch (err) {
    setImagePlaceholderFallback(placeholder, fallbackText);
    return null;
  }
}

/**
 * Loads an image into a gallery-like container, replacing loading content with image or fallback.
 * @param {Object} options - Gallery image options.
 * @param {HTMLElement} options.gallery - Gallery container to replace.
 * @param {string} options.url - Image URL to fetch.
 * @param {string} [options.alt='foto animale'] - Image alt text.
 * @param {string} [options.fallbackText='Non e presente alcuna foto'] - Fallback message.
 * @param {string} [options.fallbackClassName='modal-no-photo'] - Fallback element class.
 * @param {string} [options.className=''] - Optional image class.
 * @param {string|null} [options.loading=null] - Optional image loading mode.
 * @param {Object} [options.style] - Inline styles for the image.
 * @param {Function} [options.wrapContent] - Optional wrapper factory for image/fallback.
 * @param {Object} [options.fetchOptions] - Fetch options for the image request.
 * @returns {Promise<HTMLImageElement|null>} Inserted image, or null on fallback.
 */
async function loadImageIntoGallery(options) {
  const {
    gallery,
    url,
    alt = 'foto animale',
    fallbackText = 'Non e presente alcuna foto',
    fallbackClassName = 'modal-no-photo',
    className = '',
    loading = null,
    style = null,
    wrapContent = (content) => content,
    fetchOptions = {}
  } = options;
  if (!gallery) return null;

  try {
    if (!url) throw new Error('no image');
    const objectUrl = await fetchImageObjectUrl(url, fetchOptions);
    const img = createObjectUrlImage(objectUrl, { alt, className, loading, style });
    gallery.innerHTML = '';
    gallery.appendChild(wrapContent(img));
    return img;
  } catch (err) {
    const fallback = document.createElement('div');
    fallback.className = fallbackClassName;
    fallback.textContent = fallbackText;
    gallery.innerHTML = '';
    gallery.appendChild(wrapContent(fallback));
    return null;
  }
}

/**
 * Fetches announcements from the public collection endpoint.
 * @param {Object} [params={}] - Query parameters appended to the announcements API URL.
 * @returns {Promise<Array<Object>>} Announcement list, or an empty list when loading fails.
 */
async function fetchAnnouncements(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = query ? `${ANNOUNCEMENTS_API}?${query}` : ANNOUNCEMENTS_API;

  try {
    const json = await fetchJson(url);
    return Array.isArray(json) ? json : json.data || [];
  } catch (err) {
    return [];
  }
}

/**
 * Fetches one announcement by id.
 * @param {string} id - Announcement identifier to load.
 * @param {Object} [options={}] - Error handling options.
 * @param {boolean} [options.throwOnError=false] - Throw instead of returning null on failure.
 * @param {string} [options.fallback='Errore caricamento annuncio'] - Error message prefix for failures.
 * @returns {Promise<Object|null>} Announcement payload, or null when loading fails and throwing is disabled.
 * @throws {Error} When `throwOnError` is true and the request fails.
 */
async function fetchAnnouncementById(id, options = {}) {
  const { throwOnError = false, fallback = 'Errore caricamento annuncio' } = options;
  try {
    const res = await fetch(`${ANNOUNCEMENTS_API}/${encodeURIComponent(id)}`);
    if (!res.ok) {
      if (throwOnError) throw new Error(await readResponseError(res, fallback));
      return null;
    }
    return await res.json();
  } catch (err) {
    if (throwOnError) throw err;
    return null;
  }
}

/**
 * Posts a comment to an announcement.
 * @param {string} id - Announcement identifier.
 * @param {string} text - Comment text.
 * @returns {Promise<Object>} API response JSON.
 * @throws {Error} When the user is not logged in or the API rejects the request.
 */
async function postAnnouncementComment(id, text) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('not logged in');

  return fetchAuthJson(`${ANNOUNCEMENTS_API}/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text })
  }).catch((err) => {
    if (err.message?.startsWith('HTTP ')) throw new Error('Errore invio commento');
    throw err;
  });
}

/**
 * Sends a report for an announcement.
 * @param {string} id - Announcement identifier.
 * @param {string} reason - Report reason.
 * @param {string} details - Additional report details.
 * @returns {Promise<Object>} API response JSON.
 * @throws {Error} When the user is not logged in or the API rejects the request.
 */
async function postAnnouncementReport(id, reason, details) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('not logged in');

  return fetchAuthJson(`${ANNOUNCEMENTS_API}/${encodeURIComponent(id)}/reports`, {
    method: 'POST',
    body: JSON.stringify({ reason, details })
  }).catch((err) => {
    if (err.message?.startsWith('HTTP ')) throw new Error('Errore invio segnalazione');
    throw err;
  });
}

/**
 * Updates the moderation status of an announcement.
 * @param {string} id - Announcement identifier.
 * @param {string} status - Status value to apply.
 * @returns {Promise<Object>} API response JSON.
 * @throws {Error} When the user is not logged in or the API rejects the request.
 */
async function patchAnnouncementStatus(id, status) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('not logged in');

  return fetchAuthJson(`${ANNOUNCEMENTS_API}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }).catch((err) => {
    if (err.message?.startsWith('HTTP ')) throw new Error('Errore aggiornamento stato');
    throw err;
  });
}

/**
 * Fetches public contact data for a user.
 * @param {string} userId - User identifier.
 * @returns {Promise<Object>} Public user payload.
 * @throws {Error} When the user is not logged in or the API rejects the request.
 */
async function fetchPublicUser(userId) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('not logged in');

  return fetchAuthJson(`/api/v1/users/${encodeURIComponent(userId)}/public`)
    .catch((err) => {
      if (err.message?.startsWith('HTTP ')) throw new Error('Errore caricamento contatti');
      throw err;
    });
}

/**
 * Builds a reusable announcement card for home and announcement-list pages.
 * @param {Object} ann - Announcement record to render.
 * @param {Object} [options={}] - Optional rendering hooks.
 * @param {Function} [options.onOpen] - Custom modal opener.
 * @returns {HTMLElement} Interactive announcement card.
 */
function createAnnouncementCard(ann, options = {}) {
  const animal = ann.animalId;
  const publisher = ann.publisherId;
  const isLost = ann.type === 'LostAnimal';
  const isRifugioAnnouncement = publisher?.role === 'shelter';
  const rifugioName = publisher?.role === 'shelter'
    ? (publisher?.rifugioData?.rifugioName || publisher?.username)
    : '';
  const primaryTitle = animal?.name || animal?.breed || animal?.species || 'Animale';
  const distanceLabel = typeof ann._distance === 'number'
    ? `<div class="card-distance">${ann._distance < 1000 ? `${Math.round(ann._distance)} m` : `${(ann._distance / 1000).toFixed(1)} km`} da te</div>`
    : '';
  const date = new Date(ann.date).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = ann._id;
  card.innerHTML = `
    <div class="card-image">
      <div class="card-image-placeholder"><span>...</span></div>
      <span class="badge badge--${isRifugioAnnouncement ? 'rifugio' : (isLost ? 'lost' : 'sighting')}">
        ${isRifugioAnnouncement ? 'Animale in rifugio' : (isLost ? 'Smarrito' : 'Avvistato')}
      </span>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-species">${escapeHtml(animal?.species || 'Specie sconosciuta')}</span>
        <span class="card-date">${escapeHtml(date)}</span>
      </div>
      <h3 class="card-breed">${escapeHtml(primaryTitle)}</h3>
      ${animal?.name ? `<div class="card-distance">${escapeHtml(animal?.species || '')}${animal?.breed ? ` - ${escapeHtml(animal.breed)}` : ''}</div>` : ''}
      <p class="card-description">${escapeHtml(ann.description)}</p>
      ${rifugioName ? `<div class="card-distance">Rifugio: ${escapeHtml(rifugioName)}</div>` : ''}
      ${ann.isQuick ? '<div class="card-distance">Segnalazione veloce</div>' : ''}
      ${distanceLabel}
      <div class="card-details">
        <span class="card-detail-label">Colore</span><span>${displayValue(animal?.color)}</span>
        <span class="card-detail-label">Salute</span><span>${displayValue(ann.healthCondition)}</span>
        <span class="card-detail-label">Comportamento</span><span>${displayValue(ann.animalBehaviour)}</span>
      </div>
      <button class="card-cta" type="button">Vedi dettagli</button>
    </div>
  `;

  const open = typeof options.onOpen === 'function'
    ? options.onOpen
    : (announcement) => openAnnouncementModal(announcement);
  card.addEventListener('click', () => open(ann));
  loadAnnouncementCardImage(card, ann);
  return card;
}

/**
 * Loads the card photo into the provided card, falling back to an initial.
 * @param {HTMLElement} card - Card element containing `.card-image`.
 * @param {Object} ann - Announcement record used to build the photo URL.
 * @returns {void}
 */
function loadAnnouncementCardImage(card, ann) {
  (async () => {
    const animal = ann.animalId;
    const container = card.querySelector('.card-image');
    const photoUrl = `${ANNOUNCEMENTS_API}/${encodeURIComponent(ann._id)}/photo`;
    await loadImageIntoPlaceholder({
      container,
      url: photoUrl,
      alt: animal?.species || 'Animale',
      fallbackText: animal?.species?.[0] || '?'
    });
  })();
}

/**
 * Renders the comments section markup for an announcement.
 * @param {Array<Object>} comments - Comment objects to render.
 * @returns {string} HTML string containing the rendered comments or empty state.
 */
function renderAnnouncementCommentsHtml(comments) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return '<div class="comments-empty">Nessun commento</div>';
  }

  const sorted = [...comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return sorted.map((c) => {
    const when = c?.createdAt
      ? new Date(c.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const uid = (c?.userId && typeof c.userId === 'object') ? (c.userId._id || c.userId.id) : c?.userId;
    const slotId = `comment-contact-${escapeHtml(c?._id || uid || Math.random().toString(16).slice(2))}`;
    return `
      <div class="comment-item">
        <div class="comment-meta">
          <button type="button" class="comment-user-link comment-user" data-user-id="${escapeHtml(uid || '')}" data-slot-id="${slotId}">${escapeHtml(c?.username || 'utente')}</button>
          <span class="comment-date">${escapeHtml(when)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c?.text || '')}</div>
        <div id="${slotId}" class="comment-contact-slot"></div>
      </div>
    `;
  }).join('');
}

/**
 * Opens the shared announcement detail modal.
 * @param {Object} ann - Announcement summary or full announcement data.
 * @returns {Promise<void>} Promise resolving after the modal is populated and opened.
 */
async function openAnnouncementModal(ann) {
  const isLoggedIn = !!localStorage.getItem('token');
  const currentRole = localStorage.getItem('role') || '';
  const full = await fetchAnnouncementById(ann._id);
  const data = full || ann;
  const animal = data.animalId;
  const publisher = data.publisherId;
  const isLost = data.type === 'LostAnimal';
  const isRifugioAnnouncement = publisher?.role === 'shelter';
  const comments = Array.isArray(data.comments) ? data.comments : [];
  const date = new Date(data.date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const coords = data.location?.coordinates;
  const locationInfo = coords?.length === 2
    ? `<dt>Posizione</dt><dd><a class="modal-map-btn" href="/pages/map.html?highlight=${encodeURIComponent(data._id)}">Vedi sulla mappa</a></dd>`
    : '';
  const rifugioAddress = [publisher?.rifugioData?.address, publisher?.rifugioData?.city].filter(Boolean).join(', ');
  const rifugioCoords = publisher?.rifugioData?.location?.coordinates;
  const rifugioLocationHtml = publisher?.role === 'shelter'
    ? `
      ${rifugioAddress ? `<span>${escapeHtml(rifugioAddress)}</span>` : ''}
      ${Array.isArray(rifugioCoords) && rifugioCoords.length === 2 ? `<a href="/pages/map.html?rifugioId=${encodeURIComponent(publisher._id)}">Vedi posizione rifugio</a>` : ''}
    `
    : '';
  const shelterAnimalLinkHtml = isRifugioAnnouncement && animal?._id
    ? `<a class="position-link" href="/pages/rifugio.html?rifugioId=${encodeURIComponent(publisher?._id || publisher)}&animalId=${encodeURIComponent(animal._id)}">Apri scheda animale</a>`
    : '';
  const rifugioLink = isRifugioAnnouncement && animal?._id
    ? `/pages/rifugio.html?rifugioId=${encodeURIComponent(publisher?._id || publisher)}&animalId=${encodeURIComponent(animal._id)}`
    : null;

  const shelterName = publisher?.rifugioData?.rifugioName || publisher?.username;
  document.getElementById('modal-title').textContent = isRifugioAnnouncement
    ? `Questo animale si trova attualmente al rifugio ${shelterName || 'il rifugio'}`
    : (animal?.name || (isLost ? `${animal?.species} smarrito/a` : `Avvistamento: ${animal?.species}`));

  renderAnnouncementModalGallery(data, rifugioLink);

  const contactHtml = renderAnnouncementContactHtml(data, {
    isLoggedIn,
    publisher,
    rifugioLocationHtml,
    shelterAnimalLinkHtml
  });
  const commentBoxHtml = isLoggedIn
    ? `
      <form class="comment-form" data-announcement-id="${escapeHtml(data._id)}">
        <label class="comment-label" for="comment-text">Commento</label>
        <textarea id="comment-text" class="comment-textarea" rows="3" maxlength="500" placeholder="Scrivi un aggiornamento (es. direzione)..."></textarea>
        <div class="comment-actions">
          <span class="comment-hint">Max 500 caratteri</span>
          <button type="submit" class="comment-submit">Invia</button>
        </div>
        <div class="comment-error" role="status" aria-live="polite"></div>
      </form>
    `
    : '<div class="comments-locked">Accedi per commentare</div>';
  const reportBoxHtml = isLoggedIn
    ? `
      <details class="comments-section modal-accordion">
        <summary class="comments-header">
          <h3>Segnala annuncio</h3>
        </summary>
        <div class="modal-accordion__body">
          <form class="report-form" data-announcement-id="${escapeHtml(data._id)}">
            <label class="comment-label" for="report-reason">Motivo</label>
            <select id="report-reason" class="report-select">
              <option value="troll">Troll</option>
              <option value="offensivo">Offensivo</option>
              <option value="falso">Non reale</option>
              <option value="altro">Altro</option>
            </select>
            <label class="comment-label" for="report-details">Dettagli</label>
            <textarea id="report-details" class="comment-textarea" rows="2" maxlength="500" placeholder="Aggiungi dettagli utili"></textarea>
            <div class="comment-actions">
              <span class="comment-hint">Visibile agli admin</span>
              <button type="submit" class="comment-submit">Segnala</button>
            </div>
            <div class="report-message comment-error" role="status" aria-live="polite"></div>
          </form>
        </div>
      </details>
    `
    : '';
  const adminResolveBoxHtml = currentRole === 'admin' && data.status !== 'RESOLVED'
    ? `
      <section class="comments-section" aria-label="Moderazione annuncio">
        <div class="comments-header">
          <h3>Moderazione</h3>
        </div>
        <button type="button" class="comment-submit" id="admin-resolve-announcement">Segna come risolto</button>
      </section>
    `
    : '';

  document.getElementById('modal-body').innerHTML = `
    <dl class="detail-list">
      ${animal?.name ? `<dt>Nome</dt><dd>${escapeHtml(animal.name)}</dd>` : ''}
      <dt>Specie</dt><dd>${displayValue(animal?.species)}</dd>
      <dt>Razza</dt><dd>${displayValue(animal?.breed)}</dd>
      <dt>Colore</dt><dd>${displayValue(animal?.color)}</dd>
      <dt>Sesso</dt><dd>${displayValue(animal?.gender)}</dd>
      <dt>Lunghezza pelo</dt><dd>${displayValue(animal?.lunghezzaPelo)}</dd>
      <dt>Segni particolari</dt><dd>${displayValue(animal?.distinctiveFeatures)}</dd>
      <dt>Microchip</dt><dd>${displayValue(animal?.microchipId)}</dd>
      ${locationInfo}
      <dt>Data</dt><dd>${date}</dd>
      <dt>Condizioni</dt><dd>${displayValue(data.healthCondition)}</dd>
      <dt>Comportamento</dt><dd>${displayValue(data.animalBehaviour)}</dd>
    </dl>
    ${contactHtml}
    <details class="comments-section modal-accordion">
      <summary class="comments-header">
        <h3>Commenti</h3>
        <span class="comments-count">${comments.length}</span>
      </summary>
      <div class="modal-accordion__body">
        ${commentBoxHtml}
        <div id="comments-list" class="comments-list">
          ${renderAnnouncementCommentsHtml(comments)}
        </div>
      </div>
    </details>
    ${reportBoxHtml}
    ${adminResolveBoxHtml}
  `;

  bindAnnouncementModalActions(data);
  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Renders the modal gallery image area.
 * @param {Object} data - Full announcement payload.
 * @param {string|null} rifugioLink - Optional shelter animal page URL.
 * @returns {void}
 */
function renderAnnouncementModalGallery(data, rifugioLink) {
  const gallery = document.getElementById('modal-gallery');
  gallery.innerHTML = '<div class="modal-spinner">...</div>';
  (async () => {
    const photoUrl = `${ANNOUNCEMENTS_API}/${encodeURIComponent(data._id)}/photo`;
    await loadImageIntoGallery({
      gallery,
      url: photoUrl,
      loading: null,
      wrapContent: (content) => createAnnouncementGalleryWrapper(content, rifugioLink)
    });
  })();
}

/**
 * Wraps modal gallery content with optional shelter-animal shortcut.
 * @param {HTMLElement} content - Gallery image or fallback element.
 * @param {string|null} rifugioLink - Optional shelter animal page URL.
 * @returns {HTMLElement} Gallery wrapper.
 */
function createAnnouncementGalleryWrapper(content, rifugioLink) {
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-gallery-wrapper';
  wrapper.appendChild(content);
  if (rifugioLink) {
    const btn = document.createElement('button');
    btn.className = 'modal-open-animal-btn';
    btn.type = 'button';
    btn.textContent = 'Scheda animale';
    btn.setAttribute('aria-label', 'Apri scheda animale');
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      window.location.href = rifugioLink;
    });
    wrapper.appendChild(btn);
  }
  return wrapper;
}

/**
 * Builds the modal contact block.
 * @param {Object} data - Full announcement payload.
 * @param {Object} context - Contact rendering context.
 * @returns {string} Contact HTML.
 */
function renderAnnouncementContactHtml(data, context) {
  const { isLoggedIn, publisher, rifugioLocationHtml, shelterAnimalLinkHtml } = context;
  const quick = data.isQuick ? data.quickContact : null;
  return `
    <div class="modal-contact">
      <div class="modal-contact-header">Contatti</div>
      ${quick
        ? `<div class="modal-contact-name">Nome: ${escapeHtml(quick.name || 'Segnalatore anonimo')}</div>
           <div class="modal-contact-links">
             ${quick.phoneNumber ? `<a href="tel:${escapeHtml(quick.phoneNumber)}">${escapeHtml(quick.phoneNumber)}</a>` : ''}
             ${quick.email ? `<a href="mailto:${escapeHtml(quick.email)}">${escapeHtml(quick.email)}</a>` : ''}
           </div>
           ${!quick.email && !quick.phoneNumber ? '<span class="contact-locked">Nessun contatto disponibile</span>' : ''}`
        : (isLoggedIn
          ? `<div class="modal-contact-name">Nome: ${escapeHtml(publisher?.rifugioData?.rifugioName || publisher?.username || '-')}</div>
             <div class="modal-contact-links">
               ${publisher?.phoneNumber ? `<a href="tel:${escapeHtml(publisher.phoneNumber)}">${escapeHtml(publisher.phoneNumber)}</a>` : ''}
               ${publisher?.email ? `<a href="mailto:${escapeHtml(publisher.email)}">${escapeHtml(publisher.email)}</a>` : ''}
             </div>
             ${rifugioLocationHtml || shelterAnimalLinkHtml ? `<div class="modal-contact-extra">${rifugioLocationHtml}${shelterAnimalLinkHtml}</div>` : ''}
             ${!publisher?.phoneNumber && !publisher?.email ? '<span class="contact-locked">Nessun contatto pubblico disponibile</span>' : ''}`
          : '<span class="contact-locked">Accedi per vedere i contatti del segnalante</span>')
      }
    </div>
  `;
}

/**
 * Binds modal form and moderation actions for the displayed announcement.
 * @param {Object} data - Full announcement payload.
 * @returns {void}
 */
function bindAnnouncementModalActions(data) {
  const form = document.querySelector('.comment-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const textarea = form.querySelector('.comment-textarea');
      const errorBox = form.querySelector('.comment-error');
      const list = document.getElementById('comments-list');
      const count = document.querySelector('.comments-count');
      const text = (textarea?.value ?? '').trim();
      if (!text) {
        errorBox.textContent = 'Scrivi testo';
        return;
      }

      errorBox.textContent = '';
      form.querySelector('.comment-submit').disabled = true;
      try {
        const result = await postAnnouncementComment(data._id, text);
        const updated = Array.isArray(result.comments) ? result.comments : [];
        textarea.value = '';
        if (list) list.innerHTML = renderAnnouncementCommentsHtml(updated);
        if (count) count.textContent = String(updated.length);
      } catch (err) {
        errorBox.textContent = err.message || 'Errore invio commento';
      } finally {
        form.querySelector('.comment-submit').disabled = false;
      }
    });
  }

  const reportForm = document.querySelector('.report-form');
  if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reason = reportForm.querySelector('#report-reason')?.value || 'altro';
      const details = reportForm.querySelector('#report-details')?.value.trim() || '';
      const message = reportForm.querySelector('.report-message');
      const submit = reportForm.querySelector('.comment-submit');

      if (message) {
        message.textContent = '';
        message.classList.remove('success');
      }
      submit.disabled = true;
      try {
        await postAnnouncementReport(data._id, reason, details);
        if (message) {
          message.textContent = 'Segnalazione inviata agli admin';
          message.style.color = '#166534';
        }
        reportForm.reset();
      } catch (err) {
        if (message) {
          message.textContent = err.message || 'Errore invio segnalazione';
          message.style.color = '';
        }
      } finally {
        submit.disabled = false;
      }
    });
  }

  const resolveButton = document.getElementById('admin-resolve-announcement');
  if (resolveButton) {
    resolveButton.addEventListener('click', async () => {
      if (!confirm('Segnare l\'annuncio come risolto?')) return;
      resolveButton.disabled = true;
      try {
        await patchAnnouncementStatus(data._id, 'RESOLVED');
        window.dispatchEvent(new Event('announcements:resolved-updated'));
        closeAnnouncementModal();
      } catch (err) {
        alert(err.message || 'Errore aggiornamento stato');
      } finally {
        resolveButton.disabled = false;
      }
    });
  }

  bindCommentContactLookup();
}

/**
 * Binds contact lookup behavior for comment author buttons once per modal body.
 * @returns {void}
 */
function bindCommentContactLookup() {
  const modalBody = document.getElementById('modal-body');
  if (!modalBody || modalBody.dataset.commentContactsBound === 'true') return;

  modalBody.dataset.commentContactsBound = 'true';
  modalBody.addEventListener('click', async (e) => {
    const btn = e.target?.closest?.('.comment-user-link');
    if (!btn) return;
    const userId = btn.getAttribute('data-user-id');
    if (!userId) return;

    const slotId = btn.getAttribute('data-slot-id');
    const slot = slotId ? document.getElementById(slotId) : null;
    if (!slot) return;

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
      const u = await fetchPublicUser(userId);
      const parts = [];
      if (u.phoneNumber) parts.push(`<a href="tel:${escapeHtml(u.phoneNumber)}">${escapeHtml(u.phoneNumber)}</a>`);
      if (u.email) parts.push(`<a href="mailto:${escapeHtml(u.email)}">${escapeHtml(u.email)}</a>`);
      slot.innerHTML = `
        <div class="modal-contact modal-contact--inline">
          <strong>Contatto:</strong>
          <span>${escapeHtml(u.username || '-')}</span>
          ${parts.join('')}
          ${parts.length === 0 ? '<span class="contact-locked">Nessun contatto pubblico</span>' : ''}
        </div>
      `;
    } catch (err) {
      slot.innerHTML = `<div class="comment-error">${escapeHtml(err.message || 'Errore')}</div>`;
    }
  });
}

/**
 * Closes the shared announcement detail modal and restores scrolling.
 * @returns {void}
 */
function closeAnnouncementModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * Reads a query-string parameter from the current page URL.
 * @param {string} name - Query parameter name to read.
 * @returns {string|null} Parameter value from `window.location.search`, or null when absent.
 */
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Decodes a JWT payload without verifying the signature for client-side UI decisions.
 * @param {string} token - JWT string read from local storage.
 * @returns {Object|null} Decoded payload object, or null when the token cannot be decoded.
 */
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch (error) {
    return null;
  }
}

/**
 * Opens the profile new-announcement flow from shared navigation controls.
 * @returns {void}
 */
function openProfileNewAnnouncementFlow() {
  const target = '/pages/profile.html?newAnnouncement=1';
  const token = localStorage.getItem('token');
  if (token) {
    window.location.href = target;
  } else {
    window.location.href = `/pages/login.html?next=${encodeURIComponent(target)}`;
  }
}

document.addEventListener('click', (event) => {
  const trigger = event.target?.closest?.('[data-profile-new-announcement]');
  if (!trigger) return;
  event.preventDefault();
  openProfileNewAnnouncementFlow();
});

/**
 * Loads shared HTML partials and initializes navigation-dependent UI.
 * @returns {Promise<void>} Promise resolving after shared partials and navigation state are initialized.
 */
async function loadPartials() {
  const targets = Array.from(document.querySelectorAll('[data-include]'));
  if (targets.length === 0) return;

  await Promise.all(
    targets.map(async (target) => {
      const name = target.getAttribute('data-include');
      if (!name) return;

      try {
        const res = await fetch(`/partials/${name}.html`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        target.innerHTML = await res.text();
      } catch (err) {
        console.warn(`Include fallito per ${name}`, err);
      }
    })
  );

  personalizeNav();
  setActiveNav();
  initMobileNav();
  startNotificationBadgeUpdates();
}

/**
 * Marks the current navigation link as active.
 * @returns {void}
 */
function setActiveNav() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const links = Array.from(document.querySelectorAll('[data-nav]'));

  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;

    const target = href.replace(/\/+$/, '') || '/';
    const isHome = path === '/' && (target === '/' || target.endsWith('/index.html'));

    if (path === target || isHome) {
      link.classList.add('active');
    }
  });
}

/**
 * Personalizes navigation controls based on the current authentication state.
 * @returns {void}
 */
function personalizeNav() {
  const token = localStorage.getItem('token');
  const loginAnchors = Array.from(document.querySelectorAll('[data-login-target]'));
  loginAnchors.forEach(a => {
    const target = a.getAttribute('data-login-target') || '/pages/profile.html';
    if (token) {
      a.setAttribute('href', target);
      a.setAttribute('title', 'Profilo');
      a.setAttribute('aria-label', 'Profilo');
      const label = a.querySelector('.nav-icon__label');
      if (label) label.textContent = 'Profilo';
    } else {
      a.setAttribute('href', '/pages/login.html?next=' + encodeURIComponent(target));
      a.setAttribute('title', 'Accedi');
      a.setAttribute('aria-label', 'Accedi');
      const label = a.querySelector('.nav-icon__label');
      if (label) label.textContent = 'Accedi';
    }
  });
}

/**
 * Binds the off-canvas mobile navigation loaded from the shared header partial.
 * @returns {void}
 */
function initMobileNav() {
  const toggle = document.querySelector('.nav-menu-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav || toggle.dataset.bound === 'true') return;

  const setOpen = (open) => {
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
  };

  toggle.dataset.bound = 'true';
  toggle.addEventListener('click', () => {
    setOpen(!document.body.classList.contains('nav-open'));
  });

  document.querySelectorAll('[data-nav-close]').forEach((button) => {
    button.addEventListener('click', () => setOpen(false));
  });

  nav.addEventListener('click', (event) => {
    if (event.target?.closest?.('a, button')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 700) setOpen(false);
  });
}

/**
 * Fetches unread notifications and updates the navigation badge.
 * @returns {Promise<void>} Promise resolving after the badge is shown, hidden, or cleared.
 */
async function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  const token = localStorage.getItem('token');
  if (!badge) return;

  if (!token) {
    badge.hidden = true;
    badge.textContent = '';
    return;
  }

  try {
    const res = await fetch('/api/v1/notifications?unread=1', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('badge fetch failed');
    const notifications = await res.json();
    const unreadCount = Array.isArray(notifications) ? notifications.length : 0;

    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      badge.hidden = false;
    } else {
      badge.hidden = true;
      badge.textContent = '';
    }
  } catch (err) {
    badge.hidden = true;
    badge.textContent = '';
  }
}

/**
 * Starts periodic notification-badge refreshes.
 * @returns {void}
 */
function startNotificationBadgeUpdates() {
  if (notificationBadgeTimer) clearInterval(notificationBadgeTimer);
  updateNotificationBadge();
  notificationBadgeTimer = setInterval(updateNotificationBadge, 30000);
  window.removeEventListener('notifications:updated', updateNotificationBadge);
  window.addEventListener('notifications:updated', updateNotificationBadge);
}

/**
 * Loads the mock inbox widget once, if the backend exposes it.
 * @returns {void}
 */
function loadMockInboxWidget() {
  if (document.querySelector('script[data-mock-inbox]')) return;

  const script = document.createElement('script');
  script.src = '/js/mock-inbox.js';
  script.defer = true;
  script.dataset.mockInbox = 'true';
  document.body.appendChild(script);
}

document.addEventListener('DOMContentLoaded', loadPartials);

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('enableMockInbox') === '1') {
    loadMockInboxWidget();
    return;
  }

  // If the backend exposes the mock inbox endpoint (RENDER mode), enable and load it automatically.
  (async () => {
    try {
      const res = await fetch('/api/v1/mock-emails', { cache: 'no-cache' });
      if (res.ok) {
        localStorage.setItem('enableMockInbox', '1');
        loadMockInboxWidget();
      }
    } catch (err) {
      // ignore network errors — mock inbox stays disabled
    }
  })();
});
