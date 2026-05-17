const form = document.getElementById('registerForm');
const errorBox = document.getElementById('registerError');
const successBox = document.getElementById('registerSuccess');
const successPanel = document.getElementById('registerSuccessPanel');
const goToLoginButton = document.getElementById('goToLogin');
const resendButton = document.getElementById('resendVerification');
const resendMessage = document.getElementById('resendMessage');

let lastRegisteredEmail = '';

goToLoginButton.addEventListener('click', () => {
  window.location.href = './login.html';
});

resendButton.addEventListener('click', async () => {
  resendMessage.textContent = '';
  resendMessage.classList.remove('error');

  if (!lastRegisteredEmail) {
    resendMessage.classList.add('error');
    resendMessage.textContent = 'Email non disponibile. Riprova la registrazione.';
    return;
  }

  try {
    const res = await fetch('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lastRegisteredEmail })
    });

    const data = await res.json();

    if (!res.ok) {
      resendMessage.classList.add('error');
      resendMessage.textContent = data.message || 'Errore durante l\'invio della mail';
      return;
    }

    resendMessage.textContent = 'Email di verifica inviata. Controlla la tua posta.';
  } catch (err) {
    resendMessage.classList.add('error');
    resendMessage.textContent = 'Errore di connessione';
    console.error(err);
  }
});

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

  successBox.textContent = "Registrazione completata. Controlla la mail per verificare l'account.";
  lastRegisteredEmail = email;
  form.reset();
  form.classList.add('is-hidden');
  successPanel.classList.remove('is-hidden');
});