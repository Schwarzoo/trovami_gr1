const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
  getReports,
  updateReportStatus,
  deleteAnnouncementAsAdmin,
  blockUser,
  unblockUser,
  getPendingRifugi,
  approveRifugio,
  rejectRifugio
} = require('../controllers/adminController');

router.use(authMiddleware, requireRole('admin'));

router.get('/reports', getReports);
router.patch('/reports/:id/status', updateReportStatus);
router.delete('/announcements/:id', deleteAnnouncementAsAdmin);
router.patch('/users/:id/block', blockUser);
router.patch('/users/:id/unblock', unblockUser);
router.get('/rifugi/pending', getPendingRifugi);
router.patch('/rifugi/:id/approve', approveRifugio);
router.patch('/rifugi/:id/reject', rejectRifugio);

module.exports = router;
