const form = document.getElementById('readmissionForm');
const statusBox = document.getElementById('readmissionStatus');

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

const userId = getQueryParam('userId');
const currentStatus = getQueryParam('status');

if (currentStatus === 'pending') {
  statusBox.textContent = 'Richiesta gia inviata. Attendi la risposta degli admin.';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusBox.textContent = '';

  const message = document.getElementById('readmissionMessage').value.trim();
  if (!message) {
    statusBox.textContent = 'Inserisci un messaggio.';
    return;
  }

  const res = await fetch('http://localhost:3000/api/auth/readmission-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, message })
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    statusBox.textContent = data.message || 'Errore invio richiesta';
    return;
  }

  statusBox.textContent = data.message || 'Richiesta inviata. Attendi approvazione admin.';
  form.querySelector('button[type="submit"]').disabled = true;
});
