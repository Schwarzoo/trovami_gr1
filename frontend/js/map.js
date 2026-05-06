const map = L.map('map').setView([46.0667, 11.1333], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);




async function loadAnnouncements() {
  const res = await fetch('/api/announcements');
  if (!res.ok) { console.error('Errore fetch annunci'); return; }

  const announcements = await res.json();

  announcements.forEach(a => {
    // GeoJSON: coordinates = [longitudine, latitudine] → Leaflet vuole [lat, lng]
    const [lng, lat] = a.location.coordinates;

    const animal = a.animalId; // dopo populate contiene l'oggetto Animal

    const icon = a.type === 'LostAnimal'
      ? L.icon({ iconUrl: '/icons/lost.png',    iconSize: [32, 32] })
      : L.icon({ iconUrl: '/icons/sighting.png', iconSize: [32, 32] });

    L.marker([lat, lng], { icon })
      .addTo(map)
      .bindPopup(`
        <strong>${a.type === 'LostAnimal' ? '🔴 Smarrito' : '👁️ Avvistato'}</strong><br>
        ${animal?.species ?? ''} ${animal?.breed ?? ''}<br>
        ${a.description}<br>
        <small>${new Date(a.date).toLocaleDateString('it-IT')}</small>
      `);
  });
}

loadAnnouncements();
