let mapInstance = null;
let mapMarker = null;
let rifugioMapInstance = null;
let rifugioMapMarker = null;
let pendingRifugioLocation = null;
let editingId = null;
let editingAnimalId = null;
let currentEditStatus = 'ACTIVE';
let currentEditIsCurrentlyThere = false;
let currentUser = null;
let isSavingAnnouncement = false;
let selectedAdoptionRequest = null;
let notificationsRefreshTimer = null;
let isRefreshingNotifications = false;
const API_ANIMALS = '/api/v1/animals';
const API_CONTACT_REQUESTS = '/api/v1/contact-requests';
const API_FOLLOWED_SHELTERS = '/api/v1/users/me/followed-shelters';

/**
 * Sets last seen mode.
 * @param {string} mode - Selected last-seen mode, either `today` or `custom`.
 * @returns {void}
 */
function setLastSeenMode(mode) {
  const todayBtn = document.getElementById('lastSeenTodayBtn');
  const customBtn = document.getElementById('lastSeenCustomBtn');
  const dateInput = document.getElementById('modal-lastSeenDate');

  const isCustom = mode === 'custom';
  todayBtn.classList.toggle('is-selected', !isCustom);
  customBtn.classList.toggle('is-selected', isCustom);
  dateInput.style.display = isCustom ? 'block' : 'none';
}

/**
 * Configures announcement type choices for normal users or shelter accounts.
 * @param {string} defaultType - Type selected when the current account may choose between lost and sighting.
 * @returns {void}
 */
function configureTypeFieldForAccount(defaultType = 'LostAnimal') {
  const typeSelect = document.getElementById('modal-type');
  if (!typeSelect) return;

  const typeTabs = document.querySelector('.type-tabs');
  const isRifugio = currentUser?.role === 'shelter';
  if (isRifugio) {
    typeSelect.innerHTML = '<option value="Sighting">In rifugio</option>';
    typeSelect.value = 'Sighting';
    typeSelect.disabled = true;
    if (typeTabs) typeTabs.style.display = 'none';
    return;
  }

  typeSelect.disabled = false;
  typeSelect.innerHTML = `
    <option value="LostAnimal">Smarrito</option>
    <option value="Sighting">Avvistamento</option>
  `;  typeSelect.value = defaultType || 'LostAnimal';
  if (typeTabs) typeTabs.style.display = '';
}

/**
 * Returns rifugio coordinates.
 * @returns {number[]|null} Current shelter coordinates as `[longitude, latitude]`, or null when unavailable.
 */
function getRifugioCoordinates() {
  const coords = currentUser?.rifugioData?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lng, lat] = coords.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

/**
 * Reverse geocodes a point to a short address and city string.
 * @param {number} lng - Point longitude.
 * @param {number} lat - Point latitude.
 * @returns {Promise<{address: string, city: string} | null>} Best-effort address payload.
 */
async function reverseGeocodeRifugioPosition(lng, lat) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=it&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;

    const json = await res.json();
    const addr = json?.address || {};
    const address = [addr.road, addr.house_number].filter(Boolean).join(' ').trim() || json?.display_name || '';
    const city = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || addr.county || '';

    if (!address && !city) return null;
    return { address, city };
  } catch (err) {
    console.error('Errore reverse geocoding rifugio:', err);
    return null;
  }
}

/**
 * Adapts announcement modal labels and fields for the current account role.
 * @returns {void}
 */
function configureModalLabelsForAccount() {
  const isRifugio = currentUser?.role === 'shelter';
  const dateLabel = document.getElementById('modal-lastSeenDate-label');
  const positionHint = document.getElementById('modal-position-hint');
  const positionSection = document.getElementById('modal-position-section');
  const microchipRow = document.getElementById('modal-microchip-row');
  const adoptionRow = document.getElementById('modal-adoption-row');
  const adoptionSelect = document.getElementById('modal-adoptionStatus');
  const animalNameRow = document.getElementById('modal-animal-name-row');

  if (dateLabel) dateLabel.textContent = isRifugio ? 'Data' : 'Ultima data vista';
  if (positionSection) positionSection.style.display = isRifugio ? 'none' : '';
  if (microchipRow) microchipRow.style.display = isRifugio ? '' : 'none';
  if (adoptionRow) adoptionRow.style.display = isRifugio ? '' : 'none';
  if (adoptionSelect) adoptionSelect.disabled = !isRifugio;
  if (animalNameRow) animalNameRow.style.display = '';
  if (positionHint) {
    positionHint.textContent = isRifugio
      ? 'Posizione del rifugio gia impostata. Puoi modificarla selezionando un altro punto.'
      : 'Scegli un punto sulla mappa o usa la posizione attuale.';
  }
}

/**
 * Adapts animal-name requirements and helper text for the selected announcement type.
 * @param {string} type - Announcement type selected in the modal.
 * @returns {void}
 */
function configureModalFieldsForType(type) {
  const isSighting = type === 'Sighting';
  const animalNameRow = document.getElementById('modal-animal-name-row');
  const animalNameLabel = document.getElementById('modal-animal-name-label');
  const animalNameInput = document.getElementById('modal-animalName');
  const animalNameHint = document.getElementById('modal-animal-name-hint');
  const typeHint = document.getElementById('modal-type-hint');

  if (animalNameRow) animalNameRow.style.display = '';
  if (animalNameLabel) {
    animalNameLabel.textContent = isSighting ? 'Nome animale (opzionale)' : 'Nome animale';
  }
  if (animalNameInput) {
    animalNameInput.required = !isSighting;
    animalNameInput.placeholder = isSighting ? 'Es. Luna, se lo sai' : 'Es. Luna';
  }
  if (animalNameHint) {
    animalNameHint.textContent = isSighting
      ? 'Se non conosci il nome puoi lasciarlo vuoto.'
      : 'Se lo conosci, inseriscilo qui.';
  }
  if (typeHint) {
    typeHint.textContent = isSighting
      ? 'Avvistamento: compila solo i dati che conosci, il nome non Ã¨ obbligatorio.'
      : 'Smarrito: inserisci i dati dell animale che stai cercando.';
  }
}

/**
 * Sets announcement saving state.
 * @param {boolean} isSaving - Whether the announcement form is currently being submitted.
 * @returns {void}
 */
function setAnnouncementSavingState(isSaving) {
  isSavingAnnouncement = isSaving;
  const progress = document.getElementById('profile-modal-progress');
  const saveButton = document.getElementById('modal-save');
  const cancelButton = document.getElementById('modal-cancel');

  if (progress) {
    progress.classList.toggle('is-visible', isSaving);
    progress.setAttribute('aria-hidden', String(!isSaving));
  }

  if (saveButton) saveButton.disabled = isSaving;
  if (cancelButton) cancelButton.disabled = isSaving;
}

  /**
   * Shows a reusable confirmation modal and resolves with the user's choice.
 * @param {Object} options - Confirmation dialog options.
 * @param {string} options.title - Confirmation dialog title.
 * @param {string} options.message - Confirmation dialog message.
 * @param {string} [options.confirmLabel='Conferma'] - Label for the confirmation button.
 * @param {boolean} [options.danger=true] - Whether to style the action as destructive.
 * @returns {Promise<boolean>} Promise resolving to true when the user confirms.
 */
function showProfileConfirm({ title, message, confirmLabel = 'Conferma', danger = true }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('profile-confirm-overlay');
    const titleEl = document.getElementById('profile-confirm-title');
    const messageEl = document.getElementById('profile-confirm-message');
    const okButton = document.getElementById('profile-confirm-ok');
    const cancelButton = document.getElementById('profile-confirm-cancel');
    const closeButton = document.getElementById('profile-confirm-close');

    if (!overlay || !titleEl || !messageEl || !okButton || !cancelButton || !closeButton) {
      resolve(window.confirm(message));
      return;
    }

    /**
     * Hides the confirmation dialog and removes temporary event listeners.
     * @returns {void}
     */
    const cleanup = () => {
      overlay.style.display = 'none';
      overlay.removeEventListener('click', onOverlayClick);
      okButton.removeEventListener('click', onConfirm);
      cancelButton.removeEventListener('click', onCancel);
      closeButton.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onEscape);
    };

    /**
     * Resolves the confirmation dialog as accepted.
     * @returns {void}
     */
    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    /**
     * Resolves the confirmation dialog as cancelled.
     * @returns {void}
     */
    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    /**
     * Cancels the confirmation when the user clicks outside the dialog.
     * @param {Event} event - Browser event object.
     * @returns {void}
     */
    const onOverlayClick = (event) => {
      if (event.target === overlay) onCancel();
    };

    /**
     * Cancels the confirmation when Escape is pressed.
     * @param {Event} event - Browser event object.
     * @returns {void}
     */
    const onEscape = (event) => {
      if (event.key === 'Escape') onCancel();
    };

    titleEl.textContent = title || 'Conferma azione';
    messageEl.textContent = message || '';
    okButton.textContent = confirmLabel;
    okButton.classList.toggle('btn--danger', danger);
    okButton.classList.toggle('btn--primary', !danger);
    overlay.style.display = 'flex';
    overlay.addEventListener('click', onOverlayClick);
    okButton.addEventListener('click', onConfirm);
    cancelButton.addEventListener('click', onCancel);
    closeButton.addEventListener('click', onCancel);
    document.addEventListener('keydown', onEscape);
  });
}

/**
 * Initializes the authenticated profile page after the DOM is ready.
 * @returns {Promise<void>} Promise resolving when the profile UI and event handlers are initialized.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/pages/login.html';
    return;
  }

  const autoOpenNewAnnouncement = new URLSearchParams(window.location.search).get('newAnnouncement') === '1';

  const authHeader = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
  const mePayload = decodeJwt(token) || {};
  const myUserId = mePayload.userId;
  const editableProfileFields = [
    'username',
    'phoneNumber',
    'showEmail',
    'showPhone',
    'emailOnComment'
  ];
  const editProfileButton = document.getElementById('editProfileBtn');
  const saveProfileButton = document.getElementById('saveProfileBtn');
  const adminUserLookup = new Map();

  /**
   * Sets profile editing.
   * @param {boolean} enabled - Whether profile fields should be editable.
   * @returns {void}
   */
  function setProfileEditing(enabled) {
    editableProfileFields.forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.disabled = !enabled;
    });

    saveProfileButton.disabled = !enabled;
    editProfileButton.disabled = enabled;
    document.getElementById('profile-section').classList.toggle('is-editing', enabled);
    setRifugioPositionEditingState(enabled);
  }

  /**
   * Logs out the current user and redirects to the login page.
   * @returns {Promise<void>} Promise resolving after local session data is cleared.
   */
  async function handleLogout() {
    try {
      await fetch('/api/v1/auth/sessions/current', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
    } catch (e) {
      console.error('Logout error:', e);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/pages/login.html';
  }

  /**
   * Fetches me data from the API.
   * @returns {Promise<Object|null>} Current user profile, or null when the session is invalid.
   */
  async function fetchMe() {
    const res = await fetch('/api/v1/users/me', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return null;
    return await res.json();
  }

  /**
   * Fetches notifications data from the API.
   * @returns {Promise<Array<Object>>} Notifications for the current user.
   */
  async function fetchNotifications() {
    const res = await fetch('/api/v1/notifications', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  /**
   * Refreshes notifications while preventing overlapping refreshes.
   * @returns {Promise<void>} Promise resolving after the notification list is rendered.
   */
  async function refreshNotifications() {
    if (isRefreshingNotifications) return;
    isRefreshingNotifications = true;
    try {
      const notifications = await fetchNotifications();
      renderNotifications(notifications);
    } finally {
      isRefreshingNotifications = false;
    }
  }

  /**
   * Fetches contact requests data from the API.
   * @returns {Promise<Array<Object>>} Contact requests visible to the current profile.
   */
  async function fetchContactRequests() {
    const res = await fetch(API_CONTACT_REQUESTS, { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  /**
   * Fetches followed shelters data from the API.
   * @returns {Promise<Array<Object>>} Shelters followed by the current user.
   */
  async function fetchFollowedShelters() {
    const res = await fetch(API_FOLLOWED_SHELTERS, { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  /**
   * Removes a shelter from the current user's followed list.
   * @param {string} shelterId - Shelter identifier to unfollow.
   * @returns {Promise<Object>} API response for the unfollow request.
   * @throws {Error} When the API rejects the unfollow request.
   */
  async function unfollowShelter(shelterId) {
    const res = await fetch(`${API_FOLLOWED_SHELTERS}/${encodeURIComponent(shelterId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.userMessage || data.message || 'Errore: impossibile smettere di seguire il rifugio');
    return data;
  }

  /**
   * Hides replied adoption requests for the current user role.
   * @returns {Promise<Object>} API response with the number of hidden requests.
   * @throws {Error} When the API rejects the clear request.
   */
  async function clearRepliedAdoptionRequests() {
    const res = await fetch(`${API_CONTACT_REQUESTS}/replied`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.userMessage || data.message || 'Errore svuotamento richieste');
    return data;
  }

  /**
   * Fetches announcement by id data from the API.
   * @param {string} id - Announcement identifier to load.
   * @returns {Promise<Object|null>} Announcement payload, or null when it cannot be loaded.
   */
  async function fetchAnnouncementById(id) {
    const res = await fetch(`/api/v1/announcements/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  }

  /**
   * Fetches similar announcements data from the API.
   * @param {string} id - Announcement identifier used as the smart-match source.
   * @param {number} limit - Maximum number of similar announcements to request.
   * @returns {Promise<Array<Object>>} Smart-match results for the announcement.
   */
  async function fetchSimilarAnnouncements(id, limit = 6) {
    const res = await fetch(`/api/v1/announcements/${encodeURIComponent(id)}/similar?limit=${limit}`);
    if (!res.ok) return [];
    const json = await res.json().catch(() => ({}));
    return Array.isArray(json?.matches) ? json.matches : [];
  }

  /**
   * Marks a single notification as read and notifies shared navigation.
   * @param {string} id - Notification identifier to update.
   * @returns {Promise<void>} Promise resolving after the update request is sent.
   */
  async function markNotificationRead(id) {
    await fetch(`/api/v1/notifications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeader,
      body: JSON.stringify({ isRead: true })
    });
    window.dispatchEvent(new Event('notifications:updated'));
  }

  /**
   * Marks every notification as read and refreshes profile/navigation notification UI.
   * @returns {Promise<void>} Promise resolving after the update and refresh complete.
   */
  async function markAllNotificationsRead() {
    await fetch('/api/v1/notifications', {
      method: 'PATCH',
      headers: authHeader,
      body: JSON.stringify({ isRead: true })
    });
    window.dispatchEvent(new Event('notifications:updated'));
  }

  /**
   * Formats a value for UI display, replacing empty values with a placeholder.
   * @param {*} value - Field value shown in profile, admin, or announcement details.
   * @returns {string} Escaped display text or muted placeholder markup.
   */
  function displayValue(value) {
    const text = String(value ?? '').trim();
    return text ? escapeHtml(text) : '<span class="muted">Non specificato</span>';
  }

  /**
   * Renders admin comments html into the current page.
   * @param {Array<Object>} comments - Comment records attached to an announcement.
   * @returns {string} HTML markup for the admin comment list or empty state.
   */
  function renderAdminCommentsHtml(comments) {
    if (!Array.isArray(comments) || comments.length === 0) {
      return '<div class="comments-empty">Nessun commento</div>';
    }

    return [...comments]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((c) => {
        const when = c?.createdAt ? new Date(c.createdAt).toLocaleString('it-IT') : '';
        return `
          <div class="comment-item">
            <div class="comment-meta">
              <span class="comment-user">${escapeHtml(c?.username || 'utente')}</span>
              <span class="comment-date">${escapeHtml(when)}</span>
            </div>
            <div class="comment-text">${escapeHtml(c?.text || '')}</div>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Renders notifications into the current page.
   * @param {Array<Object>} list - Notification records returned for the current user.
   * @returns {void}
   */
  function renderNotifications(list) {
    const empty = document.getElementById('notifications-empty');
    const container = document.getElementById('notifications-list');
    if (!container || !empty) return;

    container.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.forEach((n) => {
      const when = n?.createdAt ? new Date(n.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const annId = n?.announcementId;
      const isDeletedAnnouncementNotification = String(n?.message || '').startsWith('Annuncio eliminato, motivo:');
      const isReportNotification = n?.type === 'report';
      const shelterAnimalLink = n?.type === 'shelter_announcement' && n?.shelterId && n?.animalId
        ? `/pages/rifugio.html?rifugioId=${encodeURIComponent(n.shelterId)}&animalId=${encodeURIComponent(n.animalId)}`
        : null;
      const announcementLinkHtml = shelterAnimalLink
        ? `
            <div style="margin-top:8px;display:flex;gap:10px;align-items:center;">
              <a class="btn btn--ghost" href="${shelterAnimalLink}">Apri scheda animale</a>
            </div>
          `
        : (!isDeletedAnnouncementNotification && !isReportNotification && annId
          ? `
            <div style="margin-top:8px;display:flex;gap:10px;align-items:center;">
              <a class="btn btn--ghost" href="/pages/announcements.html?highlight=${encodeURIComponent(annId)}">Vedi annuncio</a>
            </div>
          `
          : '');
      const targetHref = shelterAnimalLink || (!isDeletedAnnouncementNotification && !isReportNotification && annId ? `/pages/announcements.html?highlight=${encodeURIComponent(annId)}` : '');

      const item = document.createElement('article');
      item.className = 'comment-item notification-item';
      item.innerHTML = `
        <div class="comment-meta">
          <span class="comment-user">${escapeHtml(n?.title || n?.type || 'Notifica')}</span>
          <span class="comment-date">${escapeHtml(when)}</span>
        </div>
        <div class="comment-text">${escapeHtml(n?.message || '')}</div>
        ${announcementLinkHtml}
      `;

      if (targetHref) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', async (event) => {
          if (event.target.closest('a, button')) return;
          event.preventDefault();
          if (n?._id) await markNotificationRead(n._id);
          window.location.href = targetHref;
        });

        const link = item.querySelector('a[href]');
        if (link) {
          link.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (n?._id) await markNotificationRead(n._id);
            window.location.href = targetHref;
          });
        }
      }

      container.appendChild(item);
    });
  }

  /**
   * Converts a contact-request status code into the label shown in the profile UI.
   * @param {string} status - Contact-request status from the API.
   * @returns {string} Localized status label.
   */
  function formatContactRequestStatus(status) {
    const labels = {
      pending: currentUser?.role === 'user' ? 'In attesa di risposta' : 'Da rispondere',
      replied: 'Risposta inviata',
      closed: 'Chiusa'
    };
    return labels[status] || status || 'Da rispondere';
  }

  /**
   * Renders contact requests into the current page.
   * @param {Array<Object>} list - Contact requests visible to the current user or shelter.
   * @returns {void}
   */
  function renderContactRequests(list) {
    const section = document.getElementById('contact-requests-section');
    const title = document.getElementById('contact-requests-title');
    const empty = document.getElementById('contact-requests-empty');
    const container = document.getElementById('contact-requests-list');
    const clearButton = document.getElementById('clearRepliedAdoptionRequests');
    if (!section || !empty || !container) return;

    if (!['shelter', 'user'].includes(currentUser?.role)) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    if (title) title.textContent = currentUser.role === 'shelter' ? 'Richieste adozione' : 'Le mie richieste adozione';
    if (clearButton) {
      const hasReplied = ['shelter', 'user'].includes(currentUser.role)
        && Array.isArray(list)
        && list.some(request => request.status === 'replied');
      clearButton.style.display = hasReplied ? 'inline-block' : 'none';
    }
    container.innerHTML = '';
    if (!list || list.length === 0) {
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    list.forEach((request) => {
      const animal = request.animalId || {};
      const requester = request.requesterId || {};
      const shelter = request.shelterId || {};
      const when = request.createdAt ? new Date(request.createdAt).toLocaleString('it-IT') : '';
      const isShelter = currentUser.role === 'shelter';
      const canReply = isShelter && request.status === 'pending';
      const shelterName = shelter.rifugioData?.rifugioName || shelter.username || 'Rifugio';
      const animalName = animal.name || animal.species || 'Animale';
      const item = document.createElement('div');
      item.className = 'comment-item contact-request-item';
      item.innerHTML = `
        <div class="comment-meta">
          <span class="comment-user">${escapeHtml(animalName)}</span>
          <span class="comment-date">${escapeHtml(when)} - ${escapeHtml(formatContactRequestStatus(request.status))}</span>
        </div>
        <div class="comment-text">
          ${escapeHtml(isShelter ? (requester.username || 'utente') : shelterName)}
          ${request.replyMessage ? `<br><strong>Risposta:</strong> ${escapeHtml(request.replyMessage)}` : ''}
        </div>
        ${canReply ? `
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn btn--primary" data-adoption-action="open-reply" data-request-id="${escapeHtml(request._id)}">Rispondi</button>
          </div>
        ` : ''}
      `;
      item.dataset.request = JSON.stringify({
        _id: request._id,
        animalName,
        requesterUsername: requester.username || 'utente',
        requesterEmail: requester.email || '',
        requesterPhone: requester.phoneNumber || '',
        message: request.message || ''
      });
      container.appendChild(item);
    });
  }

  /**
   * Returns rifugio name.
   * @param {Object} rifugio - Followed shelter payload.
   * @returns {string} Best available shelter display name.
   */
  function getRifugioName(rifugio) {
    return rifugio?.rifugioData?.rifugioName || rifugio?.username || 'Rifugio';
  }

  /**
   * Renders followed shelters into the current page.
   * @param {Array<Object>} list - Shelters followed by the current user.
   * @returns {void}
   */
  function renderFollowedShelters(list) {
    const section = document.getElementById('followed-shelters-section');
    const empty = document.getElementById('followed-shelters-empty');
    const container = document.getElementById('followed-shelters-list');
    if (!section || !empty || !container) return;

    if (currentUser?.role !== 'user') {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    container.innerHTML = '';

    if (!list || list.length === 0) {
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    list.forEach((rifugio) => {
      const id = rifugio._id;
      const name = getRifugioName(rifugio);
      const city = rifugio?.rifugioData?.city || '';
      const pref = rifugio.emailEnabled ? 'Sito e email' : 'Solo sito';
      const item = document.createElement('div');
      item.className = 'comment-item followed-shelter-item';
      item.innerHTML = `
        <div class="comment-meta">
          <span class="comment-user">${escapeHtml(name)}</span>
          <span class="comment-date">${escapeHtml(pref)}</span>
        </div>
        <div class="comment-text">${escapeHtml(city || 'Rifugio seguito')}</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
          <a class="btn btn--ghost followed-shelter-link" href="/pages/rifugio.html?rifugioId=${encodeURIComponent(id)}">Vai alla pagina rifugio</a>
          <button type="button" class="btn btn--ghost" data-follow-action="unfollow" data-shelter-id="${escapeHtml(id)}">Non seguire piÃ¹</button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  /**
   * Loads followed shelters data and updates the UI.
   * @returns {Promise<void>} Promise resolving after followed shelters are rendered.
   */
  async function loadFollowedShelters() {
    if (currentUser?.role !== 'user') {
      renderFollowedShelters([]);
      return;
    }
    renderFollowedShelters(await fetchFollowedShelters());
  }

  /**
   * Loads contact requests data and updates the UI.
   * @returns {Promise<void>} Promise resolving after contact requests are rendered.
   */
  async function loadContactRequests() {
    if (!['shelter', 'user'].includes(currentUser?.role)) return;
    renderContactRequests(await fetchContactRequests());
  }

  /**
   * Sends a shelter reply for an adoption contact request.
   * @param {string} requestId - Contact-request identifier to reply to.
   * @param {string} replyMessage - Reply text entered by the shelter.
   * @returns {Promise<Object>} Updated contact-request payload.
   * @throws {Error} When the API rejects the reply.
   */
  async function replyToContactRequest(requestId, replyMessage) {
    const res = await fetch(`${API_CONTACT_REQUESTS}/${encodeURIComponent(requestId)}/replies`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ replyMessage })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.userMessage || data.message || 'Errore risposta richiesta');
    return data;
  }

  /**
   * Closes the adoption reply modal UI.
   * @returns {void}
   */
  function closeAdoptionReplyModal() {
    const overlay = document.getElementById('adoption-reply-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    selectedAdoptionRequest = null;
    const status = document.getElementById('adoption-reply-status');
    if (status) status.textContent = '';
  }

  /**
   * Opens the adoption reply modal UI.
   * @param {Object} request - Contact request selected by the shelter for reply.
   * @returns {void}
   */
  function openAdoptionReplyModal(request) {
    selectedAdoptionRequest = request;
    const overlay = document.getElementById('adoption-reply-overlay');
    const title = document.getElementById('adoption-reply-title');
    const summary = document.getElementById('adoption-reply-summary');
    const message = document.getElementById('adoption-reply-message');
    const status = document.getElementById('adoption-reply-status');
    if (!overlay || !summary || !message) return;

    if (title) title.textContent = `Rispondi a ${request.requesterUsername}`;
    summary.innerHTML = `
      <div class="comment-meta">
        <span class="comment-user">${escapeHtml(request.animalName)}</span>
        <span class="comment-date">${escapeHtml(request.requesterUsername)}</span>
      </div>
      <div class="comment-text">
        ${escapeHtml(request.message)}
        ${request.requesterEmail ? `<br>Email: ${escapeHtml(request.requesterEmail)}` : ''}
        ${request.requesterPhone ? `<br>Telefono: ${escapeHtml(request.requesterPhone)}` : ''}
      </div>
    `;
    message.value = '';
    if (status) status.textContent = '';
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    message.focus();
  }

  /**
   * Renders rifugio status into the current page.
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
      : 'Aggiungi la posizione del rifugio: puoi cercarla per indirizzo e cittÃ , usare la tua posizione o scegliere un punto sulla mappa.';
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
      if (message) message.textContent = 'Inserisci almeno indirizzo o cittÃ .';
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
      alert('Geolocalizzazione non disponibile nel browser.');
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
      alert('Seleziona un punto sulla mappa');
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
      alert(data.userMessage || data.message || 'Errore salvataggio posizione');
      return;
    }

    const savedCoords = data?.rifugioData?.location?.coordinates;
    if (!Array.isArray(savedCoords) || savedCoords.length !== 2) {
      alert('La posizione non risulta salvata. Riprova.');
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
  async function fetchAdminReports() {
    const res = await fetch('/api/v1/admin/reports', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  /**
   * Fetches pending rifugi data from the API.
   * @returns {Promise<Array<Object>>} Shelter account requests waiting for approval.
   */
  async function fetchPendingRifugi() {
    const res = await fetch('/api/v1/admin/rifugi?status=pending', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  /**
   * Fetches pending readmissions data from the API.
   * @returns {Promise<Array<Object>>} Pending readmission requests for blocked users.
   */
  async function fetchPendingReadmissions() {
    const res = await fetch('/api/v1/admin/readmissions', { headers: authHeader });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  /**
   * Fetches audit logs data from the API.
   * @param {number} limit - Maximum number of audit-log entries to load.
   * @returns {Promise<Array<Object>>} Recent audit-log records.
   */
  async function fetchAuditLogs(limit = 3) {
    const res = await fetch(`/api/v1/admin/audit-logs?limit=${limit}`, { headers: authHeader });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  /**
   * Reads a fetch error response and builds a displayable message.
   * @param {Response} res - Failed fetch response.
   * @param {string} fallback - Message prefix used when the response has no JSON message.
   * @returns {Promise<string>} Error message for alerts or thrown errors.
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
   * Fetches announcement count for a user through the announcements collection endpoint.
   * @param {string} userId - User identifier whose publication count should be loaded.
   * @returns {Promise<number>} Number of announcements published by the user.
   * @throws {Error} When the announcements API rejects the count request.
   */
  async function fetchAdminUserAnnouncementCount(userId) {
    const query = new URLSearchParams({ userId: String(userId), page: '1', limit: '1', status: 'all' }).toString();
    const res = await fetch(`/api/v1/announcements?${query}`, { headers: authHeader });
    if (!res.ok) throw new Error(await readResponseError(res, 'Errore conteggio annunci'));
    const json = await res.json().catch(() => ({}));
    return Number(json?.meta?.totalItems || 0);
  }

  /**
   * Fetches admin user data from the API.
   * @param {string} userId - User identifier to load for admin review.
   * @returns {Promise<Object>} Admin user detail payload enriched with announcement count when available.
   * @throws {Error} When the admin API rejects the user detail request.
   */
  async function fetchAdminUser(userId) {
    const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(userId)}`, { headers: authHeader });
    if (!res.ok) throw new Error(await readResponseError(res, 'Errore recupero account'));
    const user = await res.json();
    try {
      user.publishedAnnouncementsCount = await fetchAdminUserAnnouncementCount(userId);
    } catch (err) {
      console.warn('Errore conteggio annunci account:', err);
    }
    return user;
  }

  /**
   * Closes the admin announcement modal UI.
   * @returns {void}
   */
  function closeAdminAnnouncementModal() {
    const overlay = document.getElementById('admin-announcement-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  /**
   * Closes the admin user modal UI.
   * @returns {void}
   */
  function closeAdminUserModal() {
    const overlay = document.getElementById('admin-user-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  /**
   * Renders admin user modal into the current page.
   * @param {Object} user - User account details loaded for admin review.
   * @returns {void}
   */
  function renderAdminUserModal(user) {
    const overlay = document.getElementById('admin-user-overlay');
    const title = document.getElementById('admin-user-title');
    const body = document.getElementById('admin-user-body');
    if (!overlay || !title || !body) return;

    const warnings = Array.isArray(user?.conductWarnings) ? user.conductWarnings : [];
    const rifugioName = user?.rifugioData?.rifugioName || '';
    title.textContent = user?.username || 'Account';
    body.innerHTML = `
      <div class="admin-warning-count">
        <span class="admin-warning-count__number">${warnings.length}</span>
        <span class="admin-warning-count__label">${warnings.length === 1 ? 'ammonimento ricevuto' : 'ammonimenti ricevuti'}</span>
      </div>
      <dl class="admin-user-details">
        <dt>Username</dt><dd>${displayValue(user?.username)}</dd>
        <dt>Email</dt><dd>${displayValue(user?.email)}</dd>
        <dt>Telefono</dt><dd>${displayValue(user?.phoneNumber)}</dd>
        <dt>Ammonimenti</dt><dd>${warnings.length}</dd>
        <dt>Annunci pubblicati</dt><dd>${Number(user?.publishedAnnouncementsCount || 0)}</dd>
        ${rifugioName ? `<dt>Rifugio</dt><dd>${escapeHtml(rifugioName)}</dd>` : ''}
      </dl>
      <div class="admin-user-actions">
        <a class="btn btn--orange btn--compact" href="/pages/user-announcements.html?userId=${encodeURIComponent(user?._id || '')}&user=${encodeURIComponent(user?.username || 'Account')}">Mostra annunci</a>
        <button class="btn btn--orange btn--compact" data-admin-action="warn-user" data-user-id="${escapeHtml(user?._id || '')}">Avverti</button>
        <button class="btn btn--danger btn--compact" data-admin-action="block-user" data-user-id="${escapeHtml(user?._id || '')}">Blocca account</button>
      </div>
    `;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  /**
   * Opens the admin user modal UI.
   * @param {string} userId - User identifier to load or retrieve from the admin cache.
   * @returns {Promise<void>} Promise resolving after the modal is rendered or an alert is shown.
   * @throws {Error} When no cached data exists and the user fetch fails.
   */
  async function openAdminUserModal(userId) {
    const key = String(userId || '');
    let user = adminUserLookup.get(key);
    if (userId) {
      try {
        const freshUser = await fetchAdminUser(userId);
        user = freshUser;
        adminUserLookup.set(String(freshUser?._id || userId), freshUser);
      } catch (err) {
        if (!user) throw err;
      }
    }
    if (!user) {
      alert('Informazioni account non disponibili');
      return;
    }
    renderAdminUserModal(user);
  }

  /**
   * Sends an admin warning from the report moderation modal.
   * @param {string} userId - User identifier to warn.
   * @returns {Promise<void>} Promise resolving after the warning is sent and cached user data is refreshed.
   * @throws {Error} When the admin API rejects the warning.
   */
  async function warnAdminUser(userId) {
    const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/warnings`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ reason: 'Ammonimento da moderazione report' })
    });
    if (!res.ok) throw new Error(await readResponseError(res, 'Errore ammonimento'));
    const warnedUser = await res.json().catch(() => null);
    if (warnedUser?._id) {
      adminUserLookup.set(String(warnedUser._id), warnedUser);
      renderAdminUserModal(warnedUser);
    }
  }

  /**
   * Blocks a user account from the admin moderation UI.
   * @param {string} userId - User identifier to block.
   * @returns {Promise<Object|undefined>} Blocked user payload, or undefined when the prompt is cancelled.
   * @throws {Error} When the admin API rejects the block request.
   */
  async function blockAdminUser(userId) {
    const reason = prompt('Motivo blocco account:', 'Violazione delle regole della community');
    if (reason === null) return;
    const blockReason = reason.trim() || 'Account bloccato da admin';
    const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: authHeader,
      body: JSON.stringify({ status: 'blocked', reason: blockReason })
    });
    if (!res.ok) throw new Error(await readResponseError(res, 'Errore blocco'));
    const blockedUser = await res.json().catch(() => null);
    if (blockedUser?._id) {
      adminUserLookup.set(String(blockedUser._id), blockedUser);
    }
    closeAdminUserModal();
    return blockedUser;
  }

  /**
   * Renders admin announcement modal into the current page.
   * @param {Object} ann - Announcement details loaded for admin moderation.
   * @returns {void}
   */
  function renderAdminAnnouncementModal(ann) {
    const overlay = document.getElementById('admin-announcement-overlay');
    const title = document.getElementById('admin-announcement-title');
    const gallery = document.getElementById('admin-modal-gallery');
    const body = document.getElementById('admin-announcement-body');
    if (!overlay || !title || !gallery || !body) return;

    const animal = ann?.animalId || {};
    const publisher = ann?.publisherId || {};
    const isQuick = !!ann?.isQuick || !publisher?._id;
    const isLost = ann?.type === 'LostAnimal';
    const isRifugioAnnouncement = publisher?.role === 'shelter';
    const typeLabel = ann?.type === 'LostAnimal' ? 'Smarrito' : 'Avvistamento';
    const dateLabel = ann?.date
      ? new Date(ann.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : (ann?.lastSeenDate ? new Date(ann.lastSeenDate).toLocaleDateString('it-IT') : 'Non disponibile');
    const photoUrl = ann?._id ? `/api/v1/announcements/${encodeURIComponent(ann._id)}/photo` : '';
    const comments = Array.isArray(ann?.comments) ? ann.comments : [];
    const coords = ann?.location?.coordinates;
    const locationInfo = coords?.length === 2
      ? `<dt>Posizione</dt><dd><a class="position-link" href="map.html?highlight=${encodeURIComponent(ann._id)}"><em>trovami</em></a></dd>`
      : '';
    const rifugioAddress = [publisher?.rifugioData?.address, publisher?.rifugioData?.city]
      .filter(Boolean)
      .join(', ');
    const rifugioCoords = publisher?.rifugioData?.location?.coordinates;
    const rifugioLocationHtml = publisher?.role === 'shelter'
      ? `
          ${rifugioAddress ? `<span>${escapeHtml(rifugioAddress)}</span>` : ''}
          ${Array.isArray(rifugioCoords) && rifugioCoords.length === 2 ? `<a href="map.html?rifugioId=${encodeURIComponent(publisher._id)}">Vedi posizione rifugio</a>` : ''}
        `
      : '';

    title.textContent = animal?.name || (isRifugioAnnouncement ? 'Animale in rifugio' : (isLost ? `${animal?.species} smarrito/a` : `Avvistamento: ${animal?.species}`));
    gallery.innerHTML = '<div class="modal-spinner">...</div>';
    (async () => {
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
        gallery.innerHTML = '<div class="modal-no-photo">Non e presente alcuna foto</div>';
      }
    })();

    body.innerHTML = `
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
        <dt>Data</dt><dd>${escapeHtml(dateLabel)}</dd>
        <dt>Condizioni</dt><dd>${displayValue(ann?.healthCondition)}</dd>
        <dt>Comportamento</dt><dd>${displayValue(ann?.animalBehaviour)}</dd>
      </dl>
      <p class="modal-description">${escapeHtml(ann?.description || 'Nessuna descrizione')}</p>

      <section class="comments-section" aria-label="Commenti">
        <div class="comments-header">
          <h3>Commenti</h3>
          <span class="comments-count">${comments.length}</span>
        </div>
        <div id="admin-comments-list" class="comments-list">
          ${renderAdminCommentsHtml(comments)}
        </div>
      </section>

      <div class="modal-contact">
        <strong>Contatto:</strong>
        <span>${isQuick ? 'Segnalazione veloce anonima' : escapeHtml(publisher?.rifugioData?.rifugioName || publisher?.username || '-')}</span>
        ${publisher?.phoneNumber ? `<a href="tel:${publisher.phoneNumber}">${escapeHtml(publisher.phoneNumber)}</a>` : ''}
        ${publisher?.email ? `<a href="mailto:${publisher.email}">${escapeHtml(publisher.email)}</a>` : ''}
        ${rifugioLocationHtml}
      </div>
    `;

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  /**
   * Opens the admin announcement modal UI.
   * @param {string} annId - Announcement identifier to load for admin review.
   * @returns {Promise<void>} Promise resolving after the modal is rendered.
   * @throws {Error} When the announcement cannot be loaded.
   */
  async function openAdminAnnouncementModal(annId) {
    if (!annId) return;
    const res = await fetch(`/api/v1/announcements/${encodeURIComponent(annId)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.userMessage || data.message || 'Errore caricamento annuncio');
    }
    renderAdminAnnouncementModal(await res.json());
  }

  /**
   * Renders admin reports into the current page.
   * @param {Array<Object>} list - Report records returned by the admin API.
   * @returns {void}
   */
  function renderAdminReports(list) {
    const empty = document.getElementById('admin-reports-empty');
    const container = document.getElementById('admin-reports-list');
    if (!empty || !container) return;
    adminUserLookup.clear();
    container.innerHTML = '';
    if (!list.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.forEach((report) => {
      const ann = report.announcementId;
      const publisher = ann?.publisherId;
      const publisherId = publisher?._id || publisher || '';
      const animal = ann?.animalId;
      const isQuick = !!ann?.isQuick || !publisherId;
      if (publisherId && publisher && typeof publisher === 'object') {
        adminUserLookup.set(String(publisherId), publisher);
      }
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.innerHTML = `
        <div class="comment-meta">
          <span class="comment-user">${escapeHtml(report.reason || 'report')}</span>
          <span class="comment-date">${report.createdAt ? new Date(report.createdAt).toLocaleString('it-IT') : ''}</span>
        </div>
        <div class="comment-text">
          ${escapeHtml(report.details || 'Nessun dettaglio')}
          <br>Annuncio: ${escapeHtml(animal?.species || 'non disponibile')} - ${isQuick ? 'segnalazione veloce anonima' : escapeHtml(publisher?.username || 'utente')}
        </div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
          ${ann?._id ? `<button class="btn btn--orange" data-admin-action="view-ann" data-ann-id="${escapeHtml(ann._id)}">Vedi annuncio</button>` : ''}
          ${ann?._id ? `<button class="btn btn--danger" data-admin-action="delete-ann" data-ann-id="${escapeHtml(ann._id)}">Elimina annuncio</button>` : ''}
          ${publisherId ? `<button class="btn btn--orange" data-admin-action="view-user" data-user-id="${escapeHtml(publisherId)}">Visualizza account</button>` : ''}
          <button class="btn btn--orange" data-admin-action="dismiss-report" data-report-id="${escapeHtml(report._id)}">Archivia segnalazione</button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  /**
   * Renders pending rifugi into the current page.
   * @param {Array<Object>} list - Pending shelter accounts awaiting admin approval.
   * @returns {void}
   */
  function renderPendingRifugi(list) {
    const empty = document.getElementById('admin-rifugi-empty');
    const container = document.getElementById('admin-rifugi-list');
    if (!empty || !container) return;
    container.innerHTML = '';
    if (!list.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.forEach((rifugio) => {
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.innerHTML = `
        <div class="comment-meta">
          <span class="comment-user">${escapeHtml(rifugio.rifugioData?.rifugioName || rifugio.username)}</span>
          <span class="comment-date">${rifugio.createdAt ? new Date(rifugio.createdAt).toLocaleDateString('it-IT') : ''}</span>
        </div>
        <div class="comment-text">
          ${escapeHtml(rifugio.email || '')}
          ${rifugio.rifugioData?.address ? `<br>${escapeHtml(rifugio.rifugioData.address)}` : ''}
          ${rifugio.rifugioData?.description ? `<br>${escapeHtml(rifugio.rifugioData.description)}` : ''}
        </div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn--primary" data-admin-action="approve-rifugio" data-user-id="${escapeHtml(rifugio._id)}">Approva</button>
          <button class="btn btn--danger" data-admin-action="reject-rifugio" data-user-id="${escapeHtml(rifugio._id)}">Rifiuta</button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  /**
   * Renders pending readmissions into the current page.
   * @param {Array<Object>} list - Blocked users with pending readmission requests.
   * @returns {void}
   */
  function renderPendingReadmissions(list) {
    const empty = document.getElementById('admin-readmissions-empty');
    const container = document.getElementById('admin-readmissions-list');
    if (!empty || !container) return;
    container.innerHTML = '';
    if (!list.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.forEach((user) => {
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.innerHTML = `
        <div class="comment-meta">
          <span class="comment-user">${escapeHtml(user.username || user.email || 'Account')}</span>
          <span class="comment-date">${user.readmissionRequest?.requestedAt ? new Date(user.readmissionRequest.requestedAt).toLocaleString('it-IT') : ''}</span>
        </div>
        <div class="comment-text">
          ${escapeHtml(user.readmissionRequest?.message || '')}
          ${user.email ? `<br>${escapeHtml(user.email)}` : ''}
        </div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn--primary" data-admin-action="approve-readmission" data-user-id="${escapeHtml(user._id)}">Approva riammissione</button>
          <button class="btn btn--danger" data-admin-action="reject-readmission" data-user-id="${escapeHtml(user._id)}">Rifiuta</button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  /**
   * Renders audit logs into the current page.
   * @param {Array<Object>} list - Audit-log records returned by the admin API.
   * @returns {void}
   */
  function renderAuditLogs(list) {
    const section = document.getElementById('admin-audit-section');
    const empty = document.getElementById('admin-audit-empty');
    const container = document.getElementById('admin-audit-list');
    if (!section || !empty || !container) return;

    section.style.display = 'block';
    container.innerHTML = '';
    if (!list || list.length === 0) {
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    list.forEach((log) => {
      const when = log?.createdAt ? new Date(log.createdAt).toLocaleString('it-IT') : '';
      const target = log?.targetUsername ? ` verso ${log.targetUsername}` : '';
      const item = document.createElement('div');
      item.className = 'comment-item audit-log-item';
      item.innerHTML = `
        <div class="comment-meta">
          <span class="comment-user">${escapeHtml(log?.actorName || 'anonimo')}</span>
          <span class="comment-date">${escapeHtml(when)}</span>
        </div>
        <div class="comment-text">${escapeHtml(log?.action || '')}${escapeHtml(target)}</div>
      `;
      container.appendChild(item);
    });
  }

  /**
   * Loads all admin dashboard panels and renders their current data.
   * @returns {Promise<void>} Promise resolving after admin panels are updated.
   */
  async function loadAdminData() {
    if (currentUser?.role !== 'admin') return;
    const section = document.getElementById('admin-section');
    if (section) section.style.display = 'block';
    const [reports, rifugi, readmissions, auditLogs] = await Promise.all([fetchAdminReports(), fetchPendingRifugi(), fetchPendingReadmissions(), fetchAuditLogs(3)]);
    renderAdminReports(reports);
    renderPendingRifugi(rifugi);
    renderPendingReadmissions(readmissions);
    renderAuditLogs(auditLogs);
  }

  /**
   * Loads the profile page data and renders role-specific sections.
   * @returns {Promise<void>} Promise resolving after the profile view is initialized.
   */
  async function load() {
    const me = await fetchMe();
    if (!me) { localStorage.removeItem('token'); window.location.href = '/pages/login.html'; return; }
    currentUser = me;

    document.getElementById('username').value = me.username || '';
    document.getElementById('email').value = me.email || '';
    document.getElementById('phoneNumber').value = me.phoneNumber || '';

    document.getElementById('showEmail').checked = me.contactVisibility?.showEmail !== false;
    document.getElementById('showPhone').checked = me.contactVisibility?.showPhone !== false;
    document.getElementById('emailOnComment').checked = !!me.notificationPrefs?.emailOnComment;
    renderRifugioStatus(me);
    renderRifugioPosition(me);

    

    await refreshNotifications();
    window.dispatchEvent(new Event('notifications:updated'));
    await loadAdminData();

    await loadMyAnnouncements();
    await loadMyAnimals();
    await loadContactRequests();
    await loadFollowedShelters();

    if (autoOpenNewAnnouncement) {
      openModalForCreate();
    }
  }

  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (saveProfileButton.disabled) return;

    const updates = {
      username: document.getElementById('username').value,
      phoneNumber: document.getElementById('phoneNumber').value,
      contactVisibility: {
        showEmail: !!document.getElementById('showEmail').checked,
        showPhone: !!document.getElementById('showPhone').checked
      },
      notificationPrefs: {
        emailOnComment: !!document.getElementById('emailOnComment').checked
      }
    };
    const res = await fetch('/api/v1/users/me', { method: 'PUT', headers: authHeader, body: JSON.stringify(updates) });
    const data = await res.json();
    document.getElementById('profileMessage').textContent = res.ok ? 'Profilo aggiornato' : (data.userMessage || data.message || 'Errore');
    if (res.ok) setProfileEditing(false);
  });

  editProfileButton.addEventListener('click', () => {
    document.getElementById('profileMessage').textContent = '';
    setProfileEditing(true);
    document.getElementById('username').focus();
  });

  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  document.getElementById('notificationsReadAll')?.addEventListener('click', async () => {
    await markAllNotificationsRead();
    window.dispatchEvent(new Event('notifications:updated'));
  });

  window.removeEventListener('notifications:updated', refreshNotifications);
  window.addEventListener('notifications:updated', refreshNotifications);
  if (notificationsRefreshTimer) clearInterval(notificationsRefreshTimer);
  notificationsRefreshTimer = setInterval(refreshNotifications, 15000);

  document.getElementById('contactRequestsRefresh')?.addEventListener('click', loadContactRequests);
  document.getElementById('followed-shelters-list')?.addEventListener('click', async (e) => {
    const button = e.target?.closest?.('[data-follow-action="unfollow"]');
    if (!button) return;
    const shelterId = button.dataset.shelterId;
    if (!shelterId) return;
    button.disabled = true;
    try {
      await unfollowShelter(shelterId);
      await loadFollowedShelters();
    } catch (err) {
      alert(err.message || 'Errore');
      button.disabled = false;
    }
  });
  document.getElementById('clearRepliedAdoptionRequests')?.addEventListener('click', async () => {
    try {
      await clearRepliedAdoptionRequests();
      await loadContactRequests();
    } catch (err) {
      alert(err.message || 'Errore svuotamento richieste');
    }
  });
  document.getElementById('contact-requests-list')?.addEventListener('click', (e) => {
    const button = e.target?.closest?.('[data-adoption-action="open-reply"]');
    if (!button) return;
    const item = button.closest('.contact-request-item');
    if (!item?.dataset?.request) return;
    openAdoptionReplyModal(JSON.parse(item.dataset.request));
  });
  document.getElementById('adoption-reply-close')?.addEventListener('click', closeAdoptionReplyModal);
  document.getElementById('adoption-reply-cancel')?.addEventListener('click', closeAdoptionReplyModal);
  document.getElementById('adoption-reply-overlay')?.addEventListener('click', (e) => {
    if (e.target?.id === 'adoption-reply-overlay') closeAdoptionReplyModal();
  });
  document.getElementById('adoption-reply-send')?.addEventListener('click', async () => {
    const textarea = document.getElementById('adoption-reply-message');
    const hint = document.getElementById('adoption-reply-status');
    const replyMessage = textarea?.value.trim() || '';
    if (!replyMessage) {
      if (hint) hint.textContent = 'Scrivi una risposta.';
      return;
    }
    if (hint) hint.textContent = 'Invio...';
    try {
      await replyToContactRequest(selectedAdoptionRequest._id, replyMessage);
      closeAdoptionReplyModal();
      await loadContactRequests();
    } catch (err) {
      if (hint) hint.textContent = err.message || 'Errore invio risposta';
    }
  });

  document.getElementById('adminRefresh')?.addEventListener('click', loadAdminData);
  document.getElementById('admin-announcement-close')?.addEventListener('click', closeAdminAnnouncementModal);
  document.getElementById('admin-announcement-overlay')?.addEventListener('click', (e) => {
    if (e.target?.id === 'admin-announcement-overlay') closeAdminAnnouncementModal();
  });
  document.getElementById('admin-user-close')?.addEventListener('click', closeAdminUserModal);
  document.getElementById('admin-user-overlay')?.addEventListener('click', async (e) => {
    const button = e.target?.closest?.('[data-admin-action]');
    if (button) {
      try {
        if (button.dataset.adminAction === 'warn-user') await warnAdminUser(button.dataset.userId);
        if (button.dataset.adminAction === 'block-user') {
          await blockAdminUser(button.dataset.userId);
          await loadAdminData();
          await loadMyAnnouncements();
        }
      } catch (err) {
        alert(err.message || 'Errore moderazione');
      }
      return;
    }
    if (e.target?.id === 'admin-user-overlay') closeAdminUserModal();
  });
  document.getElementById('editRifugioPosition')?.addEventListener('click', openRifugioPositionEditor);
  document.getElementById('saveRifugioPosition')?.addEventListener('click', saveRifugioPosition);
  document.getElementById('searchRifugioPosition')?.addEventListener('click', searchRifugioPosition);
  document.getElementById('useRifugioLocation')?.addEventListener('click', useRifugioCurrentLocation);

  document.getElementById('admin-section')?.addEventListener('click', async (e) => {
    const button = e.target?.closest?.('[data-admin-action]');
    if (!button) return;
    const action = button.dataset.adminAction;

    try {
      if (action === 'view-ann') {
        await openAdminAnnouncementModal(button.dataset.annId);
        return;
      }

      if (action === 'view-user') {
        await openAdminUserModal(button.dataset.userId);
        return;
      }

      if (action === 'delete-ann') {
        const annId = button.dataset.annId;
        const reason = prompt('Motivo rimozione annuncio:', 'annuncio falso/offensivo');
        if (reason === null) return;
        const deleteReason = reason.trim() || 'violazione delle regole';
        const res = await fetch(`/api/v1/admin/announcements/${encodeURIComponent(annId)}`, {
          method: 'DELETE',
          headers: authHeader,
          body: JSON.stringify({ reason: deleteReason })
        });
        if (!res.ok) {
          const data = await res.json().catch(()=>({}));
          throw new Error(data.userMessage || data.message || 'Errore eliminazione');
        }
      }

      if (action === 'block-user') {
        await blockAdminUser(button.dataset.userId);
      }

      if (action === 'warn-user') {
        await warnAdminUser(button.dataset.userId);
      }

      if (action === 'dismiss-report') {
        const reportId = button.dataset.reportId;
        const res = await fetch(`/api/v1/admin/reports/${encodeURIComponent(reportId)}`, {
          method: 'PATCH',
          headers: authHeader,
          body: JSON.stringify({ status: 'DISMISSED', details: 'Archiviato da admin' })
        });
        if (!res.ok) {
          const data = await res.json().catch(()=>({}));
          throw new Error(data.userMessage || data.message || 'Errore archiviazione');
        }
      }

      if (action === 'approve-readmission' || action === 'reject-readmission') {
        const userId = button.dataset.userId;
        const verb = action === 'approve-readmission' ? 'approve' : 'reject';
        const res = await fetch(`/api/v1/admin/readmissions/${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: authHeader,
          body: JSON.stringify({ status: verb === 'approve' ? 'approved' : 'rejected' })
        });
        if (!res.ok) throw new Error(await readResponseError(res, 'Errore riammissione'));
      }

      if (action === 'approve-rifugio' || action === 'reject-rifugio') {
        const userId = button.dataset.userId;
        const verb = action === 'approve-rifugio' ? 'approve' : 'reject';
        const body = action === 'reject-rifugio'
          ? { rifugioStatus: 'rejected', reason: prompt('Motivo rifiuto:', 'Dati insufficienti') || 'Dati insufficienti' }
          : { rifugioStatus: 'approved' };
        const res = await fetch(`/api/v1/admin/rifugi/${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: authHeader,
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const data = await res.json().catch(()=>({}));
          throw new Error(data.userMessage || data.message || 'Errore richiesta rifugio');
        }
      }

      await loadAdminData();
      await loadMyAnnouncements();
    } catch (err) {
      alert(err.message || 'Errore moderazione');
    }
  });

  document.getElementById('showCreate').addEventListener('click', (e) => {
    e.preventDefault();
    if (currentUser?.role === 'shelter' && currentUser?.rifugioStatus !== 'approved') {
      alert('Il tuo account rifugio deve essere approvato da un admin prima di pubblicare annunci.');
      return;
    }
    if (currentUser?.role === 'shelter' && !getRifugioCoordinates()) {
      alert('Prima salva la posizione del rifugio nella sezione Dati profilo.');
      openRifugioPositionEditor();
      return;
    }
    openModalForCreate();
  });


  document.getElementById('deleteAccount')?.addEventListener('click', async () => {
    const confirmed = await showProfileConfirm({
      title: 'Elimina account',
      message: 'Sei sicuro di voler eliminare definitivamente il tuo account? Questa azione non Ã¨ reversibile.',
      confirmLabel: 'Elimina',
      danger: true
    });
    if (!confirmed) return;
    const res = await fetch('/api/v1/users/me', { method: 'DELETE', headers: authHeader });
    if (!res.ok) {
      const d = await res.json().catch(()=>({}));
      alert(d.userMessage || d.message || 'Errore eliminazione account');
      return;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    alert('Account eliminato');
    window.location.href = '/';
  });
  /**
   * Loads my announcements data and updates the UI.
   * @returns {Promise<void>} Promise resolving after the current user's announcement grid is rendered.
   */
  async function loadMyAnnouncements() {
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
      <div class="card-image"><div class="card-image-placeholder"><span>â€¦</span></div></div>
      <div class="card-body">
        <div class="profile-announcement-card__meta">
          <span class="profile-announcement-status ${statusClass}">${statusLabel}</span>
          <span class="profile-announcement-kind">Il tuo annuncio</span>
        </div>
        <h3 class="card-breed profile-announcement-card__title">${titleText}</h3>
        <p class="card-description profile-announcement-card__description">${escapeHtml(a.description || 'Nessuna descrizione disponibile.')}</p>
        <div class="profile-announcement-card__actions">
          <button data-id="${a._id}" class="edit btn btn--ghost profile-announcement-card__button">Modifica</button>
          ${a.status !== 'RESOLVED' ? `<button data-id="${a._id}" class="close btn btn--ghost profile-announcement-card__button">Chiudi</button>` : ''}
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
        if (placeholder) placeholder.innerHTML = 'ðŸ¾';
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
          message: 'Segni l\'annuncio come risolto? Non comparirÃ  piÃ¹ nella lista pubblica.',
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
          alert('Errore chiusura');
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
            alert(d.userMessage || d.message || ('Errore eliminazione (' + res.status + ')'));
          }
        } catch (err) {
          alert('Errore di rete: ' + (err.message || err));
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
    if (!section || !grid || !counter) return;
    if (currentUser?.role !== 'shelter') {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    try {
      const res = await fetch(`${API_ANIMALS}?shelterId=${encodeURIComponent(currentUser._id)}`, { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } });
      if (!res.ok) throw new Error('Errore recupero animali');
      const payload = await res.json();
      const list = Array.isArray(payload) ? payload : payload.data || [];
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
      list.forEach(a => {
        const card = grid.querySelector(`.card[data-id="${a._id}"]`);
        if (!card) return;
        const container = card.querySelector('.card-image');
        const placeholder = container.querySelector('.card-image-placeholder');
        const photo = Array.isArray(a.photos) && a.photos.length ? a.photos[0] : null;
        if (!photo) {
          if (placeholder) placeholder.innerHTML = 'ðŸ¾';
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
            if (placeholder) placeholder.innerHTML = 'ðŸ¾';
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
      counter.textContent = '0 animali';
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
        el.style.padding = '6px 0';
        el.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted)">${escapeHtml(new Date(n.createdAt).toLocaleString())}</div><div>${escapeHtml(n.text)}</div>`;
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
          alert(err.message || 'Errore salvataggio');
        }
      };

    } catch (err) {
      alert(err.message || 'Errore apertura scheda animale');
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
      alert('Annuncio non trovato');
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
        gallery.innerHTML = '<div class="view-modal-no-photo">Non Ã¨ presente alcuna foto</div>';
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
              alert(d.userMessage || d.message || ('Errore generazione volantino (' + res.status + ')'));
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
            alert('Errore generazione volantino: ' + (err.message || err));
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
          <div class="card-image-placeholder"><span>â€¦</span></div>
          <span class="badge badge--${isLost ? 'lost' : 'sighting'}">
            ${isLost ? 'Smarrito' : 'Avvistato'}
          </span>
          ${score ? `<span class="badge badge--score" style="right:10px;left:auto;">${escapeHtml(score)}</span>` : ''}
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

  setProfileEditing(false);
  load();

  document.getElementById('pickOnMap').addEventListener('click', () => {
    showMapPicker();
  });

  document.getElementById('useMyLocation').addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Geolocalizzazione non disponibile nel browser.');
      return;
    }

    showMapPicker();

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordsFromLatLng(latitude, longitude);
        requestAnimationFrame(() => mapInstance && mapInstance.invalidateSize());
      },
      (error) => {
        console.error('Geolocation error:', error);
        let msg = 'Errore nella geolocalizzazione.';
        if (error.code === error.PERMISSION_DENIED) msg = 'Permesso negato per la geolocalizzazione.';
        if (error.code === error.POSITION_UNAVAILABLE) msg = 'Posizione non disponibile.';
        if (error.code === error.TIMEOUT) msg = 'Timeout della richiesta di posizione.';
        alert(msg);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  });

  document.getElementById('modal-photo-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    const img = document.getElementById('modal-photo-preview');
    if (!file) { img.style.display='none'; img.src=''; return; }
    img.src = URL.createObjectURL(file);
    img.style.display = 'block';
  });

  document.getElementById('lastSeenTodayBtn').addEventListener('click', () => {
    setLastSeenMode('today');
  });

  document.getElementById('lastSeenCustomBtn').addEventListener('click', () => {
    setLastSeenMode('custom');
  });

  document.getElementById('modal-close').addEventListener('click', ()=> showModal(false));
  document.getElementById('modal-cancel').addEventListener('click', ()=> showModal(false));
  document.getElementById('modal-type')?.addEventListener('change', (event) => {
    configureModalFieldsForType(event.target.value);
  });

  document.getElementById('view-modal-close')?.addEventListener('click', () => {
    document.getElementById('view-modal-overlay').style.display = 'none';
    document.body.style.overflow = '';
  });

  document.getElementById('view-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.style.display = 'none';
      document.body.style.overflow = '';
    }
  });

  document.getElementById('modal-save').addEventListener('click', async () => {
    const type = document.getElementById('modal-type').value;
    const description = document.getElementById('modal-description').value.trim();
    const animalName = document.getElementById('modal-animalName')?.value.trim() || null;
    const species = document.getElementById('modal-species').value.trim();
    const breed = document.getElementById('modal-breed').value.trim() || 'Non specificato';
    const color = document.getElementById('modal-color').value.trim();
    const gender = document.getElementById('modal-gender').value || 'Sconosciuto';
    const lunghezzaPelo = document.getElementById('modal-lunghezzaPelo').value || null;
    const distinctiveFeatures = document.getElementById('modal-distinctiveFeatures').value.trim();
    const microchipId = document.getElementById('modal-microchipId')?.value.trim() || null;
    const photoFile = document.getElementById('modal-photo-file').files[0];
    const coordsRawInput = document.getElementById('modal-coords').value.trim();
    const coordsRaw = normalizeCoordsFromInput(coordsRawInput);

    if (!type || !species || !color) {
      alert('Compila i campi obbligatori: Tipo, Specie e Colore.');
      return;
    }

    const modalForm = document.getElementById('modalForm');
    if (modalForm && !modalForm.reportValidity()) {
      return;
    }

    if (type === 'LostAnimal' && !animalName) {
      alert('Per un annuncio di smarrimento il nome dell animale Ã¨ obbligatorio se lo conosci.');
      return;
    }

    if (!coordsRaw || coordsRaw.length !== 2 || isNaN(coordsRaw[0]) || isNaN(coordsRaw[1])) {
      alert('Inserisci coordinate valide');
      return;
    }

    setAnnouncementSavingState(true);

    try {
      const animalPayload = {
        name: animalName || undefined,
        species,
        breed,
        gender,
        color,
        lunghezzaPelo,
        distinctiveFeatures,
        microchipId: currentUser?.role === 'shelter' ? microchipId : undefined
      };
      const adoptionStatus = document.getElementById('modal-adoptionStatus')?.value || 'none';
      animalPayload.adoptable = currentUser?.role === 'shelter' && adoptionStatus === 'adoptable';

      const lastSeenMode = document.getElementById('lastSeenCustomBtn').classList.contains('is-selected') ? 'custom' : 'today';
      const customDate = document.getElementById('modal-lastSeenDate').value;
      let lastSeenDate = null;
      if (lastSeenMode === 'today') {
        lastSeenDate = new Date().toISOString();
      } else if (customDate) {
        lastSeenDate = new Date(customDate).toISOString();
      }

      const animalBehaviour = document.getElementById('modal-animalBehaviour').value || null;
      const healthCondition = document.getElementById('modal-healthCondition').value || null;
      const isCurrentlyThereEl = document.getElementById('modal-isCurrentlyThere');
      const isCurrentlyThere = isCurrentlyThereEl ? !!isCurrentlyThereEl.checked : currentEditIsCurrentlyThere;
      const status = editingId ? (currentEditStatus || 'ACTIVE') : 'ACTIVE';

      const animalHeaders = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
      let animalIdToUse = editingAnimalId || null;

      if (editingId) {
        if (animalIdToUse) {
          const aRes = await fetch(`/api/v1/animals/${animalIdToUse}`, {
            method: 'PUT',
            headers: animalHeaders,
            body: JSON.stringify(animalPayload)
          });
          if (!aRes.ok) throw new Error('Errore aggiornamento animale');
          const aData = await aRes.json();
          animalIdToUse = aData._id;
        } else {
          const animalRes = await fetch('/api/v1/animals', {
            method: 'POST',
            headers: animalHeaders,
            body: JSON.stringify(animalPayload)
          });
          if (!animalRes.ok) throw new Error('Errore creazione animale');
          const animal = await animalRes.json();
          animalIdToUse = animal._id;
        }
      } else {
        const animalRes = await fetch('/api/v1/animals', {
          method: 'POST',
          headers: animalHeaders,
          body: JSON.stringify(animalPayload)
        });
        if (!animalRes.ok) throw new Error('Errore creazione animale');
        const animal = await animalRes.json();
        animalIdToUse = animal._id;
      }

      const body = {
        type,
        animalId: animalIdToUse,
        description: description || 'Nessuna descrizione',
        lastSeenDate: lastSeenDate || undefined,
        animalBehaviour: animalBehaviour || undefined,
        healthCondition: healthCondition || undefined,
        status
      };

      const loc = { coordinates: [coordsRaw[0], coordsRaw[1]] };

      let res;
      if (!editingId) {
        if (photoFile) {
          const fd = new FormData();
          fd.append('type', type);
          fd.append('animalId', animalIdToUse);
          if (animalName) fd.append('name', animalName);
          fd.append('description', body.description);
          fd.append('coordinates', loc.coordinates.join(','));
          if (lastSeenDate) fd.append('lastSeenDate', lastSeenDate);
          if (animalBehaviour) fd.append('animalBehaviour', animalBehaviour);
          if (healthCondition) fd.append('healthCondition', healthCondition);
          fd.append('status', status);
          fd.append('photo', photoFile);
          res = await fetch('/api/v1/announcements', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: fd
          });
        } else {
          res = await fetch('/api/v1/announcements', {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({ ...body, coordinates: loc.coordinates })
          });
        }
        if (!res.ok) throw new Error('Errore creazione annuncio');
      } else if (photoFile) {
        const fd = new FormData();
        for (const k of ['type', 'description']) fd.append(k, body[k]);
        if (animalName) fd.append('name', animalName);
        fd.append('location', JSON.stringify({ type: 'Point', coordinates: loc.coordinates }));
        if (body.lastSeenDate) fd.append('lastSeenDate', body.lastSeenDate);
        fd.append('isCurrentlyThere', String(isCurrentlyThere));
        if (animalBehaviour) fd.append('animalBehaviour', animalBehaviour);
        if (healthCondition) fd.append('healthCondition', healthCondition);
        fd.append('status', status);
        fd.append('photo', photoFile);
        res = await fetch(`/api/v1/announcements/${editingId}`, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token },
          body: fd
        });
        if (!res.ok) throw new Error('Errore aggiornamento annuncio');
      } else {
        res = await fetch(`/api/v1/announcements/${editingId}`, {
          method: 'PUT',
          headers: authHeader,
          body: JSON.stringify({
            ...body,
            isCurrentlyThere,
            location: { type: 'Point', coordinates: loc.coordinates }
          })
        });
        if (!res.ok) throw new Error('Errore aggiornamento annuncio');
      }

      showModal(false);
      loadMyAnnouncements();
      try { localStorage.setItem('announcements:update', Date.now().toString()); } catch (e) {}
    } catch (error) {
      console.error('Save announcement error:', error);
      alert(error?.message || 'Errore salvataggio annuncio');
    } finally {
      setAnnouncementSavingState(false);
    }
  });

  document.addEventListener('click', async (e) => {
    const el = e.target;
    if (el.classList.contains('edit')) {
      const id = el.dataset.id;
      const res = await fetch(`/api/v1/announcements/${id}`);
      if (!res.ok) { alert('Errore caricamento annuncio'); return; }
      const ann = await res.json();
      openModalForEdit(ann);
    }
  });


  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const overlay = document.getElementById('view-modal-overlay');
    if (overlay && overlay.style.display !== 'none') {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  });

});


/**
 * Parses modal coordinate text into GeoJSON coordinate order.
 * @param {string} input - Coordinate input in decimal or DMS notation.
 * @returns {number[]|null} `[longitude, latitude]` coordinates, or null when parsing fails.
 */
function normalizeCoordsFromInput(input) {
  if (!input) return null;
  /**
   * Parses a DMS coordinate fragment while suppressing parser errors.
   * @param {string} str - DMS latitude or longitude fragment.
   * @returns {number|null} Decimal coordinate, or null when parsing fails.
   */
  const tryDms = (str) => {
    try {
      return dmsToDecimal(str);
    } catch (e) { return null; }
  };

  let a = null, b = null;
  if (/[Â°'"NSWE]/i.test(input)) {
    const raw = input.split(',');
    if (raw.length !== 2) return null;
    const p1 = tryDms(raw[0].trim());
    const p2 = tryDms(raw[1].trim());
    if (p1 == null || p2 == null) return null;
    a = p1; b = p2; // these are decimal degrees; order may be lat/lng or lng/lat depending on input
  } else {
    const parts = input.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (parts.length !== 2) return null;
    [a, b] = parts;
  }
  const isA_lat = a >= 35 && a <= 47;
  const isB_lat = b >= 35 && b <= 47;
  if (isA_lat && !isB_lat) return [b, a];
  if (!isA_lat && isB_lat) return [a, b];
  return [a, b];
}

/**
 * Converts a DMS or decimal coordinate string to a decimal number.
 * @param {string} str - Coordinate string, optionally including hemisphere letters.
 * @returns {number|null} Decimal coordinate, or null when the input cannot be parsed.
 */
function dmsToDecimal(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  let hemi = null;
  const m = s.match(/[NnSsEeWw]/);
  if (m) hemi = m[0].toUpperCase();
  const cleaned = s.replace(/[NnSsEeWw]/g, '').trim();
  const dmsMatch = cleaned.match(/(\d+)[Â°\s]+(\d+)[\'\s]+(\d+(?:\.\d+)?)[\"\s]*/);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3]);
    let dec = deg + (min/60) + (sec/3600);
    if (hemi === 'S' || hemi === 'W') dec = -dec;
    return dec;
  }
  const dmMatch = cleaned.match(/(\d+)[Â°\s]+(\d+(?:\.\d+)?)[\'\s]*/);
  if (dmMatch) {
    const deg = parseFloat(dmMatch[1]);
    const min = parseFloat(dmMatch[2]);
    let dec = deg + (min/60);
    if (hemi === 'S' || hemi === 'W') dec = -dec;
    return dec;
  }
  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    let dec = num;
    if (hemi === 'S' || hemi === 'W') dec = -dec;
    return dec;
  }
  return null;
}

/**
 * Converts a decimal coordinate to a DMS string with hemisphere suffix.
 * @param {number} dec - Decimal coordinate value.
 * @param {string} type - Coordinate axis, either `lat` or `lng`.
 * @returns {string} DMS coordinate string, or an empty string for invalid values.
 */
function decimalToDMS(dec, type) {
  if (dec === null || dec === undefined || isNaN(dec)) return '';
  const abs = Math.abs(dec);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(2);
  let hemi = '';
  if (type === 'lat') hemi = dec >= 0 ? 'N' : 'S';
  if (type === 'lng') hemi = dec >= 0 ? 'E' : 'W';
  return `${deg}Â°${min}'${sec}"${hemi}`;
}

/**
 * Opens the modal for create UI.
 * @returns {void}
 */
function openModalForCreate() {
  editingId = null;
  currentEditStatus = 'ACTIVE';
  currentEditIsCurrentlyThere = false;
  document.getElementById('modal-title').textContent = 'Nuovo annuncio';
  document.getElementById('modal-save').textContent = 'Pubblica';
  configureModalLabelsForAccount();
  configureTypeFieldForAccount('LostAnimal');
  document.getElementById('modal-description').value = '';
  document.getElementById('modal-animalName').value = '';
  wizApplyChipValue('modal-species', 'Cane');
  document.getElementById('modal-breed').value = '';
  wizSetColor('Nero', document.querySelector('.color-swatch[title="Nero"]') || document.querySelector('.color-swatch.active') || document.querySelector('.color-swatch'));
  wizApplyChipValue('modal-gender', 'Sconosciuto');
  document.getElementById('modal-lunghezzaPelo').value = '';
  document.getElementById('modal-distinctiveFeatures').value = '';
  document.getElementById('modal-microchipId').value = '';
  document.getElementById('modal-photo-file').value = '';
  document.getElementById('modal-photo-preview').style.display = 'none';
  const rifugioCoords = currentUser?.role === 'shelter' ? getRifugioCoordinates() : null;
  document.getElementById('modal-coords').value = rifugioCoords ? rifugioCoords.join(',') : '';
  setLastSeenMode('today');
  document.getElementById('modal-lastSeenDate').value = '';
  document.getElementById('modal-lastSeenDate').style.display = 'none';
  document.getElementById('modal-animalBehaviour').value = 'indifferente';
  document.getElementById('modal-healthCondition').value = 'in salute';
  configureModalFieldsForType(document.getElementById('modal-type')?.value || 'LostAnimal');
  const adoptionSelect = document.getElementById('modal-adoptionStatus');
  if (adoptionSelect) {
    adoptionSelect.value = 'none';
    adoptionSelect.disabled = currentUser?.role !== 'shelter';
  }
  showModal(true);
}

/**
 * Opens the modal for edit UI.
 * @param {Object} ann - Announcement being edited.
 * @returns {void}
 */
function openModalForEdit(ann) {
  editingId = ann._id;
  editingAnimalId = ann.animalId?._id || ann.animalId || null;
  currentEditStatus = ann.status || 'ACTIVE';
  currentEditIsCurrentlyThere = !!ann.isCurrentlyThere;
  document.getElementById('modal-title').textContent = 'Modifica annuncio';
  document.getElementById('modal-save').textContent = 'Modifica';
  configureModalLabelsForAccount();
  configureTypeFieldForAccount(ann.type || 'LostAnimal');
  document.getElementById('modal-description').value = ann.description || '';
  document.getElementById('modal-animalName').value = ann.animalId?.name || '';
  wizApplyChipValue('modal-species', ann.animalId?.species || '');
  document.getElementById('modal-breed').value = ann.animalId?.breed || '';
  document.getElementById('modal-color').value = ann.animalId?.color || '';
  wizApplyChipValue('modal-gender', ann.animalId?.gender || 'Sconosciuto');
  document.getElementById('modal-lunghezzaPelo').value = ann.animalId?.lunghezzaPelo || '';
  document.getElementById('modal-distinctiveFeatures').value = ann.animalId?.distinctiveFeatures || '';
  document.getElementById('modal-microchipId').value = ann.animalId?.microchipId || '';
  const photo = ann.animalId?.photos?.[0] || '';
  document.getElementById('modal-photo-file').value = '';
  const preview = document.getElementById('modal-photo-preview');
  if (photo) {
    preview.src = photo;
    preview.style.display = 'block';
  } else {
    preview.src = '';
    preview.style.display = 'none';
  }
  const coords = ann.location?.coordinates;
  if (coords) {
    const lng = coords[0]; const lat = coords[1];
    document.getElementById('modal-coords').value = `${decimalToDMS(lat,'lat')}, ${decimalToDMS(lng,'lng')}`;
  } else {
    document.getElementById('modal-coords').value = '';
  }
  if (ann.lastSeenDate) {
    document.getElementById('modal-lastSeenDate').value = new Date(ann.lastSeenDate).toISOString().slice(0,10);
    setLastSeenMode('custom');
  } else {
    document.getElementById('modal-lastSeenDate').value = '';
    setLastSeenMode('today');
  }
  document.getElementById('modal-animalBehaviour').value = ann.animalBehaviour || 'indifferente';
  document.getElementById('modal-healthCondition').value = ann.healthCondition || 'in salute';
  configureModalFieldsForType(ann.type || 'LostAnimal');
  const adoptionSelectEdit = document.getElementById('modal-adoptionStatus');
  if (adoptionSelectEdit) {
    adoptionSelectEdit.value = ann.animalId?.adoptable && currentUser?.role === 'shelter' ? 'adoptable' : 'none';
    adoptionSelectEdit.disabled = currentUser?.role !== 'shelter';
  }
  showModal(true);
}

/**
 * Shows or hides the announcement editor modal.
 * @param {boolean} visible - Whether the modal should be visible.
 * @returns {void}
 */
function showModal(visible) {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = visible ? 'flex' : 'none';
  document.body.style.overflow = visible ? 'hidden' : '';
  if (!visible) destroyMapPicker();
}

/**
 * Initializes the Leaflet map used to pick announcement coordinates.
 * @returns {void}
 */
function initMapPicker() {
  if (mapInstance) return;
  mapInstance = L.map('modal-map').setView([46.0667,11.1333], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(mapInstance);
  mapInstance.on('click', function(e){
    const { lat, lng } = e.latlng;
    setCoordsFromLatLng(lat, lng);
  });
  requestAnimationFrame(() => mapInstance.invalidateSize());
}

/**
 * Destroys the announcement coordinate picker map and clears its marker.
 * @returns {void}
 */
function destroyMapPicker() {
  if (!mapInstance) return;
  mapInstance.off();
  mapInstance.remove();
  mapInstance = null;
  mapMarker = null;
  document.getElementById('modal-map').style.display = 'none';
}

/**
 * Sets marker.
 * @param {number} lng - Selected longitude.
 * @param {number} lat - Selected latitude.
 * @returns {void}
 */
function setMarker(lng, lat){
  if (!mapInstance) initMapPicker();
  if (mapMarker) mapMarker.setLatLng([lat,lng]); else mapMarker = L.marker([lat,lng]).addTo(mapInstance);
  mapInstance.setView([lat,lng], 15);
  document.getElementById('modal-map').style.display = 'block';
  requestAnimationFrame(() => mapInstance && mapInstance.invalidateSize());
}

/**
 * Sets coords from lat lng.
 * @param {number} lat - Selected latitude.
 * @param {number} lng - Selected longitude.
 * @returns {void}
 */
function setCoordsFromLatLng(lat, lng) {
  setMarker(lng, lat);
  document.getElementById('modal-coords').value = `${decimalToDMS(lat,'lat')}, ${decimalToDMS(lng,'lng')}`;
}

/**
 * Shows the announcement coordinate picker map and refreshes its layout.
 * @returns {void}
 */
function showMapPicker() {
  const mapEl = document.getElementById('modal-map');
  mapEl.style.display = 'block';
  if (!mapInstance) {
    initMapPicker();
  } else {
    mapInstance.invalidateSize();
  }
}

let wizStep = 1;
	const maxSteps = 4;

	function wizUpdateUI() {
		// Aggiorna Pannelli
		for(let i=1; i<=maxSteps; i++) {
			document.getElementById('wiz-panel'+i).classList.remove('active');
			if(i === wizStep) document.getElementById('wiz-panel'+i).classList.add('active');
		}
		// Aggiorna Stepper (Pallini in alto)
		for(let i=1; i<=maxSteps; i++) {
			const circle = document.getElementById('wiz-sc'+i);
			const label = document.getElementById('wiz-sl'+i);
			const line = document.getElementById('wiz-line'+i);
			
			if (i < wizStep) {
				circle.className = 'step-circle done'; circle.textContent = 'âœ“';
				label.className = 'step-label done';
			} else if (i === wizStep) {
				circle.className = 'step-circle active'; circle.textContent = i;
				label.className = 'step-label active';
			} else {
				circle.className = 'step-circle todo'; circle.textContent = i;
				label.className = 'step-label todo';
			}
			if (line) line.className = (i < wizStep) ? 'step-line done' : 'step-line';
		}
		
		// Aggiorna Bottoni in basso
		document.getElementById('wiz-stepCounter').textContent = `Passo ${wizStep} di ${maxSteps}`;
		document.getElementById('wiz-btnBack').style.display = (wizStep > 1) ? 'block' : 'none';
		document.getElementById('wiz-btnNext').style.display = (wizStep < maxSteps) ? 'block' : 'none';
		document.getElementById('modal-save').style.display = (wizStep === maxSteps) ? 'block' : 'none';

		// Fix mappa (Leaflet a volte non carica bene i tile se il div era nascosto)
		if (wizStep === 3 && typeof mapInstance !== 'undefined' && mapInstance) {
			setTimeout(() => mapInstance.invalidateSize(), 100);
		}

    // Aggiorna riepilogo dinamico
    try {
      const species = (document.getElementById('modal-species') || {}).value || '';
      const gender = (document.getElementById('modal-gender') || {}).value || '';
      document.getElementById('summary-base').textContent = (species && gender)
        ? `âœ”ï¸ Dati base inseriti: ${species} â€¢ ${gender}`
        : 'âŒ Dati base inseriti (Specie e Genere)';

      const color = (document.getElementById('modal-color') || {}).value || '';
      const fur = (document.getElementById('modal-lunghezzaPelo') || {}).value || '';
      document.getElementById('summary-aspect').textContent = (color || fur) ? `âœ”ï¸ Aspetto: ${color || 'â€”'} â€¢ ${fur || 'â€”'}` : 'âŒ Dettagli aspetto completati';

      const coords = (document.getElementById('modal-coords') || {}).value || '';
      const lastSeenInput = document.getElementById('modal-lastSeenDate');
      const lastSeen = (lastSeenInput || {}).value || '';
      const customDateSelected = document.getElementById('lastSeenCustomBtn')?.classList.contains('is-selected');
      const hasValidDate = customDateSelected ? Boolean(lastSeen) : true;
      const dateLabel = customDateSelected ? lastSeen : 'oggi';
      document.getElementById('summary-location').textContent = (coords && hasValidDate)
        ? `âœ”ï¸ Posizione: impostata â€¢ Data: ${dateLabel}`
        : 'âŒ Posizione e data impostate';
    } catch (e) {}
	}

	function wizNextStep() { if(wizStep < maxSteps) { wizStep++; wizUpdateUI(); } }
	function wizPrevStep() { if(wizStep > 1) { wizStep--; wizUpdateUI(); } }

	// Tasto "Tipo Annuncio" (Smarrito / Avvistamento)
	function wizSelectType(val, el) {
		document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
		el.classList.add('active');
		const select = document.getElementById('modal-type');
		select.value = val;
		// Lancia l'evento "change" manuale cosÃ¬ il tuo profile.js originale se ne accorge
		select.dispatchEvent(new Event('change')); 
	}

	// Tasti "Chips" generici (Cane/Gatto, Pelo, Genere)
	function wizSetChip(hiddenId, val, el) {
		const group = el.closest('.chip-group');
		group.querySelectorAll('.wiz-chip').forEach(c => c.classList.remove('active'));
		el.classList.add('active');
		
		const hiddenInput = document.getElementById(hiddenId);
		hiddenInput.value = val;
		hiddenInput.dispatchEvent(new Event('change'));
	}

  function wizApplyChipValue(hiddenId, value) {
    const hiddenInput = document.getElementById(hiddenId);
    if (!hiddenInput) return;

    hiddenInput.value = value || '';
    const chips = Array.from(document.querySelectorAll('.wiz-chip[onclick]'))
      .filter((chip) => (chip.getAttribute('onclick') || '').includes(`'${hiddenId}'`));

    chips.forEach((chip) => {
      const marker = `,'${value}'`;
      const onclick = (chip.getAttribute('onclick') || '').replace(/\s+/g, '');
      chip.classList.toggle('active', Boolean(value) && onclick.includes(marker));
    });

    hiddenInput.dispatchEvent(new Event('change'));
  }

  /**
   * Selects the color swatch and syncs the hidden color input.
   * @param {string} val - Color value to apply.
   * @param {HTMLElement} el - Swatch element to mark as active.
   * @returns {void}
   */
	// Tasti "Colore"
	function wizSetColor(val, el) {
		document.querySelectorAll('.color-swatch').forEach(c => c.classList.remove('active'));
		el.classList.add('active');
		document.getElementById('modal-color').value = val;
    const hidden = document.getElementById('modal-color');
    if (hidden) hidden.dispatchEvent(new Event('change'));
	}

	// Intercetta l'apertura del pop-up originale per resettare il Wizard al passo 1
	const originalOpen = window.openModalForCreate;
	if(originalOpen) {
		window.openModalForCreate = function() {
			wizStep = 1; wizUpdateUI();
			originalOpen();
		}
	}
	const originalEdit = window.openModalForEdit;
	if(originalEdit) {
		window.openModalForEdit = function(ann) {
			wizStep = 1; wizUpdateUI();
			originalEdit(ann);
		}
	}