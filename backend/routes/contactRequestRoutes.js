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
router.post('/', authMiddleware, createContactRequest);
router.patch('/', authMiddleware, clearRepliedContactRequests);
router.post('/:id/replies', authMiddleware, replyToContactRequest);

module.exports = router;
