const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getNotifications, markNotificationRead, markAllRead } = require('../controllers/notificationController');

router.get('/', authMiddleware, getNotifications);
router.patch('/', authMiddleware, markAllRead);
router.patch('/:id', authMiddleware, markNotificationRead);

module.exports = router;

