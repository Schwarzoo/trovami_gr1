const express = require('express');
const router = express.Router();
const { getAnnouncements,getAnnouncementById, createAnnouncement, updateAnnouncement, changeStatus, deleteAnnouncement, getAnnouncementPhoto } = require('../controllers/announcementController');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');

// keep files in memory so we can store directly to MongoDB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });


router.get('/',  getAnnouncements);           // pubblica
router.post('/', authMiddleware, upload.single('photo'), createAnnouncement);   // richiede login
router.get('/:id',  getAnnouncementById);
router.put('/:id', authMiddleware, upload.single('photo'), updateAnnouncement);
router.patch('/:id/status', authMiddleware, changeStatus);
router.delete('/:id', authMiddleware, deleteAnnouncement);
// serve announcement photo
router.get('/:id/photo', getAnnouncementPhoto);

module.exports = router;
