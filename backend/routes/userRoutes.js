const express = require('express');
const router = express.Router();
const { getMe, updateMe, deleteMe } = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');

router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateMe);
router.delete('/me', authMiddleware, deleteMe);

module.exports = router;
