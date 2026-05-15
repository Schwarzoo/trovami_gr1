function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch (e) { return null; }
}

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/pages/login.html';
}

const authHeader = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
const mePayload = decodeJwt(token) || {};
const myUserId = mePayload.userId;

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

async function load() {
  const me = await fetchMe();
  if (!me) { localStorage.removeItem('token'); window.location.href = '/pages/login.html'; return; }

  document.getElementById('username').value = me.username || '';
  document.getElementById('email').value = me.email || '';
  document.getElementById('phoneNumber').value = me.phoneNumber || '';

  loadMyAnnouncements();
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const updates = { username: document.getElementById('username').value, phoneNumber: document.getElementById('phoneNumber').value };
  const res = await fetch('http://localhost:3000/api/users/me', { method: 'PUT', headers: authHeader, body: JSON.stringify(updates) });
  const data = await res.json();
  document.getElementById('profileMessage').textContent = res.ok ? 'Profilo aggiornato' : (data.message || 'Errore');
});

document.getElementById('logoutBtn').addEventListener('click', handleLogout);

document.getElementById('showCreate').addEventListener('click', () => {
  const f = document.getElementById('createForm'); f.style.display = f.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('createSubmit').addEventListener('click', async () => {
  const type = document.getElementById('new-type').value;
  const description = document.getElementById('new-description').value;
  const coordsRaw = document.getElementById('new-coords').value.split(',').map(s => parseFloat(s.trim()));
  const photo = document.getElementById('new-photo').value;
  const species = document.getElementById('new-species').value || 'Sconosciuta';
  const breed = document.getElementById('new-breed').value || '';

  if (!coordsRaw || coordsRaw.length !== 2 || isNaN(coordsRaw[0]) || isNaN(coordsRaw[1])) { document.getElementById('createMsg').textContent = 'Coordinate non valide'; return; }

  // create animal first
  const animalRes = await fetch('http://localhost:3000/api/animals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ species, breed, gender: 'Sconosciuto', color: 'sconosciuto', lunghezzaPelo: 'Senza', photos: photo ? [photo] : [] }) });
  if (!animalRes.ok) { document.getElementById('createMsg').textContent = 'Errore creazione animale'; return; }
  const animal = await animalRes.json();

  const body = {
    type,
    animalId: animal._id,
    description,
    coordinates: [coordsRaw[0], coordsRaw[1]]
  };

  const res = await fetch('http://localhost:3000/api/announcements', { method: 'POST', headers: authHeader, body: JSON.stringify(body) });
  const data = await res.json();
  document.getElementById('createMsg').textContent = res.ok ? 'Annuncio creato' : (data.message || 'Errore');
  if (res.ok) loadMyAnnouncements();
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
    div.innerHTML = `
      <div class="card-image">${a.animalId && a.animalId.photos && a.animalId.photos[0] ? `<img src="${a.animalId.photos[0]}"/>` : `<div class="card-image-placeholder">🐾</div>`}</div>
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
  });

  // attach actions
  document.querySelectorAll('button.edit').forEach(b => b.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    const newDesc = prompt('Nuova descrizione:');
    if (newDesc === null) return;
    const res = await fetch(`http://localhost:3000/api/announcements/${id}`, { method: 'PUT', headers: authHeader, body: JSON.stringify({ description: newDesc }) });
    if (res.ok) loadMyAnnouncements(); else alert('Errore aggiornamento');
  }));

  document.querySelectorAll('button.close').forEach(b => b.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (!confirm('Segni l\'annuncio come risolto?')) return;
    const res = await fetch(`http://localhost:3000/api/announcements/${id}/status`, { method: 'PATCH', headers: authHeader, body: JSON.stringify({ status: 'RESOLVED' }) });
    if (res.ok) loadMyAnnouncements(); else alert('Errore chiusura');
  }));

  document.querySelectorAll('button.del').forEach(b => b.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (!confirm('Eliminare annuncio?')) return;
    const res = await fetch(`http://localhost:3000/api/announcements/${id}`, { method: 'DELETE', headers: authHeader });
    if (res.ok) loadMyAnnouncements(); else alert('Errore eliminazione');
  }));
}

load();

// Modal and map picker logic
let mapInstance = null;
let mapMarker = null;
let editingId = null;
let editingAnimalId = null;

function openModalForCreate() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Nuovo annuncio';
  document.getElementById('modal-type').value = 'LostAnimal';
  document.getElementById('modal-description').value = '';
  document.getElementById('modal-species').value = '';
  document.getElementById('modal-breed').value = '';
  document.getElementById('modal-photo').value = '';
  document.getElementById('modal-photo-preview').style.display = 'none';
  document.getElementById('modal-coords').value = '';
  showModal(true);
}

function openModalForEdit(ann) {
  editingId = ann._id;
  editingAnimalId = ann.animalId?._id || ann.animalId || null;
  document.getElementById('modal-title').textContent = 'Modifica annuncio';
  document.getElementById('modal-type').value = ann.type || 'LostAnimal';
  document.getElementById('modal-description').value = ann.description || '';
  document.getElementById('modal-species').value = ann.animalId?.species || '';
  document.getElementById('modal-breed').value = ann.animalId?.breed || '';
  const photo = ann.animalId?.photos?.[0] || '';
  document.getElementById('modal-photo').value = photo;
  if (photo) { const el = document.getElementById('modal-photo-preview'); el.src = photo; el.style.display = 'block'; }
  const coords = ann.location?.coordinates; if (coords) document.getElementById('modal-coords').value = coords.join(',');
  showModal(true);
}

function showModal(visible) {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = visible ? 'flex' : 'none';
  if (visible) initMapPicker(); else destroyMapPicker();
}

function initMapPicker() {
  if (mapInstance) return;
  mapInstance = L.map('modal-map').setView([46.0667,11.1333], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(mapInstance);
  mapInstance.on('click', function(e){
    const { lat, lng } = e.latlng;
    setMarker(lng, lat);
    document.getElementById('modal-coords').value = `${lng.toFixed(6)},${lat.toFixed(6)}`;
  });
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
}

document.getElementById('pickOnMap').addEventListener('click', () => {
  const mm = document.getElementById('modal-map'); mm.style.display = 'block';
  initMapPicker();
});

document.getElementById('modal-photo').addEventListener('input', (e)=>{
  const url = e.target.value.trim();
  const img = document.getElementById('modal-photo-preview');
  if (!url) { img.style.display='none'; img.src=''; return; }
  img.src = url; img.style.display = 'block';
});

document.getElementById('modal-close').addEventListener('click', ()=> showModal(false));
document.getElementById('modal-cancel').addEventListener('click', ()=> showModal(false));

// Save from modal: create or update
document.getElementById('modal-save').addEventListener('click', async () => {
  const type = document.getElementById('modal-type').value;
  const description = document.getElementById('modal-description').value;
  const species = document.getElementById('modal-species').value || 'Sconosciuta';
  const breed = document.getElementById('modal-breed').value || '';
  const photo = document.getElementById('modal-photo').value;
  const coordsRaw = document.getElementById('modal-coords').value.split(',').map(s => parseFloat(s.trim()));

  if (!coordsRaw || coordsRaw.length !== 2 || isNaN(coordsRaw[0]) || isNaN(coordsRaw[1])) { alert('Inserisci coordinate valide'); return; }

  // create or update animal then announcement
  let animalIdToUse = null;
  if (editingId && editingAnimalId) {
    // update existing animal
    const aRes = await fetch(`http://localhost:3000/api/animals/${editingAnimalId}`, { method: 'PUT', headers: authHeader, body: JSON.stringify({ species, breed, photos: photo ? [photo] : [] }) });
    if (!aRes.ok) { alert('Errore aggiornamento animale'); return; }
    const aData = await aRes.json();
    animalIdToUse = aData._id;
  } else {
    // create new animal
    const animalRes = await fetch('http://localhost:3000/api/animals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ species, breed, gender: 'Sconosciuto', color: 'sconosciuto', lunghezzaPelo: 'Senza', photos: photo ? [photo] : [] }) });
    if (!animalRes.ok) { alert('Errore creazione animale'); return; }
    const animal = await animalRes.json();
    animalIdToUse = animal._id;
  }

  const body = { type, animalId: animalIdToUse, description, coordinates: [coordsRaw[0], coordsRaw[1]] };

  if (!editingId) {
    const res = await fetch('http://localhost:3000/api/announcements', { method: 'POST', headers: authHeader, body: JSON.stringify(body) });
    if (!res.ok) { alert('Errore creazione annuncio'); return; }
  } else {
    const res = await fetch(`http://localhost:3000/api/announcements/${editingId}`, { method: 'PUT', headers: authHeader, body: JSON.stringify({ ...body, description }) });
    if (!res.ok) { alert('Errore aggiornamento annuncio'); return; }
  }

  showModal(false);
  loadMyAnnouncements();
});

// open create modal when clicking create
document.getElementById('showCreate').addEventListener('click', (e) => { e.preventDefault(); openModalForCreate(); });

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
