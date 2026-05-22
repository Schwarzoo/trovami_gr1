const HOME_API = 'http://localhost:3000/api/announcements';
const HOME_MAX_CARDS = 6;

async function fetchHomeAnnouncements() {
  try {
    const res = await fetch(HOME_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? json : json.data || [];
  } catch (err) {
    console.error('Errore fetch annunci home', err);
    return [];
  }
}

function buildHomeCard(ann) {
  const animal = ann.animalId;
  const isLost = ann.type === 'LostAnimal';
  // try to use announcement-specific photo endpoint, fallback to placeholder
  const photoUrl = `http://localhost:3000/api/announcements/${ann._id}/photo`;
  const date = new Date(ann.date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const card = document.createElement('article');
  card.className = 'card';
  const description = ann.description || '';
  card.innerHTML = `
    <div class="card-image">
      <div class="card-image-placeholder"><span>…</span></div>
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
      <p class="card-description">${description}</p>
    </div>
  `;

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

async function initHomeAnnouncements() {
  const grid = document.getElementById('home-announcements-grid');
  const empty = document.getElementById('home-empty');
  if (!grid || !empty) return;

  const announcements = await fetchHomeAnnouncements();
  const trimmed = announcements.slice(0, HOME_MAX_CARDS);

  if (trimmed.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  trimmed.forEach((ann) => grid.appendChild(buildHomeCard(ann)));
}

document.addEventListener('DOMContentLoaded', initHomeAnnouncements);
