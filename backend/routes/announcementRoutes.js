const express = require('express');
const router = express.Router();
const { getAnnouncements,getAnnouncementById, createAnnouncement } = require('../controllers/announcementController');
const { authMiddleware } = require('../middleware/auth');

router.get('/',  getAnnouncements);           // pubblica
router.post('/', authMiddleware, createAnnouncement);   // richiede login
router.get('/:id',  getAnnouncementById);

module.exports = router;
