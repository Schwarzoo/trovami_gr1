document.addEventListener('DOMContentLoaded', async () => {
  const profileDetails = document.getElementById('profile-section');
  if (profileDetails && window.matchMedia('(max-width: 720px)').matches) {
    profileDetails.open = false;
  }

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
  async function fetchMe() {
    const res = await fetch('/api/v1/users/me', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return null;
    return await res.json();
  }

  /**
   * Fetches notifications data from the API.
   * @returns {Promise<Array<Object>>} Notifications for the current user.
   */
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
  let refreshNotifications = async () => {};

  /**
   * Loads the current user's contact requests into the profile page.
   * @returns {Promise<void>} Promise resolving after the list is refreshed.
   */
  let loadContactRequests = async () => {};

  /**
   * Loads followed shelters for the current user.
   * @returns {Promise<void>} Promise resolving after followed shelters are rendered.
   */
  let loadFollowedShelters = async () => {};

  /**
   * Renders the shelter approval status placeholder until the shelter module is initialized.
   * @param {Object} me - Current authenticated user profile.
   * @returns {void}
   */
  let renderRifugioStatus = () => {};

  /**
   * Renders the shelter map position placeholder until the shelter module is initialized.
   * @param {Object} me - Current authenticated user profile.
   * @returns {void}
   */
  let renderRifugioPosition = () => {};

  /**
   * Toggles the shelter position editor placeholder until the shelter module is initialized.
   * @param {boolean} isEditing - Whether position editing should be enabled.
   * @returns {void}
   */
  let setRifugioPositionEditingState = () => {};

  /**
   * Opens the shelter position editor once the shelter module is initialized.
   * @returns {void}
   */
  let openRifugioPositionEditor = () => {};

  /**
   * Loads personal announcements for the current account.
   * @returns {Promise<void>} Promise resolving after announcements are rendered.
   */
  let loadMyAnnouncements = async () => {};

  /**
   * Loads animals managed by the current shelter account.
   * @returns {Promise<void>} Promise resolving after animals are rendered.
   */
  let loadMyAnimals = async () => {};

  /**
   * Loads admin dashboard data once the admin module is initialized.
   * @returns {Promise<void>} Promise resolving after admin data is rendered.
   */
  let loadAdminData = async () => {};

  /**
   * Returns whether the current account can manage personal announcements from profile.
   * @returns {boolean} True for user and shelter roles.
   */
  function canManagePersonalAnnouncements() {
    return ['user', 'shelter'].includes(currentUser?.role);
  }

  /**
   * Syncs the personal announcements panel with the current account role.
   * @returns {boolean} True when the panel should be visible and loaded.
   */
  function syncMyAnnouncementsVisibility() {
    const section = document.getElementById('my-announcements');
    const showCreateButton = document.getElementById('showCreate');
    const visible = canManagePersonalAnnouncements();

    if (section) section.style.display = visible ? 'block' : 'none';
    if (showCreateButton) showCreateButton.style.display = visible ? '' : 'none';
    return visible;
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

    if (syncMyAnnouncementsVisibility()) await loadMyAnnouncements();
    await loadMyAnimals();
    await loadContactRequests();
    await loadFollowedShelters();

    if (autoOpenNewAnnouncement && canManagePersonalAnnouncements()) {
      openModalForCreate();
    }
  }

  document.getElementById('showCreate').addEventListener('click', (e) => {
    e.preventDefault();
    if (!canManagePersonalAnnouncements()) return;
    if (currentUser?.role === 'shelter' && currentUser?.rifugioStatus !== 'approved') {
      showSiteAlert('Il tuo account rifugio deve essere approvato da un admin prima di pubblicare annunci.');
      return;
    }
    if (currentUser?.role === 'shelter' && !getRifugioCoordinates()) {
      showSiteAlert('Prima salva la posizione del rifugio nella sezione Dati profilo.');
      openRifugioPositionEditor();
      return;
    }
    openModalForCreate();
  });

  const userModule = initProfileUser({
    token,
    authHeader,
    saveProfileButton,
    editProfileButton,
    setProfileEditing
  });
  refreshNotifications = userModule.refreshNotifications;
  loadContactRequests = userModule.loadContactRequests;
  loadFollowedShelters = userModule.loadFollowedShelters;

  const shelterModule = initProfileShelter({
    myUserId,
    token,
    authHeader,
    fetchAnnouncementById,
    fetchSimilarAnnouncements,
    displayValue,
    syncMyAnnouncementsVisibility
  });
  renderRifugioStatus = shelterModule.renderRifugioStatus;
  renderRifugioPosition = shelterModule.renderRifugioPosition;
  setRifugioPositionEditingState = shelterModule.setRifugioPositionEditingState;
  openRifugioPositionEditor = shelterModule.openRifugioPositionEditor;
  loadMyAnnouncements = shelterModule.loadMyAnnouncements;
  loadMyAnimals = shelterModule.loadMyAnimals;

  const adminModule = initProfileAdmin({
    token,
    authHeader,
    adminUserLookup,
    displayValue,
    renderAdminCommentsHtml,
    loadMyAnnouncements
  });
  loadAdminData = adminModule.loadAdminData;

  setProfileEditing(false);
  load();

  document.getElementById('pickOnMap').addEventListener('click', () => {
    showMapPicker();
  });

  document.getElementById('useMyLocation').addEventListener('click', () => {
    if (!navigator.geolocation) {
      showSiteAlert('Geolocalizzazione non disponibile nel browser.');
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
        showSiteAlert(msg);
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

    if (!(await validateAnnouncementWizardThroughStep(maxSteps))) {
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
      showSiteAlert(error?.message || 'Errore salvataggio annuncio');
    } finally {
      setAnnouncementSavingState(false);
    }
  });

  document.addEventListener('click', async (e) => {
    const el = e.target;
    if (el.classList.contains('edit')) {
      const id = el.dataset.id;
      const res = await fetch(`/api/v1/announcements/${id}`);
      if (!res.ok) { showSiteAlert('Errore caricamento annuncio'); return; }
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
