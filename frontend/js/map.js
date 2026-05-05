const map = L.map('map').setView([46.0667, 11.1333], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);




async function loadAnnouncements() {
  const res = await fetch('/api/announcements');
  const announcements = await res.json();

  announcements.forEach(a => {
    L.marker([a.lostLocation.lat, a.lostLocation.lng])
      .addTo(map)
      .bindPopup(`
        <strong>${a.description}</strong><br>
        ${a.associatedAnimal?.species ?? ''} ${a.associatedAnimal?.breed ?? ''}
      `);
  });
}

loadAnnouncements();
