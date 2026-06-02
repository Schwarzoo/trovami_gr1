const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
  createContactRequest,
  getContactRequests,
  replyToContactRequest,
  clearRepliedContactRequests
} = require('../controllers/contactRequestController');

router.get('/', authMiddleware, getContactRequests);
/**
 * @openapi
 * /api/v1/contact-requests:
 *   post:
 *     summary: Crea una richiesta di contatto
 *     responses:
 *       '201':
 *         description: Richiesta di contatto creata.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *             description: URI della risorsa creata
 */
router.post('/', authMiddleware, createContactRequest);
router.patch('/', authMiddleware, clearRepliedContactRequests);
router.post('/:id/replies', authMiddleware, replyToContactRequest);

module.exports = router;
