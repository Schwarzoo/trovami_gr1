const API_BASE = 'http://localhost:3000/api/announcements';

let allAnnouncements = [];
let currentLocation = null;
let sortByProximity = false;

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
    const isLost = ann.type === 'LostAnimal';
    const distanceLabel = typeof ann._distance === 'number'
        ? `<div class="card-distance">${ann._distance < 1000 ? `${Math.round(ann._distance)} m` : `${(ann._distance / 1000).toFixed(1)} km`} da te</div>`
        : '';

    const photo = animal?.photos?.[0] || null;
    const date = new Date(ann.date).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = ann._id;

    card.innerHTML = `
        <div class="card-image">
            ${photo
                ? `<img src="${photo}" alt="${animal?.species || 'Animale'}" loading="lazy">`
                : `<div class="card-image-placeholder"><span>${animal?.species?.[0] || '?'}</span></div>`
            }
            <span class="badge badge--${isLost ? 'lost' : 'sighting'}">
                ${isLost ? 'Smarrito' : 'Avvistato'}
            </span>
        </div>
        <div class="card-body">
            <div class="card-meta">
                <span class="card-species">${animal?.species || 'Specie sconosciuta'}</span>
                <span class="card-date">${date}</span>
            </div>
            <h3 class="card-breed">${animal?.breed || '—'}</h3>
            <p class="card-description">${ann.description}</p>
            ${distanceLabel}
            <div class="card-tags">
                ${animal?.color ? `<span class="tag">${animal.color}</span>` : ''}
                ${animal?.gender ? `<span class="tag">${animal.gender}</span>` : ''}
                ${ann.animalBehaviour ? `<span class="tag">${ann.animalBehaviour}</span>` : ''}
            </div>
        </div>
    `;

    card.addEventListener('click', () => openModal(ann));
    return card;
}

// --- Modal ---

async function openModal(ann) {
    const animal = ann.animalId;
    const publisher = ann.publisherId;
    const isLost = ann.type === 'LostAnimal';
    const isLoggedIn = !!localStorage.getItem('token'); // check auth

    const date = new Date(ann.date).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let locationInfo = '';
    const coords = ann.location?.coordinates;

    if (coords?.length === 2) {
        const link = `map.html?highlight=${encodeURIComponent(ann._id)}`;
        locationInfo = `<dt>Posizione</dt><dd><a class="position-link" href="${link}"><em>trovami</em></a></dd>`;
    }

    document.getElementById('modal-title').textContent =
        isLost ? `${animal?.species} smarrito/a` : `Avvistamento: ${animal?.species}`;

    const photos = animal?.photos || [];
    const gallery = document.getElementById('modal-gallery');
    gallery.innerHTML = photos.length
        ? photos.map(p => `<img src="${p}" alt="foto animale">`).join('')
        : `<div class="modal-no-photo">Nessuna foto disponibile</div>`;

    document.getElementById('modal-body').innerHTML = `
        <dl class="detail-list">
            <dt>Specie</dt><dd>${animal?.species || '—'}</dd>
            <dt>Razza</dt><dd>${animal?.breed || '—'}</dd>
            <dt>Colore</dt><dd>${animal?.color || '—'}</dd>
            <dt>Sesso</dt><dd>${animal?.gender || '—'}</dd>
            ${animal?.microchipId ? `<dt>Microchip</dt><dd>${animal.microchipId}</dd>` : ''}
            ${animal?.distinctiveFeatures ? `<dt>Caratteristiche</dt><dd>${animal.distinctiveFeatures}</dd>` : ''}
            ${locationInfo}
            <dt>Data</dt><dd>${date}</dd>
            ${ann.healthCondition ? `<dt>Condizioni</dt><dd>${ann.healthCondition}</dd>` : ''}
        </dl>
        <p class="modal-description">${ann.description}</p>
        <div class="modal-contact">
            ${isLoggedIn
                ? `<strong>Contatto:</strong>
                   <span>${publisher?.username || '—'}</span>
                   ${publisher?.phoneNumber ? `<a href="tel:${publisher.phoneNumber}">${publisher.phoneNumber}</a>` : ''}
                   ${publisher?.email ? `<a href="mailto:${publisher.email}">${publisher.email}</a>` : ''}`
                : `<span class="contact-locked">🔒 Accedi per vedere i contatti</span>`
            }
        </div>
    `;

    document.getElementById('modal-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

// --- Filtri ---

function getFilteredAnnouncements() {
    const type    = document.getElementById('filter-type').value;
    const species = document.getElementById('filter-species').value.trim();

    let filtered = [...allAnnouncements];

    if (type)    filtered = filtered.filter(a => a.type === type);
    if (species) filtered = filtered.filter(a =>
        a.animalId?.species?.toLowerCase().includes(species.toLowerCase())
    );

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
    renderCards(allAnnouncements);
    updateCount(allAnnouncements.length);

    document.getElementById('filter-type').addEventListener('change', applyFilters);
    document.getElementById('filter-species').addEventListener('input', applyFilters);
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
