const express = require('express');
const router = express.Router();
const { register, login, logout, forgotPassword, resetPassword, verifyEmail, resendVerification, requestReadmission } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

/**
 * @openapi
 * /api/v1/auth/users:
 *   post:
 *     summary: Registra un nuovo account
 *     responses:
 *       '201':
 *         description: Account creato.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *             description: URI della risorsa creata
 */
router.post('/users', register);

router.post('/sessions', login);

router.post('/readmission-requests', requestReadmission);

router.delete('/sessions/current', authMiddleware, logout);

router.post('/password-reset-requests', forgotPassword);

router.patch('/password', resetPassword);

router.get('/email-verifications', verifyEmail);

router.post('/email-verifications', resendVerification);

module.exports = router;
