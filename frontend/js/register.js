const form = document.getElementById('registerForm');
const errorBox = document.getElementById('registerError');
const successBox = document.getElementById('registerSuccess');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.textContent = '';
  successBox.textContent = '';

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const phoneNumber = document.getElementById('phoneNumber').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (password !== confirmPassword) {
    errorBox.textContent = 'Le password non coincidono';
    return;
  }

  if (password.length < 8) {
    errorBox.textContent = 'La password deve avere almeno 8 caratteri';
    return;
  }

  const res = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      password,
      phoneNumber: phoneNumber || null
    })
  });

  const data = await res.json();

  if (!res.ok) {
    errorBox.textContent = data.message || 'Errore durante la registrazione';
    return;
  }

  successBox.textContent = 'Registrazione completata con successo. Ora puoi fare login.';
  form.reset();

  setTimeout(() => {
    window.location.href = './login.html';
  }, 1200);
});