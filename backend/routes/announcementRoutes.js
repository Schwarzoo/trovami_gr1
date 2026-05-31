const express = require('express');
const router = express.Router();
const { getAnnouncements, getAnnouncementById, getSimilarAnnouncements, createAnnouncement, updateAnnouncement, changeStatus, deleteAnnouncement, getAnnouncementPhoto, addAnnouncementComment, reportAnnouncement, generateFlyer, getResolvedAnnouncementsCount } = require('../controllers/announcementController');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function isTruthyFlag(value) {
	return value === true || value === 'true' || value === 1 || value === '1';
}

function requireAuthUnlessQuick(req, res, next) {
	if (isTruthyFlag(req.body?.isQuick)) return next();
	return authMiddleware(req, res, next);
}


router.get('/',  getAnnouncements);           // pubblica
router.get('/count', getResolvedAnnouncementsCount);
router.post('/', upload.single('photo'), requireAuthUnlessQuick, createAnnouncement);   // richiede login salvo quick
router.get('/:id/similar', getSimilarAnnouncements);
router.get('/:id',  getAnnouncementById);
router.post('/:id/comments', authMiddleware, addAnnouncementComment);
router.post('/:id/reports', authMiddleware, reportAnnouncement);
router.put('/:id', authMiddleware, upload.single('photo'), updateAnnouncement);
router.patch('/:id/status', authMiddleware, changeStatus);
router.delete('/:id', authMiddleware, deleteAnnouncement);
router.get('/:id/photo', getAnnouncementPhoto);
router.get('/:id/flyer', authMiddleware, generateFlyer);

module.exports = router;
