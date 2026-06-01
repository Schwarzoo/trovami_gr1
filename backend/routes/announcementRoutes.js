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

/**
 * @openapi
 * /api/v1/announcements:
 *   get:
 *     summary: Lista annunci
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numero massimo di annunci per pagina.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Pagina dei risultati da restituire.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filtra gli annunci per stato, oppure usa all per includerli tutti.
 *     responses:
 *       '200':
 *         description: Lista paginata degli annunci.
 */
router.get('/',  getAnnouncements);           // pubblica
/**
 * @openapi
 * /api/v1/announcements/count:
 *   get:
 *     summary: Conta annunci per stato
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Stato degli annunci da contare.
 *     responses:
 *       '200':
 *         description: Conteggio degli annunci.
 */
router.get('/count', getResolvedAnnouncementsCount);
/**
 * @openapi
 * /api/v1/announcements:
 *   post:
 *     summary: Crea un annuncio
 *     responses:
 *       '201':
 *         description: Annuncio creato.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *             description: URI della risorsa creata
 */
router.post('/', upload.single('photo'), requireAuthUnlessQuick, createAnnouncement);   // richiede login salvo quick
/**
 * @openapi
 * /api/v1/announcements/{id}/similar:
 *   get:
 *     summary: Lista annunci simili
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *         description: Numero massimo di annunci simili da restituire.
 *     responses:
 *       '200':
 *         description: Lista degli annunci simili.
 */
router.get('/:id/similar', getSimilarAnnouncements);
router.get('/:id',  getAnnouncementById);
/**
 * @openapi
 * /api/v1/announcements/{id}/comments:
 *   post:
 *     summary: Aggiunge un commento a un annuncio
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '201':
 *         description: Commento creato.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *             description: URI della risorsa creata
 */
router.post('/:id/comments', authMiddleware, addAnnouncementComment);
/**
 * @openapi
 * /api/v1/announcements/{id}/reports:
 *   post:
 *     summary: Segnala un annuncio
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '201':
 *         description: Segnalazione creata.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *             description: URI della risorsa creata
 */
router.post('/:id/reports', authMiddleware, reportAnnouncement);
router.put('/:id', authMiddleware, upload.single('photo'), updateAnnouncement);
router.patch('/:id/status', authMiddleware, changeStatus);
router.delete('/:id', authMiddleware, deleteAnnouncement);
router.get('/:id/photo', getAnnouncementPhoto);
router.get('/:id/flyer', authMiddleware, generateFlyer);

module.exports = router;
