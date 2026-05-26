function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch (e) { return null; }
}
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

function setLastSeenMode(mode) {
  const todayBtn = document.getElementById('lastSeenTodayBtn');
  const customBtn = document.getElementById('lastSeenCustomBtn');
  const dateInput = document.getElementById('modal-lastSeenDate');

  const isCustom = mode === 'custom';
  todayBtn.classList.toggle('is-selected', !isCustom);
  customBtn.classList.toggle('is-selected', isCustom);
  dateInput.style.display = isCustom ? 'block' : 'none';
}

function configureTypeFieldForAccount(defaultType = 'LostAnimal') {
  const typeSelect = document.getElementById('modal-type');
  if (!typeSelect) return;

  const isRifugio = currentUser?.role === 'shelter';
  if (isRifugio) {
    typeSelect.innerHTML = '<option value="Sighting">In rifugio</option>';
    typeSelect.value = 'Sighting';
    typeSelect.disabled = true;
    return;
  }

  typeSelect.disabled = false;
  typeSelect.innerHTML = `
    <option value="LostAnimal">Smarrito</option>
    <option value="Sighting">Avvistamento</option>
  `;
  typeSelect.value = defaultType || 'LostAnimal';
}

function getRifugioCoordinates() {
  const coords = currentUser?.rifugioData?.location?.coordinates || currentUser?.shelterData?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lng, lat] = coords.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

function configureModalLabelsForAccount() {
  const isRifugio = currentUser?.role === 'shelter';
  const dateLabel = document.getElementById('modal-lastSeenDate-label');
  const positionHint = document.getElementById('modal-position-hint');
  const positionSection = document.getElementById('modal-position-section');
  const microchipRow = document.getElementById('modal-microchip-row');
  const animalNameRow = document.getElementById('modal-animal-name-row');

  if (dateLabel) dateLabel.textContent = isRifugio ? 'Data' : 'Ultima data vista';
  if (positionSection) positionSection.style.display = isRifugio ? 'none' : '';
  if (microchipRow) microchipRow.style.display = isRifugio ? '' : 'none';
  if (animalNameRow) animalNameRow.style.display = '';
  if (positionHint) {
    positionHint.textContent = isRifugio
      ? 'Posizione del rifugio gia impostata. Puoi modificarla selezionando un altro punto.'
      : 'Scegli un punto sulla mappa o usa la posizione attuale.';
  }
}

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
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/pages/login.html';
    return;
  }

  const authHeader = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
  const mePayload = decodeJwt(token) || {};
  const myUserId = mePayload.userId;
  const editableProfileFields = [
    'username',
    'phoneNumber',
    'showEmail',
    'showPhone',
    'emailOnComment',
    'soundOnSite'
  ];
  const editProfileButton = document.getElementById('editProfileBtn');
  const saveProfileButton = document.getElementById('saveProfileBtn');
  const adminUserLookup = new Map();

  function setProfileEditing(enabled) {
    editableProfileFields.forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.disabled = !enabled;
    });

    saveProfileButton.disabled = !enabled;
    editProfileButton.disabled = enabled;
    document.getElementById('profile-section').classList.toggle('is-editing', enabled);
  }

  async function handleLogout() {
    try {
      await fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
    } catch (e) {
      console.error('Logout error:', e);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/pages/login.html';
  }

  async function fetchMe() {
    const res = await fetch('http://localhost:3000/api/users/me', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return null;
    return await res.json();
  }

  async function fetchNotifications() {
    const res = await fetch('http://localhost:3000/api/notifications', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  async function markNotificationRead(id) {
    await fetch(`http://localhost:3000/api/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
  }

  async function markAllNotificationsRead() {
    await fetch('http://localhost:3000/api/notifications/read-all', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
  }

  function playBeep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      const now = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      o.stop(now + 0.2);
      o.onended = () => ctx.close();
    } catch (e) {}
  }

  function escapeHtml(input) {
    return String(input ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function displayValue(value) {
    const text = String(value ?? '').trim();
    return text ? escapeHtml(text) : '<span class="muted">Non specificato</span>';
  }

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

  function renderNotifications(list) {
    const empty = document.getElementById('notifications-empty');
    const container = document.getElementById('notifications-list');
    if (!container || !empty) return;

    container.innerHTML = '';
    if (!list || list.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.forEach((n) => {
      const when = n?.createdAt ? new Date(n.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const annId = n?.announcementId;
      const isDeletedAnnouncementNotification = String(n?.message || '').startsWith('Annuncio eliminato, motivo:');
      const isReportNotification = n?.type === 'report';
      const announcementLinkHtml = !isDeletedAnnouncementNotification && !isReportNotification && annId
        ? `
            <div style="margin-top:8px;display:flex;gap:10px;align-items:center;">
              <a class="btn btn--ghost" href="/pages/announcements.html?highlight=${encodeURIComponent(annId)}">Vedi annuncio</a>
            </div>
          `
        : '';
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.innerHTML = `
        <div class="comment-meta">
          <span class="comment-user">Notifica</span>
          <span class="comment-date">${escapeHtml(when)}</span>
        </div>
        <div class="comment-text">${escapeHtml(n?.message || '')}</div>
        ${announcementLinkHtml}
      `;
      const link = item.querySelector('a');
      if (link) {
        link.addEventListener('click', async (e) => {
          e.preventDefault();
          if (n?._id) await markNotificationRead(n._id);
          window.location.href = link.getAttribute('href');
        });
      }
      container.appendChild(item);
    });
  }

  function renderRifugioStatus(me) {
    const box = document.getElementById('rifugio-status-box');
    if (!box) return;
    if (me.role !== 'shelter') {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }

    const name = me.rifugioData?.rifugioName || me.shelterData?.shelterName || me.username || 'Rifugio';
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
    box.style.display = 'block';
    text.textContent = coords
      ? 'Posizione salvata. Puoi modificarla dalla mappa.'
      : 'Aggiungi la posizione del rifugio per pubblicare annunci.';
    button.textContent = coords ? 'Modifica posizione' : 'Aggiungi posizione';
    if (message) message.textContent = coords ? '' : 'Prima di creare annunci rifugio salva un punto sulla mappa.';
  }

  function ensureRifugioMap() {
    const mapEl = document.getElementById('rifugio-position-map');
    if (!mapEl) return null;
    mapEl.style.display = 'block';

    if (!rifugioMapInstance) {
      rifugioMapInstance = L.map('rifugio-position-map').setView([46.0667, 11.1333], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(rifugioMapInstance);
      rifugioMapInstance.on('click', (e) => {
        setPendingRifugioLocation(e.latlng.lng, e.latlng.lat);
      });
    }

    requestAnimationFrame(() => rifugioMapInstance.invalidateSize());
    return rifugioMapInstance;
  }

  function setPendingRifugioLocation(lng, lat) {
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
  }

  function openRifugioPositionEditor() {
    const map = ensureRifugioMap();
    const coords = getRifugioCoordinates();
    if (coords) {
      setPendingRifugioLocation(coords[0], coords[1]);
    } else if (map) {
      map.setView([46.0667, 11.1333], 13);
      document.getElementById('saveRifugioPosition').style.display = 'none';
      document.getElementById('rifugio-position-message').textContent = 'Clicca sulla mappa per scegliere il punto del rifugio.';
    }
    requestAnimationFrame(() => map && map.invalidateSize());
  }

  async function saveRifugioPosition() {
    if (!pendingRifugioLocation) {
      alert('Seleziona un punto sulla mappa');
      return;
    }

    const [lng, lat] = pendingRifugioLocation;
    const res = await fetch('http://localhost:3000/api/users/me', {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        rifugioData: {
          location: { type: 'Point', coordinates: [lng, lat] }
        }
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || 'Errore salvataggio posizione');
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

  async function fetchAdminReports() {
    const res = await fetch('http://localhost:3000/api/admin/reports', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  async function fetchPendingRifugi() {
    const res = await fetch('http://localhost:3000/api/admin/rifugi/pending', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  async function fetchPendingReadmissions() {
    const res = await fetch('http://localhost:3000/api/admin/readmission-requests', { headers: authHeader });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  async function readResponseError(res, fallback) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json().catch(() => ({}));
      if (json?.message) return json.message;
    }
    return `${fallback} (${res.status})`;
  }

  async function fetchAdminUserAnnouncementCount(userId) {
    const res = await fetch(`http://localhost:3000/api/admin/users/${encodeURIComponent(userId)}/announcement-count`, { headers: authHeader });
    if (!res.ok) throw new Error(await readResponseError(res, 'Errore conteggio annunci'));
    const json = await res.json().catch(() => ({}));
    return Number(json?.publishedAnnouncementsCount || 0);
  }

  async function fetchAdminUser(userId) {
    const res = await fetch(`http://localhost:3000/api/admin/users/${encodeURIComponent(userId)}`, { headers: authHeader });
    if (!res.ok) throw new Error(await readResponseError(res, 'Errore recupero account'));
    const user = await res.json();
    try {
      user.publishedAnnouncementsCount = await fetchAdminUserAnnouncementCount(userId);
    } catch (err) {
      console.warn('Errore conteggio annunci account:', err);
    }
    return user;
  }

  function closeAdminAnnouncementModal() {
    const overlay = document.getElementById('admin-announcement-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  function closeAdminUserModal() {
    const overlay = document.getElementById('admin-user-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  function renderAdminUserModal(user) {
    const overlay = document.getElementById('admin-user-overlay');
    const title = document.getElementById('admin-user-title');
    const body = document.getElementById('admin-user-body');
    if (!overlay || !title || !body) return;

    const warnings = Array.isArray(user?.conductWarnings) ? user.conductWarnings : [];
    const rifugioName = user?.rifugioData?.rifugioName || user?.shelterData?.shelterName || '';
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

  async function warnAdminUser(userId) {
    const res = await fetch(`http://localhost:3000/api/admin/users/${encodeURIComponent(userId)}/warn`, {
      method: 'PATCH',
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

  async function blockAdminUser(userId) {
    const reason = prompt('Motivo blocco account:', 'Violazione delle regole della community');
    if (reason === null) return;
    const blockReason = reason.trim() || 'Account bloccato da admin';
    const res = await fetch(`http://localhost:3000/api/admin/users/${encodeURIComponent(userId)}/block`, {
      method: 'PATCH',
      headers: authHeader,
      body: JSON.stringify({ reason: blockReason })
    });
    if (!res.ok) throw new Error(await readResponseError(res, 'Errore blocco'));
    const blockedUser = await res.json().catch(() => null);
    if (blockedUser?._id) {
      adminUserLookup.set(String(blockedUser._id), blockedUser);
    }
    closeAdminUserModal();
    return blockedUser;
  }

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
    const photoUrl = ann?._id ? `http://localhost:3000/api/announcements/${encodeURIComponent(ann._id)}/photo` : '';
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

  async function openAdminAnnouncementModal(annId) {
    if (!annId) return;
    const res = await fetch(`http://localhost:3000/api/announcements/${encodeURIComponent(annId)}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Errore caricamento annuncio');
    renderAdminAnnouncementModal(await res.json());
  }

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

  async function loadAdminData() {
    if (currentUser?.role !== 'admin') return;
    const section = document.getElementById('admin-section');
    if (section) section.style.display = 'block';
    const [reports, rifugi, readmissions] = await Promise.all([fetchAdminReports(), fetchPendingRifugi(), fetchPendingReadmissions()]);
    renderAdminReports(reports);
    renderPendingRifugi(rifugi);
    renderPendingReadmissions(readmissions);
  }

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
    document.getElementById('soundOnSite').checked = me.notificationPrefs?.soundOnSite !== false;
    renderRifugioStatus(me);
    renderRifugioPosition(me);

    const notifications = await fetchNotifications();
    renderNotifications(notifications);
    if (notifications.length > 0 && (me.notificationPrefs?.soundOnSite !== false)) playBeep();
    await loadAdminData();

    loadMyAnnouncements();
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
        emailOnComment: !!document.getElementById('emailOnComment').checked,
        soundOnSite: !!document.getElementById('soundOnSite').checked
      }
    };
    const res = await fetch('http://localhost:3000/api/users/me', { method: 'PUT', headers: authHeader, body: JSON.stringify(updates) });
    const data = await res.json();
    document.getElementById('profileMessage').textContent = res.ok ? 'Profilo aggiornato' : (data.message || 'Errore');
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
    const notifications = await fetchNotifications();
    renderNotifications(notifications);
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
        const res = await fetch(`http://localhost:3000/api/admin/announcements/${encodeURIComponent(annId)}`, {
          method: 'DELETE',
          headers: authHeader,
          body: JSON.stringify({ reason: deleteReason })
        });
        if (!res.ok) throw new Error((await res.json().catch(()=>({}))).message || 'Errore eliminazione');
      }

      if (action === 'block-user') {
        await blockAdminUser(button.dataset.userId);
      }

      if (action === 'warn-user') {
        await warnAdminUser(button.dataset.userId);
      }

      if (action === 'dismiss-report') {
        const reportId = button.dataset.reportId;
        const res = await fetch(`http://localhost:3000/api/admin/reports/${encodeURIComponent(reportId)}/status`, {
          method: 'PATCH',
          headers: authHeader,
          body: JSON.stringify({ status: 'DISMISSED', details: 'Archiviato da admin' })
        });
        if (!res.ok) throw new Error((await res.json().catch(()=>({}))).message || 'Errore archiviazione');
      }

      if (action === 'approve-readmission' || action === 'reject-readmission') {
        const userId = button.dataset.userId;
        const verb = action === 'approve-readmission' ? 'approve' : 'reject';
        const res = await fetch(`http://localhost:3000/api/admin/users/${encodeURIComponent(userId)}/readmission/${verb}`, {
          method: 'PATCH',
          headers: authHeader
        });
        if (!res.ok) throw new Error(await readResponseError(res, 'Errore riammissione'));
      }

      if (action === 'approve-rifugio' || action === 'reject-rifugio') {
        const userId = button.dataset.userId;
        const verb = action === 'approve-rifugio' ? 'approve' : 'reject';
        const body = action === 'reject-rifugio'
          ? JSON.stringify({ reason: prompt('Motivo rifiuto:', 'Dati insufficienti') || 'Dati insufficienti' })
          : '{}';
        const res = await fetch(`http://localhost:3000/api/admin/rifugi/${encodeURIComponent(userId)}/${verb}`, {
          method: 'PATCH',
          headers: authHeader,
          body
        });
        if (!res.ok) throw new Error((await res.json().catch(()=>({}))).message || 'Errore richiesta rifugio');
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
    if (!confirm('Sei sicuro di voler eliminare definitivamente il tuo account? Questa azione non è reversibile.')) return;
    const res = await fetch('http://localhost:3000/api/users/me', { method: 'DELETE', headers: authHeader });
    if (!res.ok) {
      const d = await res.json().catch(()=>({}));
      alert(d.message || 'Errore eliminazione account');
      return;
    }
    // cleanup local session and redirect
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    alert('Account eliminato');
    window.location.href = '/';
  });
  async function loadMyAnnouncements() {
  const res = await fetch('http://localhost:3000/api/announcements');
  if (!res.ok) return;
  const all = await res.json();
  const mine = all.filter(a => a.publisherId && ((a.publisherId._id || a.publisherId) == myUserId || (a.publisherId._id && a.publisherId._id == myUserId)));

  const grid = document.getElementById('announcements-grid');
  grid.innerHTML = '';
  mine.forEach(a => {
    const div = document.createElement('div'); div.className = 'card';
    const photoUrl = `http://localhost:3000/api/announcements/${a._id}/photo`;
    div.innerHTML = `
      <div class="card-image"><div class="card-image-placeholder"><span>…</span></div></div>
      <div class="card-body">
        <div class="card-breed">${a.animalId?.name ? escapeHtml(a.animalId.name) + ' - ' : ''}${a.animalId?.species ?? ''} ${a.animalId?.breed ?? ''}</div>
        <div class="card-description">${a.description}</div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button data-id="${a._id}" class="edit btn btn--ghost">Modifica</button>
          <button data-id="${a._id}" class="close btn btn--ghost">Chiudi</button>
          <button data-id="${a._id}" class="del btn btn--danger">Elimina</button>
          <a href="/pages/announcements.html" style="margin-left:auto;">Vedi su lista</a>
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
        if (placeholder) placeholder.innerHTML = '🐾';
      }
    })();
  });

  // attach actions

  document.querySelectorAll('button.close').forEach(b => b.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (!confirm('Segni l\'annuncio come risolto?')) return;
    const res = await fetch(`http://localhost:3000/api/announcements/${id}/status`, { method: 'PATCH', headers: authHeader, body: JSON.stringify({ status: 'RESOLVED' }) });
    if (res.ok) loadMyAnnouncements(); else alert('Errore chiusura');
  }));

  document.querySelectorAll('button.del').forEach(b => b.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (!confirm('Eliminare annuncio?')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/announcements/${id}`, { method: 'DELETE', headers: authHeader });
      if (res.ok) {
        loadMyAnnouncements();
      } else {
        const d = await res.json().catch(()=>({}));
        alert(d.message || ('Errore eliminazione (' + res.status + ')'));
      }
    } catch (err) {
      alert('Errore di rete: ' + (err.message || err));
    }
  }));
}

  setProfileEditing(false);
  load();

  // Modal and map picker related event listeners (must run after DOM loaded)
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

  // Save from modal: create or update
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
          const aRes = await fetch(`http://localhost:3000/api/animals/${animalIdToUse}`, {
            method: 'PUT',
            headers: animalHeaders,
            body: JSON.stringify(animalPayload)
          });
          if (!aRes.ok) throw new Error('Errore aggiornamento animale');
          const aData = await aRes.json();
          animalIdToUse = aData._id;
        } else {
          const animalRes = await fetch('http://localhost:3000/api/animals', {
            method: 'POST',
            headers: animalHeaders,
            body: JSON.stringify(animalPayload)
          });
          if (!animalRes.ok) throw new Error('Errore creazione animale');
          const animal = await animalRes.json();
          animalIdToUse = animal._id;
        }
      } else {
        const animalRes = await fetch('http://localhost:3000/api/animals', {
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
          res = await fetch('http://localhost:3000/api/announcements', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: fd
          });
        } else {
          res = await fetch('http://localhost:3000/api/announcements', {
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
        res = await fetch(`http://localhost:3000/api/announcements/${editingId}`, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token },
          body: fd
        });
        if (!res.ok) throw new Error('Errore aggiornamento annuncio');
      } else {
        res = await fetch(`http://localhost:3000/api/announcements/${editingId}`, {
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

  // delegate edit buttons to open modal with data
  document.addEventListener('click', async (e) => {
    const el = e.target;
    if (el.classList.contains('edit')) {
      const id = el.dataset.id;
      const res = await fetch(`http://localhost:3000/api/announcements/${id}`);
      if (!res.ok) { alert('Errore caricamento annuncio'); return; }
      const ann = await res.json();
      openModalForEdit(ann);
    }
  });

});

// Modal and map picker logic

function normalizeCoordsFromInput(input) {
  if (!input) return null;
  // Try DMS parse first
  const tryDms = (str) => {
    try {
      return dmsToDecimal(str);
    } catch (e) { return null; }
  };

  let a = null, b = null;
  // If contains non-numeric chars like ° or N/S/E/W, attempt DMS parsing
  if (/[°'"NSWE]/i.test(input)) {
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
  // Heuristic: latitude in Italy ~ 35..47, longitude ~ 6..18
  const isA_lat = a >= 35 && a <= 47;
  const isB_lat = b >= 35 && b <= 47;
  // if a looks like lat and b like lng, swap to [lng, lat]
  if (isA_lat && !isB_lat) return [b, a];
  if (!isA_lat && isB_lat) return [a, b];
  // fallback: assume input is [lng, lat]
  return [a, b];
}

// Parse a DMS component string like "46°04'00\"N" or "46 4 0 N" or "46.0667N"
function dmsToDecimal(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  // detect hemisphere
  let hemi = null;
  const m = s.match(/[NnSsEeWw]/);
  if (m) hemi = m[0].toUpperCase();
  // remove letters
  const cleaned = s.replace(/[NnSsEeWw]/g, '').trim();
  // try to parse degrees°minutes'seconds"
  const dmsMatch = cleaned.match(/(\d+)[°\s]+(\d+)[\'\s]+(\d+(?:\.\d+)?)[\"\s]*/);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3]);
    let dec = deg + (min/60) + (sec/3600);
    if (hemi === 'S' || hemi === 'W') dec = -dec;
    return dec;
  }
  // try degrees and minutes only: "46° 4.5'"
  const dmMatch = cleaned.match(/(\d+)[°\s]+(\d+(?:\.\d+)?)[\'\s]*/);
  if (dmMatch) {
    const deg = parseFloat(dmMatch[1]);
    const min = parseFloat(dmMatch[2]);
    let dec = deg + (min/60);
    if (hemi === 'S' || hemi === 'W') dec = -dec;
    return dec;
  }
  // try plain decimal degrees
  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    let dec = num;
    if (hemi === 'S' || hemi === 'W') dec = -dec;
    return dec;
  }
  return null;
}

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
  return `${deg}°${min}'${sec}"${hemi}`;
}

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
  document.getElementById('modal-species').value = '';
  document.getElementById('modal-breed').value = '';
  document.getElementById('modal-color').value = '';
  document.getElementById('modal-gender').value = '';
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
  showModal(true);
}

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
  document.getElementById('modal-species').value = ann.animalId?.species || '';
  document.getElementById('modal-breed').value = ann.animalId?.breed || '';
  document.getElementById('modal-color').value = ann.animalId?.color || '';
  document.getElementById('modal-gender').value = ann.animalId?.gender || '';
  document.getElementById('modal-lunghezzaPelo').value = ann.animalId?.lunghezzaPelo || '';
  document.getElementById('modal-distinctiveFeatures').value = ann.animalId?.distinctiveFeatures || '';
  document.getElementById('modal-microchipId').value = ann.animalId?.microchipId || '';
  const photo = ann.animalId?.photos?.[0] || '';
  // existing announcement photo is not loaded into the edit file input; user can upload a new file to replace it
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
    // stored as [lng, lat] -> display as lat DMS, lng DMS
    const lng = coords[0]; const lat = coords[1];
    document.getElementById('modal-coords').value = `${decimalToDMS(lat,'lat')}, ${decimalToDMS(lng,'lng')}`;
  } else {
    document.getElementById('modal-coords').value = '';
  }
  // populate the extra fields if present
  if (ann.lastSeenDate) {
    document.getElementById('modal-lastSeenDate').value = new Date(ann.lastSeenDate).toISOString().slice(0,10);
    setLastSeenMode('custom');
  } else {
    document.getElementById('modal-lastSeenDate').value = '';
    setLastSeenMode('today');
  }
  document.getElementById('modal-animalBehaviour').value = ann.animalBehaviour || 'indifferente';
  document.getElementById('modal-healthCondition').value = ann.healthCondition || 'in salute';
  showModal(true);
}

function showModal(visible) {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = visible ? 'flex' : 'none';
  document.body.style.overflow = visible ? 'hidden' : '';
  if (!visible) destroyMapPicker();
}

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

function destroyMapPicker() {
  if (!mapInstance) return;
  mapInstance.off();
  mapInstance.remove();
  mapInstance = null;
  mapMarker = null;
  document.getElementById('modal-map').style.display = 'none';
}

function setMarker(lng, lat){
  if (!mapInstance) initMapPicker();
  if (mapMarker) mapMarker.setLatLng([lat,lng]); else mapMarker = L.marker([lat,lng]).addTo(mapInstance);
  mapInstance.setView([lat,lng], 15);
  document.getElementById('modal-map').style.display = 'block';
  requestAnimationFrame(() => mapInstance && mapInstance.invalidateSize());
}

function setCoordsFromLatLng(lat, lng) {
  setMarker(lng, lat);
  // set coords in DMS format for user clarity
  document.getElementById('modal-coords').value = `${decimalToDMS(lat,'lat')}, ${decimalToDMS(lng,'lng')}`;
}

function showMapPicker() {
  const mapEl = document.getElementById('modal-map');
  mapEl.style.display = 'block';
  if (!mapInstance) {
    initMapPicker();
  } else {
    mapInstance.invalidateSize();
  }
}
