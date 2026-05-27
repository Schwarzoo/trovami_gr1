const express = require('express');
const router = express.Router();
const { register, login, logout, forgotPassword, resetPassword, verifyEmail, resendVerification, requestReadmission } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

// UC1 - Registrazione
// POST /api/v1/auth/users
router.post('/users', register);

// UC3 - Login
// POST /api/v1/auth/sessions
router.post('/sessions', login);

// Request readmission for blocked account
router.post('/readmission-requests', requestReadmission);

// Logout (richiede autenticazione)
// DELETE /api/v1/auth/sessions/current
router.delete('/sessions/current', authMiddleware, logout);

// Forgot Password
// POST /api/v1/auth/password-reset-requests
router.post('/password-reset-requests', forgotPassword);

// Reset Password
// PATCH /api/v1/auth/password
router.patch('/password', resetPassword);

// Verify Email
// GET /api/v1/auth/email-verifications?token=...
router.get('/email-verifications', verifyEmail);

// Resend verification email
// POST /api/v1/auth/email-verifications
router.post('/email-verifications', resendVerification);

module.exports = router;
