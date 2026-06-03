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
