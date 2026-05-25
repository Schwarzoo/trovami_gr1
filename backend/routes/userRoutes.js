const express = require('express');
const router = express.Router();
const { getMe, updateMe, deleteMe, getPublicUser, getPublicRifugi } = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');

router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateMe);
router.delete('/me', authMiddleware, deleteMe);
router.get('/rifugi/public', getPublicRifugi);
router.get('/:id/public', authMiddleware, getPublicUser);

module.exports = router;

