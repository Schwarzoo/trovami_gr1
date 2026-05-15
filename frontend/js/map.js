const map = L.map('map').setView([46.0667, 11.1333], 13);
const urlParams = new URLSearchParams(window.location.search);
const highlightId = urlParams.get('highlight');

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


const redIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.25 14 24 14 24S28 23.25 28 14C28 6.27 21.73 0 14 0z" fill="#E24B4A"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`,
  iconSize: [28, 38],
  iconAnchor: [14, 38],
  popupAnchor: [0, -40]
});

const greenIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.25 14 24 14 24S28 23.25 28 14C28 6.27 21.73 0 14 0z" fill="#3B6D11"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`,
  iconSize: [28, 38],
  iconAnchor: [14, 38],
  popupAnchor: [0, -40]
});


async function loadAnnouncements() {
  const res = await fetch('http://localhost:3000/api/announcements');
  if (!res.ok) { console.error('Errore fetch annunci'); return; }

  const announcements = await res.json();
  console.log(`Annunci ricevuti: ${announcements.length}`, announcements); // ← aggiunto
  let highlightedMarker = null;

  // remove existing markers
  if (window._tm_markers) { window._tm_markers.forEach(m => map.removeLayer(m)); }
  window._tm_markers = [];

  announcements.forEach(a => {
  const [lng, lat] = a.location.coordinates;
  const animal = a.animalId;
  const isLost = a.type === 'LostAnimal';
  const date = new Date(a.date).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' });

  // immagine o emoji
  const hasImage = animal?.images?.length > 0;
  const emoji = animal?.species?.toLowerCase().includes('gatt') ? '🐈' : '🐕';
  const mediaBlock = hasImage
    ? `<img src="${animal.images[0]}" alt="foto animale"
            style="width:100%;height:110px;object-fit:cover;display:block;"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
       <div style="display:none;width:100%;height:110px;align-items:center;
                   justify-content:center;background:#f5f5f5;font-size:42px;">${emoji}</div>`
    : `<div style="width:100%;height:110px;background:#f5f5f5;
                   display:flex;align-items:center;justify-content:center;font-size:42px;">${emoji}</div>`;

  const badgeStyle = isLost
    ? 'background:#FCEBEB;color:#A32D2D;'
    : 'background:#EAF3DE;color:#3B6D11;';

  const popupHTML = `
    <div style="width:260px;font-family:sans-serif;border-radius:12px;overflow:hidden;cursor:pointer;"
         onclick="window.location.href='/annuncio/${a._id}'">

      <div style="position:relative;">
        ${mediaBlock}
        <span style="position:absolute;top:8px;left:8px;font-size:11px;font-weight:600;
                     padding:3px 9px;border-radius:20px;${badgeStyle}">
          ${isLost ? 'Smarrito' : 'Avvistato'}
        </span>
      </div>

      <div style="padding:12px 14px 14px;">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
          <div style="width:26px;height:26px;border-radius:50%;background:#E6F1FB;
                      display:flex;align-items:center;justify-content:center;font-size:13px;">🐾</div>
          <span style="font-size:12px;color:#666;">
            ${animal?.species ?? ''}${animal?.breed ? ' · ' + animal.breed : ''}
          </span>
        </div>

        <div style="font-size:14px;font-weight:600;color:#111;margin-bottom:4px;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${a.description.length > 40 ? a.description.slice(0,40)+'…' : a.description}
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;">
          <span style="font-size:11px;color:#999;">📅 ${date}</span>
          <span style="font-size:12px;font-weight:500;color:#1a73e8;">Vedi annuncio →</span>
        </div>
      </div>
    </div>
  `;

  const markerIcon = isLost ? redIcon : greenIcon;
  const marker = L.marker([lat, lng], { icon: markerIcon })
    .addTo(map)
    .bindPopup(popupHTML, { maxWidth: 280, className: 'custom-popup' });
  window._tm_markers.push(marker);
  if (highlightId === a._id) {
    highlightedMarker = marker;
  }
  });

  if (highlightedMarker) {
    const { lat, lng } = highlightedMarker.getLatLng();
    map.setView([lat, lng], 16, { animate: false });
    map.panBy([0, -140], { animate: false });
    highlightedMarker.openPopup();
  }
//   announcements.forEach(a => {
//     const [lng, lat] = a.location.coordinates;
//     const animal = a.animalId;

//     const icon = a.type === 'LostAnimal'
//       ? L.icon({ iconUrl: '/icons/lost.png',    iconSize: [32, 32] })
//       : L.icon({ iconUrl: '/icons/sighting.png', iconSize: [32, 32] });

//     L.marker([lat, lng], { icon })
//       .addTo(map)
//       .bindPopup(`
//         <strong>${a.type === 'LostAnimal' ? 'Smarrito' : 'Avvistato'}</strong><br>
//         ${animal?.species ?? ''} ${animal?.breed ?? ''}<br>
//         ${a.description}<br>
//         <small>${new Date(a.date).toLocaleDateString('it-IT')}</small>
//       `)
//       .openPopup();
//   });
}

loadAnnouncements();

// Listen for updates from other pages (profile) and refresh
window.addEventListener('storage', (e) => {
  if (e.key === 'announcements:update') {
    loadAnnouncements();
  }
});

// Also refresh when tab becomes visible (helpful after redirect)
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAnnouncements(); });
