const API_BASE = 'http://localhost:3000/api/v1/announcements';
const ADMIN_BASE = 'http://localhost:3000/api/v1/admin';

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
  return text || '- -';
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function showError(message) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.textContent = message;
  banner.style.display = 'block';
}

function authHeader() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || ''}`
  };
}

async function fetchAnnouncementById(id) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Errore caricamento annuncio');
  return res.json();
}

async function readResponseError(res, fallback) {
  const json = await res.json().catch(() => ({}));
  return json?.message || `${fallback} (${res.status})`;
}

async function warnUser(userId) {
  const reason = prompt('Motivo avvertimento:', 'Ammonimento da moderazione account');
  if (reason === null) return;
  const warnReason = reason.trim() || 'Ammonimento da moderazione account';
  const res = await fetch(`${ADMIN_BASE}/users/${encodeURIComponent(userId)}/warnings`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ reason: warnReason })
  });
  if (!res.ok) throw new Error(await readResponseError(res, 'Errore avvertimento'));
  alert('Avvertimento inviato');
}

async function blockUser(userId) {
  const reason = prompt('Motivo blocco account:', 'Violazione delle regole della community');
  if (reason === null) return;
  const blockReason = reason.trim() || 'Account bloccato da admin';
  const res = await fetch(`${ADMIN_BASE}/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify({ status: 'blocked', reason: blockReason })
  });
  if (!res.ok) throw new Error(await readResponseError(res, 'Errore blocco'));
  alert('Account bloccato');
  await loadUserAnnouncements();
}

function renderCommentsHtml(comments) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return '<div class="comments-empty">Nessun commento</div>';
  }

  return [...comments]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((comment) => {
      const when = comment?.createdAt ? new Date(comment.createdAt).toLocaleString('it-IT') : '';
      return `
        <div class="comment-item">
          <div class="comment-meta">
            <span class="comment-user">${escapeHtml(comment?.username || 'utente')}</span>
            <span class="comment-date">${escapeHtml(when)}</span>
          </div>
          <div class="comment-text">${escapeHtml(comment?.text || '')}</div>
        </div>
      `;
    })
    .join('');
}

function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

async function openModal(ann) {
  let data = ann;
  try {
    data = await fetchAnnouncementById(ann._id);
  } catch (err) {
    showError(err.message || 'Errore caricamento annuncio');
  }

  const animal = data.animalId || {};
  const publisher = data.publisherId || {};
  const isLost = data.type === 'LostAnimal';
  const isRifugioAnnouncement = publisher?.role === 'shelter';
  const comments = Array.isArray(data.comments) ? data.comments : [];
  const coords = data.location?.coordinates;
  const date = data.date
    ? new Date(data.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
  const locationInfo = coords?.length === 2
    ? `<dt>Posizione</dt><dd><a class="position-link" href="map.html?highlight=${encodeURIComponent(data._id)}"><em>trovami</em></a></dd>`
    : '';
  const rifugioAddress = [publisher?.rifugioData?.address, publisher?.rifugioData?.city].filter(Boolean).join(', ');
  const rifugioCoords = publisher?.rifugioData?.location?.coordinates;
  const rifugioLocationHtml = publisher?.role === 'shelter'
    ? `
        ${rifugioAddress ? `<span>${escapeHtml(rifugioAddress)}</span>` : ''}
        ${Array.isArray(rifugioCoords) && rifugioCoords.length === 2 ? `<a href="map.html?rifugioId=${encodeURIComponent(publisher._id)}">Vedi posizione rifugio</a>` : ''}
      `
    : '';

  document.getElementById('modal-title').textContent =
    animal?.name || (isRifugioAnnouncement ? 'Animale in rifugio' : (isLost ? `${animal?.species} smarrito/a` : `Avvistamento: ${animal?.species}`));

  const gallery = document.getElementById('modal-gallery');
  gallery.innerHTML = '<div class="modal-spinner">...</div>';
  (async () => {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(data._id)}/photo`);
      if (!res.ok) throw new Error('no image');
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.startsWith('image')) throw new Error('not image');
      const blob = await res.blob();
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.alt = 'foto animale';
      img.onload = () => URL.revokeObjectURL(img.src);
      gallery.innerHTML = '';
      gallery.appendChild(img);
    } catch (err) {
      gallery.innerHTML = '<div class="modal-no-photo">Non e presente alcuna foto</div>';
    }
  })();

  document.getElementById('modal-body').innerHTML = `
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
      <dt>Data</dt><dd>${escapeHtml(date)}</dd>
      <dt>Condizioni</dt><dd>${displayValue(data.healthCondition)}</dd>
      <dt>Comportamento</dt><dd>${displayValue(data.animalBehaviour)}</dd>
      <dt>Stato</dt><dd>${displayValue(data.status)}</dd>
    </dl>
    <p class="modal-description">${escapeHtml(data.description || '')}</p>

    <section class="comments-section" aria-label="Commenti">
      <div class="comments-header">
        <h3>Commenti</h3>
        <span class="comments-count">${comments.length}</span>
      </div>
      <div id="comments-list" class="comments-list">
        ${renderCommentsHtml(comments)}
      </div>
    </section>

    <div class="modal-contact">
      <strong>Contatto:</strong>
      <span>${escapeHtml(publisher?.rifugioData?.rifugioName || publisher?.username || '-')}</span>
      ${publisher?.phoneNumber ? `<a href="tel:${publisher.phoneNumber}">${escapeHtml(publisher.phoneNumber)}</a>` : ''}
      ${publisher?.email ? `<a href="mailto:${publisher.email}">${escapeHtml(publisher.email)}</a>` : ''}
      ${rifugioLocationHtml}
    </div>
  `;

  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function buildCard(ann) {
  const animal = ann.animalId || {};
  const publisher = ann.publisherId || {};
  const isLost = ann.type === 'LostAnimal';
  const isRifugioAnnouncement = publisher?.role === 'shelter';
  const date = ann.date ? new Date(ann.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-image">
      <div class="card-image-placeholder"><span>...</span></div>
      <span class="badge badge--${isRifugioAnnouncement ? 'rifugio' : (isLost ? 'lost' : 'sighting')}">
        ${isRifugioAnnouncement ? 'Animale in rifugio' : (isLost ? 'Smarrito' : 'Avvistato')}
      </span>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-species">${escapeHtml(animal.species || 'Specie sconosciuta')}</span>
        <span class="card-date">${escapeHtml(date)}</span>
      </div>
      <h3 class="card-breed">${escapeHtml(animal.name || animal.breed || animal.species || 'Animale')}</h3>
      <p class="card-description">${escapeHtml(ann.description || '')}</p>
      <div class="card-details">
        <span class="card-detail-label">Razza</span><span>${displayValue(animal.breed)}</span>
        <span class="card-detail-label">Colore</span><span>${displayValue(animal.color)}</span>
        <span class="card-detail-label">Stato</span><span>${displayValue(ann.status)}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openModal(ann));

  const photoUrl = `${API_BASE}/${encodeURIComponent(ann._id)}/photo`;
  (async () => {
    const container = card.querySelector('.card-image');
    try {
      const res = await fetch(photoUrl);
      if (!res.ok) throw new Error('no image');
      const blob = await res.blob();
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.alt = animal.species || 'Animale';
      img.onload = () => URL.revokeObjectURL(img.src);
      container.querySelector('.card-image-placeholder')?.replaceWith(img);
    } catch (err) {
      const placeholder = container.querySelector('.card-image-placeholder');
      if (placeholder) placeholder.innerHTML = `<span>${escapeHtml((animal.species || '?')[0])}</span>`;
    }
  })();

  return card;
}

async function loadUserAnnouncements() {
  const userId = getQueryParam('userId');
  const user = getQueryParam('user');
  setupAdminActions(userId);
  if (user) {
    document.getElementById('user-announcements-title').textContent = `Annunci di: ${user}`;
  }
  if (!userId) {
    showError('Utente non specificato.');
    return;
  }

  const res = await fetch(`${API_BASE}?userId=${encodeURIComponent(userId)}&status=all`);
  const data = await res.json().catch(() => []);
  if (!res.ok || !Array.isArray(data)) {
    showError('Impossibile caricare gli annunci utente.');
    return;
  }

  const grid = document.getElementById('announcements-grid');
  const empty = document.getElementById('empty-state');
  grid.innerHTML = '';
  if (data.length === 0) {
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  data.forEach((ann) => grid.appendChild(buildCard(ann)));
}

function setupAdminActions(userId) {
  const warnButton = document.getElementById('warn-user');
  const blockButton = document.getElementById('block-user');
  if (!userId) {
    warnButton?.setAttribute('disabled', 'disabled');
    blockButton?.setAttribute('disabled', 'disabled');
    return;
  }

  warnButton?.addEventListener('click', async () => {
    try {
      await warnUser(userId);
    } catch (err) {
      alert(err.message || 'Errore avvertimento');
    }
  });

  blockButton?.addEventListener('click', async () => {
    try {
      await blockUser(userId);
    } catch (err) {
      alert(err.message || 'Errore blocco');
    }
  });
}

document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', (event) => {
  if (event.target?.id === 'modal-overlay') closeModal();
});

loadUserAnnouncements();
