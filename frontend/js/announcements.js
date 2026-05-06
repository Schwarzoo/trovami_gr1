const API_BASE = 'http://localhost:3000/api/announcements';

let allAnnouncements = [];

// --- Fetch ---

async function fetchAnnouncements(params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_BASE}?${query}` : API_BASE;

    try {
        const res = await fetch(url);
        const json = await res.json();
        return Array.isArray(json) ? json : json.data || [];
        if (!json.success) throw new Error(json.message);
        return json.data;
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

function openModal(ann) {
    const animal = ann.animalId;
    const publisher = ann.publisherId;
    const isLost = ann.type === 'LostAnimal';
    const isLoggedIn = !!localStorage.getItem('sessionToken'); // check auth

    const date = new Date(ann.date).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

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

function applyFilters() {
    const type    = document.getElementById('filter-type').value;
    const species = document.getElementById('filter-species').value.trim();

    let filtered = [...allAnnouncements];

    if (type)    filtered = filtered.filter(a => a.type === type);
    if (species) filtered = filtered.filter(a =>
        a.animalId?.species?.toLowerCase().includes(species.toLowerCase())
    );

    renderCards(filtered);
    updateCount(filtered.length);
}

function updateCount(n) {
    document.getElementById('result-count').textContent =
        `${n} ${n === 1 ? 'annuncio trovato' : 'annunci trovati'}`;
}

// --- Error ---

function showError(msg) {
    const banner = document.getElementById('error-banner');
    banner.textContent = msg;
    banner.style.display = 'block';
}

// --- Init ---

document.addEventListener('DOMContentLoaded', async () => {
    allAnnouncements = await fetchAnnouncements();
    renderCards(allAnnouncements);
    updateCount(allAnnouncements.length);

    document.getElementById('filter-type').addEventListener('change', applyFilters);
    document.getElementById('filter-species').addEventListener('input', applyFilters);

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('modal-close').addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
});