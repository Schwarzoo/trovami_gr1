const API_BASE = '/api/v1/announcements';
const CURRENT_ROLE = localStorage.getItem('role') || '';

let allAnnouncements = [];
let currentLocation = null;
let sortByProximity = false;
const EMPTY_VALUE = '- -';

/**
 * Formats a value for display, replacing null, undefined, or blank text with a placeholder.
 * @param {*} value - Value to format for UI display.
 * @returns {string} The formatted display value or the empty-value placeholder.
 */
function displayValue(value) {
    if (value === null || value === undefined) return EMPTY_VALUE;
    const text = String(value).trim();
    return text ? text : EMPTY_VALUE;
}

/**
 * Escapes HTML-sensitive characters in a value before injecting it into markup.
 * @param {*} input - Value to escape.
 * @returns {string} HTML-safe string representation of the input.
 */
function escapeHtml(input) {
    return String(input ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}


/**
 * Fetches the announcements list from the API using optional query parameters.
 * @param {Object} [params={}] - Query parameters to append to the announcements API URL.
 * @returns {Promise<Array<Object>>} Promise resolving to an array of announcements, or an empty array on failure.
 */
async function fetchAnnouncements(params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_BASE}?${query}` : API_BASE;

    try {
        const res = await fetch(url);
        const json = await res.json();
        return Array.isArray(json) ? json : json.data || [];
    } catch (err) {
        showError('Impossibile caricare gli annunci. Riprova più tardi.');
        return [];
    }
}

/**
 * Fetches a single announcement by its identifier.
 * @param {string} id - Announcement identifier.
 * @returns {Promise<Object|null>} Promise resolving to the announcement object, or null when not found or on failure.
 */
async function fetchAnnouncementById(id) {
    try {
        const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        return null;
    }
}

/**
 * Sends a new comment for an announcement.
 * @param {string} id - Announcement identifier.
 * @param {string} text - Comment text to submit.
 * @returns {Promise<Object>} Promise resolving to the API response JSON.
 * @throws {Error} Throws when the user is not logged in or when the API returns an HTTP error response.
 */
async function postAnnouncementComment(id, text) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('not logged in');

    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = json?.userMessage || json?.message || 'Errore invio commento';
        throw new Error(msg);
    }
    return json;
}

/**
 * Sends a report for an announcement.
 * @param {string} id - Announcement identifier.
 * @param {string} reason - Report reason selected by the user.
 * @param {string} details - Additional report details.
 * @returns {Promise<Object>} Promise resolving to the API response JSON.
 * @throws {Error} Throws when the user is not logged in or when the API returns an HTTP error response.
 */
async function postAnnouncementReport(id, reason, details) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('not logged in');

    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/reports`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason, details })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.userMessage || json?.message || 'Errore invio segnalazione');
    return json;
}

/**
 * Updates the moderation status of an announcement.
 * @param {string} id - Announcement identifier.
 * @param {string} status - Status value to apply to the announcement.
 * @returns {Promise<Object>} Promise resolving to the API response JSON.
 * @throws {Error} Throws when the user is not logged in or when the API returns an HTTP error response.
 */
async function patchAnnouncementStatus(id, status) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('not logged in');

    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.userMessage || json?.message || 'Errore aggiornamento stato');
    return json;
}

/**
 * Fetches public contact data for a user.
 * @param {string} userId - User identifier.
 * @returns {Promise<Object>} Promise resolving to the public user data returned by the API.
 * @throws {Error} Throws when the user is not logged in or when the API returns an HTTP error response.
 */
async function fetchPublicUser(userId) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('not logged in');
    const res = await fetch(`/api/v1/users/${encodeURIComponent(userId)}/public`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.userMessage || json?.message || 'Errore caricamento contatti');
    return json;
}


/**
 * Renders announcement cards into the announcements grid and toggles the empty state.
 * @param {Array<Object>} announcements - Announcements to render.
 * @returns {void}
 */
function renderCards(announcements) {
    const grid = document.getElementById('announcements-grid');
    const empty = document.getElementById('empty-state');

    grid.innerHTML = '';

    if (announcements.length === 0) {
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';

    announcements.forEach((ann, i) => {
        const card = buildCard(ann);
        card.style.animationDelay = `${i * 60}ms`;
        grid.appendChild(card);
    });
}

/**
 * Builds a DOM card element for an announcement and wires its modal/image behavior.
 * @param {Object} ann - Announcement data used to create the card.
 * @returns {HTMLElement} The created announcement card element.
 */
function buildCard(ann) {
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

    const photoUrl = `/api/v1/announcements/${ann._id}/photo`;
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

    card.addEventListener('click', () => openModal(ann));

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
 * Opens the announcement detail modal, loads full data, and binds modal actions.
 * @param {Object} ann - Announcement summary or full announcement data.
 * @returns {Promise<void>} Promise resolving when the modal has been populated and opened.
 */
async function openModal(ann) {
    const isLoggedIn = !!localStorage.getItem('token'); // check auth
    const full = await fetchAnnouncementById(ann._id);
    const data = full || ann;

    const animal = data.animalId;
    const publisher = data.publisherId;
    const isLost = data.type === 'LostAnimal';
    const isRifugioAnnouncement = publisher?.role === 'shelter';
    const comments = Array.isArray(data.comments) ? data.comments : [];

    const date = new Date(data.date).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let locationInfo = '';
    const coords = data.location?.coordinates;

    if (coords?.length === 2) {
        const link = `map.html?highlight=${encodeURIComponent(data._id)}`;
        locationInfo = `<dt>Posizione</dt><dd><a class="modal-map-btn" href="${link}">Vedi sulla mappa</a></dd>`;
    }

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
            const photoUrl = `/api/v1/announcements/${ann._id}/photo`;
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

    const commentsHtml = renderCommentsHtml(comments);
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
    const adminResolveBoxHtml = CURRENT_ROLE === 'admin' && data.status !== 'RESOLVED'
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
                ${commentsHtml}
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
                closeModal();
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
                <div class="modal-contact" style="margin-top:8px;">
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
 * Renders the comments section markup for an announcement.
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
                <div id="${slotId}" class="comment-contact-slot" style="display:none;"></div>
            </div>
        `;
    }).join('');
}

/**
 * Closes the announcement detail modal and restores page scrolling.
 * @returns {void}
 */
function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * Populates the shelter filter with unique shelter publishers found in announcements.
 * @param {Array<Object>} announcements - Announcements used to derive shelter filter options.
 * @returns {void}
 */
function populateRifugioFilter(announcements) {
    const select = document.getElementById('filter-rifugio');
    if (!select) return;

    const rifugi = new Map();
    announcements.forEach((ann) => {
        const publisher = ann.publisherId;
        const id = publisher?._id || publisher;
        if (!id || publisher?.role !== 'shelter') return;
        const name = publisher?.rifugioData?.rifugioName || publisher?.username || 'Rifugio';
        rifugi.set(id, name);
    });

    select.innerHTML = '<option value="">Tutti</option>';
    [...rifugi.entries()]
        .sort((a, b) => a[1].localeCompare(b[1], 'it'))
        .forEach(([id, name]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            select.appendChild(option);
        });
}

/**
 * Applies the current UI filter state to the cached announcements list.
 * @returns {Array<Object>} Filtered announcements, optionally sorted by proximity.
 */
function getFilteredAnnouncements() {
    const type    = document.getElementById('filter-type').value;
    const species = document.getElementById('filter-species').value.trim();
    const rifugioId = document.getElementById('filter-rifugio')?.value || '';

    let filtered = [...allAnnouncements];

    if (type)    filtered = filtered.filter(a => a.type === type);
    if (species) filtered = filtered.filter(a =>
        a.animalId?.species?.toLowerCase().includes(species.toLowerCase())
    );
    if (rifugioId) filtered = filtered.filter(a => (a.publisherId?._id || a.publisherId) === rifugioId);

    if (sortByProximity && currentLocation) {
        filtered = sortAnnouncementsByDistance(filtered, currentLocation);
    }

    return filtered;
}

/**
 * Re-renders the announcement list using the active filters and updates the result count.
 * @returns {void}
 */
function applyFilters() {
    const filtered = getFilteredAnnouncements();
    renderCards(filtered);
    updateCount(filtered.length);
}

/**
 * Updates the visible result counter.
 * @param {number} n - Number of announcements currently shown.
 * @returns {void}
 */
function updateCount(n) {
    document.getElementById('result-count').textContent =
        `${n} ${n === 1 ? 'annuncio trovato' : 'annunci trovati'}`;
}


/**
 * Clears and hides the global error banner.
 * @returns {void}
 */
function clearError() {
    const banner = document.getElementById('error-banner');
    banner.textContent = '';
    banner.style.display = 'none';
}

/**
 * Updates the text shown in the location status area.
 * @param {string} text - Status text to display.
 * @returns {void}
 */
function updateLocationStatus(text) {
    const status = document.getElementById('location-status');
    status.textContent = text || '';
}

/**
 * Requests the user's current browser geolocation.
 * @returns {Promise<Array<number>>} Promise resolving to [latitude, longitude].
 * @throws {Error|GeolocationPositionError} Rejects when geolocation is unavailable, denied, or times out.
 */
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocalizzazione non supportata'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve([position.coords.latitude, position.coords.longitude]),
            (error) => reject(error),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
    });
}

/**
 * Computes the great-circle distance between two latitude/longitude points.
 * @param {number} lat1 - Latitude of the first point.
 * @param {number} lon1 - Longitude of the first point.
 * @param {number} lat2 - Latitude of the second point.
 * @param {number} lon2 - Longitude of the second point.
 * @returns {number} Distance between the two points in meters.
 */
function computeDistanceMeters(lat1, lon1, lat2, lon2) {
    /**
     * Converts degrees to radians for the haversine distance calculation.
     * @param {number} deg - Angle in degrees.
     * @returns {number} Angle in radians.
     */
    const toRad = (deg) => deg * Math.PI / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Adds distance metadata to announcements and sorts them by distance from the user.
 * @param {Array<Object>} announcements - Announcements to sort.
 * @param {Array<number>} userLocation - User location as [latitude, longitude].
 * @returns {Array<Object>} New announcement objects sorted from nearest to farthest.
 */
function sortAnnouncementsByDistance(announcements, [userLat, userLng]) {
    return announcements
        .map((ann) => {
            const coords = ann.location?.coordinates;
            if (!coords || coords.length !== 2) return { ...ann, _distance: Infinity };

            const [lng, lat] = coords;
            return { ...ann, _distance: computeDistanceMeters(userLat, userLng, lat, lng) };
        })
        .sort((a, b) => (a._distance || 0) - (b._distance || 0));
}

/**
 * Sorts announcements by date in descending order without mutating the input array.
 * @param {Array<Object>} announcements - Announcements to sort.
 * @returns {Array<Object>} Announcements sorted from newest to oldest.
 */
function sortAnnouncementsByDate(announcements) {
    return [...announcements].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Shows a message in the global error banner.
 * @param {string} msg - Error message to display.
 * @returns {void}
 */
function showError(msg) {
    const banner = document.getElementById('error-banner');
    banner.textContent = msg;
    banner.style.display = 'block';
}


/**
 * Initializes the announcements page after the DOM is ready.
 * @returns {Promise<void>} Promise resolving when initial announcements are loaded and event handlers are bound.
 */
document.addEventListener('DOMContentLoaded', async () => {
    allAnnouncements = await fetchAnnouncements();
    allAnnouncements = sortAnnouncementsByDate(allAnnouncements);
    populateRifugioFilter(allAnnouncements);
    const initialRifugioId = new URLSearchParams(window.location.search).get('rifugioId');
    if (initialRifugioId && document.getElementById('filter-rifugio')) {
        document.getElementById('filter-rifugio').value = initialRifugioId;
    }
    const initialFiltered = getFilteredAnnouncements();
    renderCards(initialFiltered);
    updateCount(initialFiltered.length);

    document.getElementById('filter-type').addEventListener('change', applyFilters);
    document.getElementById('filter-species').addEventListener('input', applyFilters);
    document.getElementById('filter-rifugio')?.addEventListener('change', applyFilters);
    document.getElementById('nearby-button').addEventListener('click', async () => {
        const button = document.getElementById('nearby-button');
        if (sortByProximity) {
            sortByProximity = false;
            currentLocation = null;
            updateLocationStatus('');
            applyFilters();
            return;
        }

        button.disabled = true;
        button.textContent = 'Ricerca posizione...';
        clearError();
        updateLocationStatus('Sto cercando la tua posizione…');

        try {
            currentLocation = await getUserLocation();
            sortByProximity = true;
            updateLocationStatus('Annunci ordinati dai più vicini');
            applyFilters();
        } catch (err) {
            sortByProximity = false;
            currentLocation = null;
            updateLocationStatus('');
            showError('Impossibile ottenere la tua posizione. Controlla i permessi del browser.');
        } finally {
            button.disabled = false;
            button.textContent = 'Più vicini a me';
        }
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('modal-close').addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    try {
        const params = new URLSearchParams(window.location.search);
        const highlight = params.get('highlight');
        if (highlight) {
            setTimeout(() => {
                const ann = allAnnouncements.find(a => a._id === highlight);
                if (ann) {
                    const card = document.querySelector(`.card[data-id="${highlight}"]`);
                    if (card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        card.style.transition = 'box-shadow 250ms ease';
                        card.style.boxShadow = '0 6px 20px rgba(26,115,232,0.25)';
                        setTimeout(() => card.style.boxShadow = '', 2000);
                        openModal(ann);
                    } else {
                        openModal(ann);
                    }
                }
            }, 120);
        }
    } catch (err) {
        console.warn('Error handling highlight param', err);
    }
});
