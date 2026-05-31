let notificationBadgeTimer = null;

/**
 * Opens the profile new-announcement flow from shared navigation controls.
 * @returns {void} The result produced by the function.
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
 * @returns {Promise<Object|Array<Object>|null>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
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
 * @returns {void} The result produced by the function.
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
 * @returns {void|Object|string|Array<Object>|null} The result produced by the function.
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
 * @returns {Promise<void|Object|Array<Object>|null>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
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
 * @returns {void|Object|string|Array<Object>|null} The result produced by the function.
 */
function startNotificationBadgeUpdates() {
  if (notificationBadgeTimer) clearInterval(notificationBadgeTimer);
  updateNotificationBadge();
  notificationBadgeTimer = setInterval(updateNotificationBadge, 30000);
  window.removeEventListener('notifications:updated', updateNotificationBadge);
  window.addEventListener('notifications:updated', updateNotificationBadge);
}

document.addEventListener('DOMContentLoaded', loadPartials);
