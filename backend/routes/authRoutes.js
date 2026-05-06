const express = require('express');
const router = express.Router();
const { register, login, logout } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

// UC1 - Registrazione
// POST /api/auth/register
router.post('/register', register);

// UC3 - Login
// POST /api/auth/login
router.post('/login', login);

// Logout (richiede autenticazione)
// POST /api/auth/logout
router.post('/logout', authMiddleware, logout);

module.exports = router;
