const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
  getReports,
  getAuditLogs,
  getUserDetails,
  getUserAnnouncementCount,
  updateReportStatus,
  deleteAnnouncementAsAdmin,
  blockUser,
  warnUser,
  unblockUser,
  getPendingReadmissionRequests,
  reviewReadmissionRequest,
  getPendingRifugi,
  approveRifugio,
  rejectRifugio
} = require('../controllers/adminController');

router.use(authMiddleware, requireRole('admin'));

router.get('/reports', getReports);
router.get('/audit-logs', getAuditLogs);
router.get('/users/:id/announcement-count', getUserAnnouncementCount);
router.get('/users/:id', getUserDetails);
router.get('/readmission-requests', getPendingReadmissionRequests);
router.patch('/reports/:id/status', updateReportStatus);
router.delete('/announcements/:id', deleteAnnouncementAsAdmin);
router.patch('/users/:id/block', blockUser);
router.patch('/users/:id/warn', warnUser);
router.patch('/users/:id/unblock', unblockUser);
router.patch('/users/:id/readmission/:action', reviewReadmissionRequest);
router.get('/rifugi/pending', getPendingRifugi);
router.patch('/rifugi/:id/approve', approveRifugio);
router.patch('/rifugi/:id/reject', rejectRifugio);

module.exports = router;
