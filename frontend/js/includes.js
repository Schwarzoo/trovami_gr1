let notificationBadgeTimer = null;

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
