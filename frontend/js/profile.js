function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch (e) { return null; }
}
let mapInstance = null;
let mapMarker = null;
let editingId = null;
let editingAnimalId = null;
let currentEditStatus = 'ACTIVE';

function setLastSeenMode(mode) {
  const todayBtn = document.getElementById('lastSeenTodayBtn');
  const customBtn = document.getElementById('lastSeenCustomBtn');
  const dateInput = document.getElementById('modal-lastSeenDate');

  const isCustom = mode === 'custom';
  todayBtn.classList.toggle('is-selected', !isCustom);
  customBtn.classList.toggle('is-selected', isCustom);
  dateInput.style.display = isCustom ? 'block' : 'none';
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
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.innerHTML = `
        <div class="comment-meta">
          <span class="comment-user">Notifica</span>
          <span class="comment-date">${escapeHtml(when)}</span>
        </div>
        <div class="comment-text">${escapeHtml(n?.message || '')}</div>
        <div style="margin-top:8px;display:flex;gap:10px;align-items:center;">
          <a class="btn btn--ghost" href="/pages/announcements.html?highlight=${encodeURIComponent(annId)}">Vedi annuncio</a>
        </div>
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

  async function load() {
    const me = await fetchMe();
    if (!me) { localStorage.removeItem('token'); window.location.href = '/pages/login.html'; return; }

    document.getElementById('username').value = me.username || '';
    document.getElementById('email').value = me.email || '';
    document.getElementById('phoneNumber').value = me.phoneNumber || '';

    document.getElementById('showEmail').checked = me.contactVisibility?.showEmail !== false;
    document.getElementById('showPhone').checked = me.contactVisibility?.showPhone !== false;
    document.getElementById('emailOnComment').checked = !!me.notificationPrefs?.emailOnComment;
    document.getElementById('soundOnSite').checked = me.notificationPrefs?.soundOnSite !== false;

    const notifications = await fetchNotifications();
    renderNotifications(notifications);
    if (notifications.length > 0 && (me.notificationPrefs?.soundOnSite !== false)) playBeep();

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

  document.getElementById('showCreate').addEventListener('click', (e) => {
    e.preventDefault();
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
        <div class="card-breed">${a.animalId?.species ?? ''} ${a.animalId?.breed ?? ''}</div>
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
    const species = document.getElementById('modal-species').value.trim();
    const breed = document.getElementById('modal-breed').value.trim() || 'Non specificato';
    const color = document.getElementById('modal-color').value.trim();
    const gender = document.getElementById('modal-gender').value || 'Sconosciuto';
    const lunghezzaPelo = document.getElementById('modal-lunghezzaPelo').value || null;
    const distinctiveFeatures = document.getElementById('modal-distinctiveFeatures').value.trim();
    const photoFile = document.getElementById('modal-photo-file').files[0];
    const coordsRawInput = document.getElementById('modal-coords').value.trim();
    const coordsRaw = normalizeCoordsFromInput(coordsRawInput);

    if (!type || !species || !color) {
      alert('Compila i campi obbligatori: Tipo, Specie e Colore.');
      return;
    }

    if (!coordsRaw || coordsRaw.length !== 2 || isNaN(coordsRaw[0]) || isNaN(coordsRaw[1])) { alert('Inserisci coordinate valide'); return; }

    const animalPayload = {
      species,
      breed,
      gender,
      color,
      lunghezzaPelo,
      distinctiveFeatures
    };

    // create or update animal then announcement
    let animalIdToUse = null;
      if (editingId && editingAnimalId) {
      // update existing animal
      const aRes = await fetch(`http://localhost:3000/api/animals/${editingAnimalId}`, { method: 'PUT', headers: authHeader, body: JSON.stringify(animalPayload) });
      if (!aRes.ok) { alert('Errore aggiornamento animale'); return; }
      const aData = await aRes.json();
      animalIdToUse = aData._id;
    } else {
      // create new animal
      const animalRes = await fetch('http://localhost:3000/api/animals', { method: 'POST', headers: authHeader, body: JSON.stringify(animalPayload) });
      if (!animalRes.ok) { alert('Errore creazione animale'); return; }
      const animal = await animalRes.json();
      animalIdToUse = animal._id;
    }

    const lastSeenMode = document.getElementById('lastSeenCustomBtn').classList.contains('is-selected') ? 'custom' : 'today';
    const customDate = document.getElementById('modal-lastSeenDate').value;
    let lastSeenDate = null;
    if (lastSeenMode === 'today') {
      lastSeenDate = new Date().toISOString();
    } else if (customDate) {
      lastSeenDate = new Date(customDate).toISOString();
    }
    const isCurrentlyThere = document.getElementById('modal-isCurrentlyThere').checked;
    const animalBehaviour = document.getElementById('modal-animalBehaviour').value || null;
    const healthCondition = document.getElementById('modal-healthCondition').value || null;
    const status = editingId ? (currentEditStatus || 'ACTIVE') : 'ACTIVE';

    const body = {
      type,
      animalId: animalIdToUse,
      description: description || 'Nessuna descrizione',
      lastSeenDate: lastSeenDate || undefined,
      isCurrentlyThere,
      animalBehaviour: animalBehaviour || undefined,
      healthCondition: healthCondition || undefined,
      status
    };

    // include location coordinates
    // backend normalizeCoordinates accepts either coordinates array or location object
    const loc = { coordinates: [coordsRaw[0], coordsRaw[1]] };

    // send announcement (use FormData if a file was selected)
    if (!editingId) {
      let res;
      if (photoFile) {
        const fd = new FormData();
        fd.append('type', type);
        fd.append('animalId', animalIdToUse);
        fd.append('description', body.description);
        fd.append('coordinates', loc.coordinates.join(','));
        if (lastSeenDate) fd.append('lastSeenDate', lastSeenDate);
        fd.append('isCurrentlyThere', isCurrentlyThere);
        if (animalBehaviour) fd.append('animalBehaviour', animalBehaviour);
        if (healthCondition) fd.append('healthCondition', healthCondition);
        fd.append('status', status);
        fd.append('photo', photoFile);
        res = await fetch('http://localhost:3000/api/announcements', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd });
      } else {
        res = await fetch('http://localhost:3000/api/announcements', { method: 'POST', headers: authHeader, body: JSON.stringify({ ...body, coordinates: loc.coordinates }) });
      }
      if (!res.ok) { alert('Errore creazione annuncio'); return; }
    } else {
      let res;
      if (photoFile) {
        const fd = new FormData();
        // include same fields; backend update accepts location
        for (const k of ['type','description']) fd.append(k, body[k]);
        fd.append('location', JSON.stringify({ type: 'Point', coordinates: loc.coordinates }));
        if (body.lastSeenDate) fd.append('lastSeenDate', body.lastSeenDate);
        fd.append('isCurrentlyThere', isCurrentlyThere);
        if (animalBehaviour) fd.append('animalBehaviour', animalBehaviour);
        if (healthCondition) fd.append('healthCondition', healthCondition);
        fd.append('status', status);
        fd.append('photo', photoFile);
        res = await fetch(`http://localhost:3000/api/announcements/${editingId}`, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token }, body: fd });
      } else {
        const resJson = await fetch(`http://localhost:3000/api/announcements/${editingId}`, { method: 'PUT', headers: authHeader, body: JSON.stringify({ ...body, location: { type: 'Point', coordinates: loc.coordinates } }) });
        res = resJson;
      }
      if (!res.ok) { alert('Errore aggiornamento annuncio'); return; }
    }

    showModal(false);
    loadMyAnnouncements();
    try { localStorage.setItem('announcements:update', Date.now().toString()); } catch (e) {}
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
  document.getElementById('modal-title').textContent = 'Nuovo annuncio';
  document.getElementById('modal-save').textContent = 'Pubblica';
  document.getElementById('modal-type').value = 'LostAnimal';
  document.getElementById('modal-description').value = '';
  document.getElementById('modal-species').value = '';
  document.getElementById('modal-breed').value = '';
  document.getElementById('modal-color').value = '';
  document.getElementById('modal-gender').value = '';
  document.getElementById('modal-lunghezzaPelo').value = '';
  document.getElementById('modal-distinctiveFeatures').value = '';
  document.getElementById('modal-photo-file').value = '';
  document.getElementById('modal-photo-preview').style.display = 'none';
  document.getElementById('modal-coords').value = '';
  setLastSeenMode('today');
  document.getElementById('modal-lastSeenDate').value = '';
  document.getElementById('modal-lastSeenDate').style.display = 'none';
  document.getElementById('modal-isCurrentlyThere').checked = false;
  document.getElementById('modal-animalBehaviour').value = 'indifferente';
  document.getElementById('modal-healthCondition').value = 'in salute';
  showModal(true);
}

function openModalForEdit(ann) {
  editingId = ann._id;
  editingAnimalId = ann.animalId?._id || ann.animalId || null;
  currentEditStatus = ann.status || 'ACTIVE';
  document.getElementById('modal-title').textContent = 'Modifica annuncio';
  document.getElementById('modal-save').textContent = 'Modifica';
  document.getElementById('modal-type').value = ann.type || 'LostAnimal';
  document.getElementById('modal-description').value = ann.description || '';
  document.getElementById('modal-species').value = ann.animalId?.species || '';
  document.getElementById('modal-breed').value = ann.animalId?.breed || '';
  document.getElementById('modal-color').value = ann.animalId?.color || '';
  document.getElementById('modal-gender').value = ann.animalId?.gender || '';
  document.getElementById('modal-lunghezzaPelo').value = ann.animalId?.lunghezzaPelo || '';
  document.getElementById('modal-distinctiveFeatures').value = ann.animalId?.distinctiveFeatures || '';
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
  document.getElementById('modal-isCurrentlyThere').checked = !!ann.isCurrentlyThere;
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
