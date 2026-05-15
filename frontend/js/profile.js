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
