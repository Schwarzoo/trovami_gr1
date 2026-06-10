/**
 * Initializes user profile controls, notifications, contact requests, and followed shelters.
 * @param {Object} context - Shared profile dependencies and helper functions.
 * @returns {void}
 */
function initProfileUser(context) {
  const {
    token,
    authHeader,
    saveProfileButton,
    editProfileButton,
    setProfileEditing
  } = context;

  /**
   * Logs out the current user and clears local session state.
   * @returns {Promise<void>} Promise resolving after logout navigation is triggered.
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
   * Fetches notifications for the current authenticated user.
   * @returns {Promise<Array<Object>>} Notification records returned by the API.
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
   * Marks a single notification as read and updates shared notification UI.
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
            <div class="profile-actions-row">
              <a class="btn btn--ghost" href="${shelterAnimalLink}">Apri scheda animale</a>
            </div>
          `
        : (!isDeletedAnnouncementNotification && !isReportNotification && annId
          ? `
            <div class="profile-actions-row">
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
          <div class="profile-actions-row profile-actions-row--wrap">
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
        <div class="profile-actions-row profile-actions-row--wrap">
          <a class="btn btn--ghost followed-shelter-link" href="/pages/rifugio.html?rifugioId=${encodeURIComponent(id)}">Vai alla pagina rifugio</a>
          <button type="button" class="btn btn--ghost" data-follow-action="unfollow" data-shelter-id="${escapeHtml(id)}">Non seguire più</button>
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

  function bindUserEvents() {
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
      showSiteAlert(err.message || 'Errore');
      button.disabled = false;
    }
  });
  document.getElementById('clearRepliedAdoptionRequests')?.addEventListener('click', async () => {
    try {
      await clearRepliedAdoptionRequests();
      await loadContactRequests();
    } catch (err) {
      showSiteAlert(err.message || 'Errore svuotamento richieste');
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

  document.getElementById('deleteAccount')?.addEventListener('click', async () => {
    const confirmed = await showProfileConfirm({
      title: 'Elimina account',
      message: 'Sei sicuro di voler eliminare definitivamente il tuo account? Questa azione non è reversibile.',
      confirmLabel: 'Elimina',
      danger: true
    });
    if (!confirmed) return;
    const res = await fetch('/api/v1/users/me', { method: 'DELETE', headers: authHeader });
    if (!res.ok) {
      const d = await res.json().catch(()=>({}));
      showSiteAlert(d.userMessage || d.message || 'Errore eliminazione account');
      return;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    await showSiteAlert('Account eliminato', { title: 'Operazione completata', tone: 'success' });
    window.location.href = '/';
  });

  /**
   * Opens the shelter animal creation modal.
   * @returns {void}
   */
  }

  bindUserEvents();

  return {
    refreshNotifications,
    loadContactRequests,
    loadFollowedShelters
  };
}
