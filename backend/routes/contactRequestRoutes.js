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
router.patch('/clear-replied', authMiddleware, clearRepliedContactRequests);
router.patch('/:id/reply', authMiddleware, replyToContactRequest);

module.exports = router;
