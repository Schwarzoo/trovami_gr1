function initProfileAdmin(context) {
  const {
    token,
    authHeader,
    adminUserLookup,
    displayValue,
    renderAdminCommentsHtml,
    loadMyAnnouncements
  } = context;

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
      showSiteAlert('Informazioni account non disponibili');
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
    const reason = await showSitePrompt('Motivo blocco account:', {
      title: 'Blocca account',
      defaultValue: 'Violazione delle regole della community',
      confirmLabel: 'Blocca'
    });
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
        <div class="profile-actions-row profile-actions-row--wrap">
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
        <div class="profile-actions-row profile-actions-row--wrap">
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
        <div class="profile-actions-row profile-actions-row--wrap">
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

  function bindAdminEvents() {
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
        showSiteAlert(err.message || 'Errore moderazione');
      }
      return;
    }
    if (e.target?.id === 'admin-user-overlay') closeAdminUserModal();
  });

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
        const reason = await showSitePrompt('Motivo rimozione annuncio:', {
          title: 'Rimuovi annuncio',
          defaultValue: 'annuncio falso/offensivo',
          confirmLabel: 'Rimuovi'
        });
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
        let body = { rifugioStatus: 'approved' };
        if (action === 'reject-rifugio') {
          const reason = await showSitePrompt('Motivo rifiuto:', {
            title: 'Rifiuta rifugio',
            defaultValue: 'Dati insufficienti',
            confirmLabel: 'Rifiuta'
          });
          if (reason === null) return;
          body = { rifugioStatus: 'rejected', reason: reason.trim() || 'Dati insufficienti' };
        }
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
      showSiteAlert(err.message || 'Errore moderazione');
    }
  });
  }

  bindAdminEvents();

  return {
    loadAdminData
  };
}