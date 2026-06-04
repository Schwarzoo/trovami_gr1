const HOME_API = '/api/v1/announcements';
const HOME_MAX_CARDS = 6;
const HOME_RESOLVED_API = '/api/v1/announcements/count?status=resolved';
const HOME_ACTIVE_API = '/api/v1/announcements/count?status=active';
const HOME_PUBLIC_RIFUGI_API = '/api/v1/users/shelters?isPublic=true';
const HOME_CURRENT_ROLE = localStorage.getItem('role') || '';

/**
 * Fetches public rifugi count data from the API.
 * @returns {Promise<number>} Number of public shelters returned by the API, or 0 on failure.
 */
async function fetchPublicRifugiCount() {
  try {
    const res = await fetch(HOME_PUBLIC_RIFUGI_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? json.length : 0;
  } catch (err) {
    console.error('Errore fetch rifugi pubblici', err);
    return 0;
  }
}

/**
 * Fetches resolved announcements count data from the API.
 * @returns {Promise<number>} Total resolved-announcement count, or 0 on failure.
 */
async function fetchResolvedAnnouncementsCount() {
  try {
    const res = await fetch(HOME_RESOLVED_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Number(json?.count ?? json?.resolvedCount ?? 0);
  } catch (err) {
    console.error('Errore fetch annunci risolti', err);
    return 0;
  }
}

/**
 * Fetches active announcements count data from the API.
 * @returns {Promise<number>} Total active-announcement count, or 0 on failure.
 */
async function fetchActiveAnnouncementsCount() {
  try {
    const res = await fetch(HOME_ACTIVE_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Number(json?.count ?? 0);
  } catch (err) {
    console.error('Errore fetch annunci attivi', err);
    return 0;
  }
}

/**
 * Returns home announcement date.
 * @param {Object} announcement - Announcement record that may contain date fields.
 * @returns {Date|null} Parsed announcement date, or null when no valid date exists.
 */
function getHomeAnnouncementDate(announcement) {
  const rawDate = announcement?.createdAt || announcement?.date || announcement?.updatedAt;
  if (!rawDate) return null;
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Checks whether same day.
 * @param {Date|null} left - First date to compare.
 * @param {Date|null} right - Second date to compare.
 * @returns {boolean} True when both dates fall on the same calendar day.
 */
function isSameDay(left, right) {
  if (!left || !right) return false;
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

/**
 * Checks whether within last24 hours.
 * @param {Date|null} date - Date to compare with the current time.
 * @returns {boolean} True when the date is within the last 24 hours.
 */
function isWithinLast24Hours(date) {
  if (!date) return false;
  return Date.now() - date.getTime() <= 24 * 60 * 60 * 1000;
}

/**
 * Builds a home-page announcement card and wires detail-opening interactions.
 * @param {Object} ann - Announcement record to render.
 * @returns {HTMLElement} Interactive card element for the home announcement grid.
 */
function buildHomeCard(ann) {
  const animal = ann.animalId;
  const publisher = ann.publisherId;
  const isLost = ann.type === 'LostAnimal';
  const isRifugioAnnouncement = publisher?.role === 'shelter';
  const rifugioName = publisher?.role === 'shelter'
    ? (publisher?.rifugioData?.rifugioName || publisher?.username)
    : '';
  const primaryTitle = animal?.name || animal?.breed || animal?.species || 'Animale';
  const distanceLabel = typeof ann._distance === 'number'
    ? `<div class="card-distance">${ann._distance < 1000 ? `${Math.round(ann._distance)} m` : `${(ann._distance / 1000).toFixed(1)} km`} da te</div>`
    : '';

  const photoUrl = `${HOME_API}/${encodeURIComponent(ann._id)}/photo`;
  const date = new Date(ann.date).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = ann._id;

  card.innerHTML = `
    <div class="card-image">
      <div class="card-image-placeholder"><span>…</span></div>
      <span class="badge badge--${isRifugioAnnouncement ? 'rifugio' : (isLost ? 'lost' : 'sighting')}">
        ${isRifugioAnnouncement ? 'Animale in rifugio' : (isLost ? 'Smarrito' : 'Avvistato')}
      </span>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-species">${animal?.species || 'Specie sconosciuta'}</span>
        <span class="card-date">${date}</span>
      </div>
      <h3 class="card-breed">${escapeHtml(primaryTitle)}</h3>
      ${animal?.name ? `<div class="card-distance">${escapeHtml(animal?.species || '')}${animal?.breed ? ` · ${escapeHtml(animal.breed)}` : ''}</div>` : ''}
      <p class="card-description">${escapeHtml(ann.description)}</p>
      ${rifugioName ? `<div class="card-distance">🏠 Rifugio: ${escapeHtml(rifugioName)}</div>` : ''}
      ${ann.isQuick ? `<div class="card-distance">⚡ Segnalazione veloce</div>` : ''}
      ${distanceLabel}
      <div class="card-details">
        <span class="card-detail-label">Colore</span><span>${displayValue(animal?.color)}</span>
        <span class="card-detail-label">Salute</span><span>${displayValue(ann.healthCondition)}</span>
        <span class="card-detail-label">Comportamento</span><span>${displayValue(ann.animalBehaviour)}</span>
      </div>
      <button class="card-cta" type="button">Vedi dettagli</button>
    </div>
  `;

  card.addEventListener('click', () => openHomeModal(ann));

  (async () => {
    const container = card.querySelector('.card-image');
    try {
      const res = await fetch(photoUrl, { method: 'GET' });
      if (!res.ok) throw new Error('no image');
      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith('image')) throw new Error('not image');
      const blob = await res.blob();
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.alt = animal?.species || 'Animale';
      img.loading = 'lazy';
      img.onload = () => { URL.revokeObjectURL(img.src); };
      const placeholder = container.querySelector('.card-image-placeholder');
      if (placeholder) placeholder.replaceWith(img);
    } catch (err) {
      const placeholder = container.querySelector('.card-image-placeholder');
      if (placeholder) placeholder.innerHTML = `<span>${animal?.species?.[0] || '?'}</span>`;
    }
  })();

  return card;
}

/**
 * Renders the comments section markup for a home announcement.
 * @param {Array<Object>} comments - Comment objects to render.
 * @returns {string} HTML string containing the rendered comments or the empty state.
 */
function renderCommentsHtml(comments) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return `<div class="comments-empty">Nessun commento</div>`;
  }

  const sorted = [...comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return sorted.map((c) => {
    const when = c?.createdAt ? new Date(c.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const uid = (c?.userId && typeof c.userId === 'object') ? (c.userId._id || c.userId.id) : c?.userId;
    const slotId = `comment-contact-${escapeHtml(c?._id || uid || Math.random().toString(16).slice(2))}`;
    return `
      <div class="comment-item">
        <div class="comment-meta">
          <button type="button" class="comment-user-link comment-user" data-user-id="${escapeHtml(uid || '')}" data-slot-id="${slotId}">${escapeHtml(c?.username || 'utente')}</button>
          <span class="comment-date">${escapeHtml(when)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c?.text || '')}</div>
        <div id="${slotId}" class="comment-contact-slot"></div>
      </div>
    `;
  }).join('');
}

/**
 * Opens the home modal UI.
 * @param {Object} ann - Announcement summary used to seed the modal while details load.
 * @returns {Promise<void>} Promise resolving after the modal is populated and shown.
 */
async function openHomeModal(ann) {
  const isLoggedIn = !!localStorage.getItem('token');
  const full = await fetchAnnouncementById(ann._id);
  const data = full || ann;
  const animal = data.animalId;
  const publisher = data.publisherId;
  const isLost = data.type === 'LostAnimal';
  const isRifugioAnnouncement = publisher?.role === 'shelter';
  const comments = Array.isArray(data.comments) ? data.comments : [];

  const date = new Date(data.date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let locationInfo = '';
  const coords = data.location?.coordinates;

  if (coords?.length === 2) {
    const link = `/pages/map.html?highlight=${encodeURIComponent(data._id)}`;
    locationInfo = `<dt>Posizione</dt><dd><a class="modal-map-btn" href="${link}">Vedi sulla mappa</a></dd>`;
  }

  const rifugioAddress = [publisher?.rifugioData?.address, publisher?.rifugioData?.city]
    .filter(Boolean)
    .join(', ');
  const rifugioCoords = publisher?.rifugioData?.location?.coordinates;
  const rifugioLocationHtml = publisher?.role === 'shelter'
    ? `
      ${rifugioAddress ? `<span>${escapeHtml(rifugioAddress)}</span>` : ''}
      ${Array.isArray(rifugioCoords) && rifugioCoords.length === 2 ? `<a href="/pages/map.html?rifugioId=${encodeURIComponent(publisher._id)}">Vedi posizione rifugio</a>` : ''}
    `
    : '';
  const shelterAnimalLinkHtml = isRifugioAnnouncement && animal?._id
    ? `<a class="position-link" href="/pages/rifugio.html?rifugioId=${encodeURIComponent(publisher?._id || publisher)}&animalId=${encodeURIComponent(animal._id)}">Apri scheda animale</a>`
    : '';

  const rifugioLink = isRifugioAnnouncement && animal?._id
    ? `/pages/rifugio.html?rifugioId=${encodeURIComponent(publisher?._id || publisher)}&animalId=${encodeURIComponent(animal._id)}`
    : null;

  const shelterName = publisher?.rifugioData?.rifugioName || publisher?.username;
  if (isRifugioAnnouncement) {
    const displayName = shelterName || 'il rifugio';
    document.getElementById('modal-title').textContent = `Questo animale si trova attualmente al rifugio ${displayName}`;
  } else {
    document.getElementById('modal-title').textContent =
      (animal?.name || (isLost ? `${animal?.species} smarrito/a` : `Avvistamento: ${animal?.species}`));
  }

  const gallery = document.getElementById('modal-gallery');
  gallery.innerHTML = '<div class="modal-spinner">…</div>';

  (async () => {
    const photoUrl = `${HOME_API}/${encodeURIComponent(data._id)}/photo`;
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

      const wrapper = document.createElement('div');
      wrapper.className = 'modal-gallery-wrapper';
      wrapper.appendChild(img);

      if (rifugioLink) {
        const btn = document.createElement('button');
        btn.className = 'modal-open-animal-btn';
        btn.type = 'button';
        btn.textContent = 'Scheda animale';
        btn.setAttribute('aria-label', 'Apri scheda animale');
        btn.addEventListener('click', (event) => {
          event.stopPropagation();
          window.location.href = rifugioLink;
        });
        wrapper.appendChild(btn);
      }

      gallery.innerHTML = '';
      gallery.appendChild(wrapper);
    } catch (err) {
      if (rifugioLink) {
        const wrapper = document.createElement('div');
        wrapper.className = 'modal-gallery-wrapper';
        const noPhoto = document.createElement('div');
        noPhoto.className = 'modal-no-photo';
        noPhoto.textContent = 'Non è presente alcuna foto';
        wrapper.appendChild(noPhoto);
        const btn = document.createElement('button');
        btn.className = 'modal-open-animal-btn';
        btn.type = 'button';
        btn.textContent = 'Scheda animale';
        btn.setAttribute('aria-label', 'Apri scheda animale');
        btn.addEventListener('click', (event) => {
          event.stopPropagation();
          window.location.href = rifugioLink;
        });
        wrapper.appendChild(btn);
        gallery.innerHTML = '';
        gallery.appendChild(wrapper);
      } else {
        gallery.innerHTML = '<div class="modal-no-photo">Non è presente alcuna foto</div>';
      }
    }
  })();

  const commentBoxHtml = isLoggedIn
    ? `
      <form class="comment-form" data-announcement-id="${escapeHtml(data._id)}">
        <label class="comment-label" for="comment-text">Commento</label>
        <textarea id="comment-text" class="comment-textarea" rows="3" maxlength="500" placeholder="Scrivi un aggiornamento (es. direzione)…"></textarea>
        <div class="comment-actions">
          <span class="comment-hint">Max 500 caratteri</span>
          <button type="submit" class="comment-submit">Invia</button>
        </div>
        <div class="comment-error" role="status" aria-live="polite"></div>
      </form>
    `
    : `<div class="comments-locked">🔒 Accedi per commentare</div>`;

  const reportBoxHtml = isLoggedIn
    ? `
      <section class="comments-section" aria-label="Segnala annuncio">
        <div class="comments-header">
          <h3>Segnala annuncio</h3>
        </div>
        <form class="report-form" data-announcement-id="${escapeHtml(data._id)}">
          <label class="comment-label" for="report-reason">Motivo</label>
          <select id="report-reason" class="report-select">
            <option value="troll">Troll</option>
            <option value="offensivo">Offensivo</option>
            <option value="falso">Non reale</option>
            <option value="altro">Altro</option>
          </select>
          <label class="comment-label" for="report-details">Dettagli</label>
          <textarea id="report-details" class="comment-textarea" rows="2" maxlength="500" placeholder="Aggiungi dettagli utili"></textarea>
          <div class="comment-actions">
            <span class="comment-hint">Visibile agli admin</span>
            <button type="submit" class="comment-submit">Segnala</button>
          </div>
          <div class="report-message comment-error" role="status" aria-live="polite"></div>
        </form>
      </section>
    `
    : '';

  const adminResolveBoxHtml = HOME_CURRENT_ROLE === 'admin' && data.status !== 'RESOLVED'
    ? `
      <section class="comments-section" aria-label="Moderazione annuncio">
        <div class="comments-header">
          <h3>Moderazione</h3>
        </div>
        <button type="button" class="comment-submit" id="admin-resolve-announcement">Segna come risolto</button>
      </section>
    `
    : '';

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
      <dt>Data</dt><dd>${date}</dd>
      <dt>Condizioni</dt><dd>${displayValue(data.healthCondition)}</dd>
      <dt>Comportamento</dt><dd>${displayValue(data.animalBehaviour)}</dd>
    </dl>

    <div class="modal-contact">
      <div class="modal-contact-header">Contatti</div>
      ${isLoggedIn
        ? `<div class="modal-contact-name">Nome: ${escapeHtml(publisher?.rifugioData?.rifugioName || publisher?.username || '—')}</div>
           <div class="modal-contact-links">
             ${publisher?.phoneNumber ? `<a href="tel:${publisher.phoneNumber}">📞 ${escapeHtml(publisher.phoneNumber)}</a>` : ''}
             ${publisher?.email ? `<a href="mailto:${publisher.email}">${escapeHtml(publisher.email)}</a>` : ''}
           </div>
           ${rifugioLocationHtml || shelterAnimalLinkHtml ? `<div class="modal-contact-extra">${rifugioLocationHtml}${shelterAnimalLinkHtml}</div>` : ''}
           ${!publisher?.phoneNumber && !publisher?.email ? '<span class="contact-locked">Nessun contatto pubblico disponibile</span>' : ''}`
        : `<span class="contact-locked">🔒 Accedi per vedere i contatti del segnalante</span>`
      }
    </div>

    <section class="comments-section" aria-label="Commenti">
      <div class="comments-header">
        <h3>Commenti</h3>
        <span class="comments-count">${comments.length}</span>
      </div>
      ${commentBoxHtml}
      <div id="comments-list" class="comments-list">
        ${renderCommentsHtml(comments)}
      </div>
    </section>
    ${reportBoxHtml}
    ${adminResolveBoxHtml}
  `;

  const form = document.querySelector('.comment-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const textarea = form.querySelector('.comment-textarea');
      const errorBox = form.querySelector('.comment-error');
      const list = document.getElementById('comments-list');
      const count = document.querySelector('.comments-count');

      const text = (textarea?.value ?? '').trim();
      if (!text) {
        errorBox.textContent = 'Scrivi testo';
        return;
      }

      errorBox.textContent = '';
      form.querySelector('.comment-submit').disabled = true;

      try {
        const result = await postAnnouncementComment(data._id, text);
        const updated = Array.isArray(result.comments) ? result.comments : [];
        textarea.value = '';
        if (list) list.innerHTML = renderCommentsHtml(updated);
        if (count) count.textContent = String(updated.length);
      } catch (err) {
        errorBox.textContent = err.message || 'Errore invio commento';
      } finally {
        form.querySelector('.comment-submit').disabled = false;
      }
    });
  }

  const reportForm = document.querySelector('.report-form');
  if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reason = reportForm.querySelector('#report-reason')?.value || 'altro';
      const details = reportForm.querySelector('#report-details')?.value.trim() || '';
      const message = reportForm.querySelector('.report-message');
      const submit = reportForm.querySelector('.comment-submit');

      if (message) {
        message.textContent = '';
        message.classList.remove('success');
      }
      submit.disabled = true;

      try {
        await postAnnouncementReport(data._id, reason, details);
        if (message) {
          message.textContent = 'Segnalazione inviata agli admin';
          message.style.color = '#166534';
        }
        reportForm.reset();
      } catch (err) {
        if (message) {
          message.textContent = err.message || 'Errore invio segnalazione';
          message.style.color = '';
        }
      } finally {
        submit.disabled = false;
      }
    });
  }

  const resolveButton = document.getElementById('admin-resolve-announcement');
  if (resolveButton) {
    resolveButton.addEventListener('click', async () => {
      if (!confirm('Segnare l\'annuncio come risolto?')) return;
      resolveButton.disabled = true;
      try {
        await patchAnnouncementStatus(data._id, 'RESOLVED');
        window.dispatchEvent(new Event('announcements:resolved-updated'));
        closeHomeModal();
      } catch (err) {
        alert(err.message || 'Errore aggiornamento stato');
      } finally {
        resolveButton.disabled = false;
      }
    });
  }

  const modalBody = document.getElementById('modal-body');
  if (modalBody && modalBody.dataset.commentContactsBound !== 'true') {
    modalBody.dataset.commentContactsBound = 'true';
    modalBody.addEventListener('click', async (e) => {
      const btn = e.target?.closest?.('.comment-user-link');
      if (!btn) return;
      const userId = btn.getAttribute('data-user-id');
      if (!userId) return;

      const slotId = btn.getAttribute('data-slot-id');
      const slot = slotId ? document.getElementById(slotId) : null;
      if (!slot) return;

      if (slot.dataset.loaded === 'true') {
        slot.dataset.loaded = 'false';
        slot.innerHTML = '';
        slot.style.display = 'none';
        return;
      }

      slot.dataset.loaded = 'true';
      slot.style.display = 'block';
      slot.innerHTML = '<div class="comment-text">Caricamento…</div>';

      try {
        const u = await fetchPublicUser(userId);
        const parts = [];
        if (u.phoneNumber) parts.push(`<a href="tel:${escapeHtml(u.phoneNumber)}">${escapeHtml(u.phoneNumber)}</a>`);
        if (u.email) parts.push(`<a href="mailto:${escapeHtml(u.email)}">${escapeHtml(u.email)}</a>`);
        slot.innerHTML = `
          <div class="modal-contact modal-contact--inline">
            <strong>Contatto:</strong>
            <span>${escapeHtml(u.username || '—')}</span>
            ${parts.join('')}
            ${parts.length === 0 ? '<span class="contact-locked">Nessun contatto pubblico</span>' : ''}
          </div>
        `;
      } catch (err) {
        slot.innerHTML = `<div class="comment-error">${escapeHtml(err.message || 'Errore')}</div>`;
      }
    });
  }

  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Closes the home modal UI.
 * @returns {void}
 */
function closeHomeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * Renders hero stats into the current page.
 * @returns {Promise<void>} Promise resolving after hero counters are refreshed.
 */
async function renderHeroStats() {
  const resolvedCounter = document.getElementById('resolved-announcements-count');
  const activeCounter = document.getElementById('active-announcements-count');
  const rifugiCounter = document.getElementById('public-rifugi-count');
  if (!resolvedCounter && !activeCounter && !rifugiCounter) return;

  const [activeCount, resolvedCount, rifugiCount] = await Promise.all([
    fetchActiveAnnouncementsCount(),
    fetchResolvedAnnouncementsCount(),
    fetchPublicRifugiCount()
  ]);

  if (resolvedCounter) resolvedCounter.textContent = String(resolvedCount);
  if (activeCounter) activeCounter.textContent = String(activeCount);
  if (rifugiCounter) rifugiCounter.textContent = String(rifugiCount);
}

/**
 * Renders home stats strip into the current page.
 * @returns {Promise<void>} Promise resolving after the home stats strip is refreshed.
 */
async function renderHomeStatsStrip() {
  const last24hCounter = document.getElementById('home-last-24h-count');
  const createdTodayCounter = document.getElementById('home-created-today-count');
  const resolvedTotalCounter = document.getElementById('home-resolved-total-count');
  const resolvedTotalInline = document.getElementById('home-resolved-total-inline');
  if (!last24hCounter && !createdTodayCounter && !resolvedTotalCounter && !resolvedTotalInline) return;

  const [announcements, resolvedTotalCount] = await Promise.all([
    fetchAnnouncements(),
    fetchResolvedAnnouncementsCount()
  ]);
  const now = new Date();

  const last24hCount = Array.isArray(announcements)
    ? announcements.filter((announcement) => isWithinLast24Hours(getHomeAnnouncementDate(announcement))).length
    : 0;

  const createdTodayCount = Array.isArray(announcements)
    ? announcements.filter((announcement) => isSameDay(getHomeAnnouncementDate(announcement), now)).length
    : 0;

  if (last24hCounter) last24hCounter.textContent = String(last24hCount);
  if (createdTodayCounter) createdTodayCounter.textContent = String(createdTodayCount);
  if (resolvedTotalCounter) resolvedTotalCounter.textContent = String(resolvedTotalCount);
  if (resolvedTotalInline) resolvedTotalInline.textContent = String(resolvedTotalCount);
}

/**
 * Loads the home announcement grid and binds modal controls.
 * @returns {Promise<void>} Promise resolving after initial home announcements are rendered.
 */
async function initHomeAnnouncements() {
  const grid = document.getElementById('home-announcements-grid');
  const empty = document.getElementById('home-empty');
  if (!grid || !empty) return;

  document.getElementById('modal-overlay')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeHomeModal();
  });
  document.getElementById('modal-close')?.addEventListener('click', closeHomeModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeHomeModal();
  });

  const announcements = await fetchAnnouncements();
  const trimmed = announcements.slice(0, HOME_MAX_CARDS);

  if (trimmed.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  trimmed.forEach((ann) => grid.appendChild(buildHomeCard(ann)));
}

/**
 * Initializes home page data and recurring stats refresh after the DOM is ready.
 * @returns {Promise<void>} Promise resolving when the initial home widgets are loaded.
 */
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([initHomeAnnouncements(), renderHeroStats(), renderHomeStatsStrip()]);
  window.addEventListener('announcements:resolved-updated', renderHeroStats);
  setInterval(renderHeroStats, 30000);
});

