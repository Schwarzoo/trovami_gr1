const express = require('express');
const router = express.Router();
const { getMe, updateMe, deleteMe, getPublicUser, getPublicRifugi, getFollowedShelters, followShelter, unfollowShelter } = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');

router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateMe);
router.delete('/me', authMiddleware, deleteMe);
router.get('/me/followed-shelters', authMiddleware, getFollowedShelters);
router.post('/me/followed-shelters/:shelterId', authMiddleware, followShelter);
router.delete('/me/followed-shelters/:shelterId', authMiddleware, unfollowShelter);
router.get('/shelters', getPublicRifugi);
// Italian alias expected by frontend/tests
router.get('/rifugi', getPublicRifugi);
router.get('/:id/public', authMiddleware, getPublicUser);

module.exports = router;

