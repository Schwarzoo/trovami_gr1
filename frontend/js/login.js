const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.textContent = '';

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    errorBox.textContent = data.message || 'Errore di login';
    return;
  }

  localStorage.setItem('token', data.token);
  localStorage.setItem('role', data.role);

  window.location.href = './map.html';
});