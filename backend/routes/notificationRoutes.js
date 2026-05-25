const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getNotifications, markNotificationRead, markAllRead } = require('../controllers/notificationController');

router.get('/', authMiddleware, getNotifications);
router.post('/:id/read', authMiddleware, markNotificationRead);
router.post('/read-all', authMiddleware, markAllRead);

module.exports = router;

