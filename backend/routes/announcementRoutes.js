const express = require('express');
const router = express.Router();
const { getAnnouncements, createAnnouncement } = require('../controllers/announcementController');
const auth = require('../middleware/auth');

router.get('/',  getAnnouncements);           // pubblica
router.post('/', auth, createAnnouncement);   // richiede login

module.exports = router;
