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
    } else {
      a.setAttribute('href', '/pages/login.html?next=' + encodeURIComponent(target));
    }
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
