const express = require('express');
const router = express.Router();
const { getAnnouncements,getAnnouncementById, createAnnouncement, updateAnnouncement, changeStatus, deleteAnnouncement } = require('../controllers/announcementController');
const { authMiddleware } = require('../middleware/auth');

router.get('/',  getAnnouncements);           // pubblica
router.post('/', authMiddleware, createAnnouncement);   // richiede login
router.get('/:id',  getAnnouncementById);
router.put('/:id', authMiddleware, updateAnnouncement);
router.patch('/:id/status', authMiddleware, changeStatus);
router.delete('/:id', authMiddleware, deleteAnnouncement);

module.exports = router;
