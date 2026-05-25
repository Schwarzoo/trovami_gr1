const API_BASE = 'http://localhost:3000/api/announcements';

let allAnnouncements = [];
let currentLocation = null;
let sortByProximity = false;
const EMPTY_VALUE = '- -';

function displayValue(value) {
    if (value === null || value === undefined) return EMPTY_VALUE;
    const text = String(value).trim();
    return text ? text : EMPTY_VALUE;
}

function escapeHtml(input) {
    return String(input ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// --- Fetch ---

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

async function fetchAnnouncementById(id) {
    try {
        const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        return null;
    }
}

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
        const msg = json?.message || 'Errore invio commento';
        throw new Error(msg);
    }
    return json;
}

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
    if (!res.ok) throw new Error(json?.message || 'Errore invio segnalazione');
    return json;
}

async function fetchPublicUser(userId) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('not logged in');
    const res = await fetch(`http://localhost:3000/api/users/${encodeURIComponent(userId)}/public`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || 'Errore caricamento contatti');
    return json;
}

// --- Rendering ---

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

function buildCard(ann) {
    const animal = ann.animalId;
    const publisher = ann.publisherId;
    const isLost = ann.type === 'LostAnimal';
    const isRifugioAnnouncement = publisher?.role === 'shelter';
    const rifugioName = publisher?.role === 'shelter'
        ? (publisher?.rifugioData?.rifugioName || publisher?.shelterData?.shelterName || publisher?.username)
        : '';
    const primaryTitle = animal?.name || animal?.breed || animal?.species || 'Animale';
    const distanceLabel = typeof ann._distance === 'number'
        ? `<div class="card-distance">${ann._distance < 1000 ? `${Math.round(ann._distance)} m` : `${(ann._distance / 1000).toFixed(1)} km`} da te</div>`
        : '';

    // try announcement photo endpoint first
    const photoUrl = `http://localhost:3000/api/announcements/${ann._id}/photo`;
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
            ${rifugioName ? `<div class="card-distance">Rifugio: ${escapeHtml(rifugioName)}</div>` : ''}
            ${ann.isQuick ? `<div class="card-distance">Segnalazione veloce</div>` : ''}
            ${distanceLabel}
            <div class="card-details">
                <span class="card-detail-label">Colore</span><span>${displayValue(animal?.color)}</span>
                <span class="card-detail-label">Salute</span><span>${displayValue(ann.healthCondition)}</span>
                <span class="card-detail-label">Comportamento</span><span>${displayValue(ann.animalBehaviour)}</span>
            </div>
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

// --- Modal ---

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
        locationInfo = `<dt>Posizione</dt><dd><a class="position-link" href="${link}"><em>trovami</em></a></dd>`;
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

    document.getElementById('modal-title').textContent =
        animal?.name || (isRifugioAnnouncement ? 'Animale in rifugio' : (isLost ? `${animal?.species} smarrito/a` : `Avvistamento: ${animal?.species}`));

        const gallery = document.getElementById('modal-gallery');
        // try to load announcement photo from backend endpoint and fallback to text if missing
        gallery.innerHTML = '<div class="modal-spinner">…</div>';
        (async () => {
            const photoUrl = `http://localhost:3000/api/announcements/${ann._id}/photo`;
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
                gallery.innerHTML = '<div class="modal-no-photo">Non è presente alcuna foto</div>';
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
        <p class="modal-description">${data.description}</p>

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

        <div class="modal-contact">
            ${isLoggedIn
                ? `<strong>Contatto:</strong>
                   <span>${escapeHtml(publisher?.rifugioData?.rifugioName || publisher?.username || '—')}</span>
                   ${publisher?.phoneNumber ? `<a href="tel:${publisher.phoneNumber}">${publisher.phoneNumber}</a>` : ''}
                   ${publisher?.email ? `<a href="mailto:${publisher.email}">${publisher.email}</a>` : ''}
                   ${rifugioLocationHtml}`
                : `<span class="contact-locked">🔒 Accedi per vedere i contatti</span>`
            }
        </div>
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

    // click username in comment -> show contacts
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

        // toggle off
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

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

// --- Filtri ---
function populateRifugioFilter(announcements) {
    const select = document.getElementById('filter-rifugio');
    if (!select) return;

    const rifugi = new Map();
    announcements.forEach((ann) => {
        const publisher = ann.publisherId;
        const id = publisher?._id || publisher;
        if (!id || publisher?.role !== 'shelter') return;
        const name = publisher?.rifugioData?.rifugioName || publisher?.shelterData?.shelterName || publisher?.username || 'Rifugio';
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

function applyFilters() {
    const filtered = getFilteredAnnouncements();
    renderCards(filtered);
    updateCount(filtered.length);
}

function updateCount(n) {
    document.getElementById('result-count').textContent =
        `${n} ${n === 1 ? 'annuncio trovato' : 'annunci trovati'}`;
}

// --- Error ---

function clearError() {
    const banner = document.getElementById('error-banner');
    banner.textContent = '';
    banner.style.display = 'none';
}

function updateLocationStatus(text) {
    const status = document.getElementById('location-status');
    status.textContent = text || '';
}

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

function computeDistanceMeters(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => deg * Math.PI / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

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

function sortAnnouncementsByDate(announcements) {
    return [...announcements].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function showError(msg) {
    const banner = document.getElementById('error-banner');
    banner.textContent = msg;
    banner.style.display = 'block';
}

// --- Init ---

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

    // If the page was opened with a highlight query param, open that announcement
    try {
        const params = new URLSearchParams(window.location.search);
        const highlight = params.get('highlight');
        if (highlight) {
            // Wait a tick to ensure DOM is rendered
            setTimeout(() => {
                // find announcement by id
                const ann = allAnnouncements.find(a => a._id === highlight);
                if (ann) {
                    // render cards already done; scroll card into view if exists
                    const card = document.querySelector(`.card[data-id="${highlight}"]`);
                    if (card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // briefly highlight the card
                        card.style.transition = 'box-shadow 250ms ease';
                        card.style.boxShadow = '0 6px 20px rgba(26,115,232,0.25)';
                        setTimeout(() => card.style.boxShadow = '', 2000);
                        // open modal for the announcement
                        openModal(ann);
                    } else {
                        // fallback: open modal anyway
                        openModal(ann);
                    }
                }
            }, 120);
        }
    } catch (err) {
        console.warn('Error handling highlight param', err);
    }
});
