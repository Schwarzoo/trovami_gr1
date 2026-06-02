const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');

/**
 * Reads a query-string parameter from the current page URL.
 * @param {string} name - Query parameter name to read.
 * @returns {string|null} Parameter value from `window.location.search`, or null when absent.
 */
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

const alreadyToken = localStorage.getItem('token');
if (alreadyToken) {
  const nxt = getQueryParam('next') || './profile.html';
  window.location.href = nxt;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.textContent = '';

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const res = await fetch('/api/v1/auth/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    if (data?.blocked && data?.userId) {
      window.location.href = `./readmission.html?userId=${encodeURIComponent(data.userId)}&status=${encodeURIComponent(data.readmissionStatus || 'none')}`;
      return;
    }
    errorBox.textContent = data.userMessage || data.message || 'Errore di login';
    return;
  }

  localStorage.setItem('token', data.token);
  localStorage.setItem('role', data.role);
  const next = getQueryParam('next');
  window.location.href = next || './profile.html';
});
