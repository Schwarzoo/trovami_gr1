const express = require('express');
const router = express.Router();
const { getAnnouncements, createAnnouncement } = require('../controllers/announcementController');
const { authMiddleware } = require('../middleware/auth');

router.get('/',  getAnnouncements);           // pubblica
router.post('/', authMiddleware, createAnnouncement);

module.exports = router;
