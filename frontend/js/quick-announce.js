// Quick Announcement Modal Management
const QUICK_ANNOUNCE_MODAL = document.getElementById('quick-announce-modal');
const QUICK_ANNOUNCE_FORM = document.getElementById('quick-announce-form');
const QUICK_ANNOUNCE_BTN = document.getElementById('quick-announce-btn');
const QUICK_ANNOUNCE_CLOSE = document.getElementById('quick-announce-close');
const QUICK_ANNOUNCE_CANCEL = document.getElementById('quick-announce-cancel');
const QUICK_ANNOUNCE_PROGRESS = document.getElementById('qa-progress');
const QUICK_ANNOUNCE_SUBMIT = document.querySelector('#quick-announce-form button[type="submit"]');

let currentLocation = null;

// Check Authentication
function isUserLoggedIn() {
  return !!localStorage.getItem('token');
}

// Modal Control Functions
function openQuickAnnounceModal() {
  QUICK_ANNOUNCE_MODAL.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  
  // Request geolocation silently
  requestGeolocation();
}

function closeQuickAnnounceModal() {
  QUICK_ANNOUNCE_MODAL.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  QUICK_ANNOUNCE_FORM.reset();
  currentLocation = null;
  setQuickAnnounceLoading(false);
}

function setQuickAnnounceLoading(isLoading) {
  if (QUICK_ANNOUNCE_PROGRESS) {
    QUICK_ANNOUNCE_PROGRESS.classList.toggle('is-visible', isLoading);
    QUICK_ANNOUNCE_PROGRESS.setAttribute('aria-hidden', String(!isLoading));
  }
  if (QUICK_ANNOUNCE_SUBMIT) QUICK_ANNOUNCE_SUBMIT.disabled = isLoading;
  if (QUICK_ANNOUNCE_CANCEL) QUICK_ANNOUNCE_CANCEL.disabled = isLoading;
  if (QUICK_ANNOUNCE_CLOSE) QUICK_ANNOUNCE_CLOSE.disabled = isLoading;
}

// Geolocation Handler
function requestGeolocation() {
  const locationDisplay = document.getElementById('qa-location-status');
  
  if (!locationDisplay) return;
  if (!navigator.geolocation) {
    locationDisplay.innerHTML = '<span class="location-status" style="color: var(--text-muted);">⚠️ Geolocalizzazione non disponibile</span>';
    return;
  }

  locationDisplay.innerHTML = '<span class="location-status">🔍 Localizzazione in corso...</span>';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      currentLocation = {
        type: 'Point',
        coordinates: [longitude, latitude] // GeoJSON format: [lng, lat]
      };
      
      locationDisplay.innerHTML = `
        <span class="location-status success">
          📍 Posizione acquisita (${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°)
        </span>
      `;
    },
    (error) => {
      console.error('Geolocation error:', error);
      let errorMessage = 'Errore nella localizzazione';
      
      if (error.code === error.PERMISSION_DENIED) {
        errorMessage = '❌ Permesso negato. Abilita la geolocalizzazione nei settings del browser.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errorMessage = '❌ Posizione non disponibile. Riprova più tardi.';
      } else if (error.code === error.TIMEOUT) {
        errorMessage = '❌ Timeout della richiesta. Riprova.';
      }
      
      locationDisplay.innerHTML = `<span class="location-status">${errorMessage}</span>`;
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// Form Submission Handler
async function handleQuickAnnounceSubmit(e) {
  e.preventDefault();

  // Validate required fields
  const species = document.getElementById('qa-species').value.trim();
  const color = document.getElementById('qa-color').value.trim();
  const healthCondition = document.getElementById('qa-health').value;
  const type = document.getElementById('qa-type').value;

  if (!species || !color || !healthCondition || !type) {
    alert('Per favore, compila i campi obbligatori: Specie, Colore, Condizioni di salute e Tipo di segnalazione.');
    return;
  }

  if (!currentLocation) {
    alert('La posizione non è stata acquisita. Per favore, abilita la geolocalizzazione e riprova.');
    return;
  }

  // Collect form data
  const formData = new FormData(QUICK_ANNOUNCE_FORM);
  const data = {
    type: formData.get('type'),
    species: formData.get('species'),
    breed: formData.get('breed') || 'Non specificato',
    gender: formData.get('gender') || 'Sconosciuto',
    color: formData.get('color'),
    lunghezzaPelo: formData.get('lunghezzaPelo') || null,
    distinctiveFeatures: formData.get('distinctiveFeatures') || '',
    description: formData.get('description') || 'Nessuna descrizione',
    healthCondition: formData.get('healthCondition'),
    animalBehaviour: formData.get('animalBehaviour') || 'indifferente',
    coordinates: currentLocation.coordinates,
    photo: formData.get('photo')
  };

  try {
    await submitQuickAnnounce(data);
  } catch (error) {
    console.error('Error submitting announcement:', error);
    alert('Errore nella pubblicazione dell\'annuncio. Per favore, riprova.');
  }
}

// API Call to Create Announcement
async function submitQuickAnnounce(data) {
  setQuickAnnounceLoading(true);

  const announcementPayload = {
    type: data.type,
    species: data.species,
    breed: data.breed,
    gender: data.gender,
    color: data.color,
    lunghezzaPelo: data.lunghezzaPelo,
    distinctiveFeatures: data.distinctiveFeatures,
    description: data.description,
    coordinates: data.coordinates,
    healthCondition: data.healthCondition,
    animalBehaviour: data.animalBehaviour,
    lastSeenDate: new Date().toISOString()
  };

  try {
    let announcementRes;
    if (data.photo && data.photo.size > 0) {
      const announcementForm = new FormData();
      announcementForm.append('type', announcementPayload.type);
      announcementForm.append('species', announcementPayload.species);
      announcementForm.append('breed', announcementPayload.breed);
      announcementForm.append('gender', announcementPayload.gender);
      announcementForm.append('color', announcementPayload.color);
      if (announcementPayload.lunghezzaPelo) announcementForm.append('lunghezzaPelo', announcementPayload.lunghezzaPelo);
      if (announcementPayload.distinctiveFeatures) announcementForm.append('distinctiveFeatures', announcementPayload.distinctiveFeatures);
      announcementForm.append('description', announcementPayload.description);
      announcementForm.append('coordinates', announcementPayload.coordinates.join(','));
      announcementForm.append('healthCondition', announcementPayload.healthCondition);
      announcementForm.append('animalBehaviour', announcementPayload.animalBehaviour);
      announcementForm.append('lastSeenDate', announcementPayload.lastSeenDate);
      announcementForm.append('photo', data.photo);

      announcementRes = await fetch('http://localhost:3000/api/v1/announcements/quick', {
        method: 'POST',
        body: announcementForm
      });
    } else {
      announcementRes = await fetch('http://localhost:3000/api/v1/announcements/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcementPayload)
      });
    }

    if (!announcementRes.ok) {
      const errorData = await announcementRes.json().catch(() => ({}));
      throw new Error(`Errore nella creazione dell'annuncio: ${errorData.message || announcementRes.status}`);
    }

    await announcementRes.json();
    alert('Annuncio pubblicato con successo!');
    closeQuickAnnounceModal();

    setTimeout(() => {
      window.location.href = '/pages/announcements.html';
    }, 1500);
  } finally {
    setQuickAnnounceLoading(false);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Modal open/close events
  QUICK_ANNOUNCE_BTN?.addEventListener('click', openQuickAnnounceModal);
  QUICK_ANNOUNCE_CLOSE?.addEventListener('click', closeQuickAnnounceModal);
  QUICK_ANNOUNCE_CANCEL?.addEventListener('click', closeQuickAnnounceModal);

  // Close modal on overlay click (outside content)
  QUICK_ANNOUNCE_MODAL?.addEventListener('click', (e) => {
    if (e.target === QUICK_ANNOUNCE_MODAL) {
      closeQuickAnnounceModal();
    }
  });

  // Form submission
  QUICK_ANNOUNCE_FORM?.addEventListener('submit', handleQuickAnnounceSubmit);

  // Keyboard shortcut: Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && QUICK_ANNOUNCE_MODAL?.getAttribute('aria-hidden') === 'false') {
      closeQuickAnnounceModal();
    }
  });
});
