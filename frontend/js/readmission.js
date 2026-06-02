const form = document.getElementById('readmissionForm');
const statusBox = document.getElementById('readmissionStatus');

/**
 * Reads a query-string parameter from the current page URL.
 * @param {string} name - Query parameter name to read.
 * @returns {string|null} Parameter value from `window.location.search`, or null when absent.
 */
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

  const res = await fetch('/api/v1/auth/readmission-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, message })
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    statusBox.textContent = data.userMessage || data.message || 'Errore invio richiesta';
    return;
  }

  statusBox.textContent = data.userMessage || data.message || 'Richiesta inviata. Attendi approvazione admin.';
  form.querySelector('button[type="submit"]').disabled = true;
});
