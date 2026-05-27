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
router.get('/readmissions', getPendingReadmissionRequests);
router.patch('/reports/:id/status', updateReportStatus);
router.delete('/announcements/:id', deleteAnnouncementAsAdmin);
router.patch('/users/:id/status', (req, res, next) => {
  if (req.body?.status === 'blocked') return blockUser(req, res, next);
  if (req.body?.status === 'active') return unblockUser(req, res, next);
  return res.status(400).json({ message: 'Status utente non valido' });
});
router.post('/users/:id/warnings', warnUser);
router.patch('/readmissions/:id', (req, res, next) => {
  const status = req.body?.status;
  if (status === 'approved') req.params.action = 'approve';
  else if (status === 'rejected') req.params.action = 'reject';
  else return res.status(400).json({ message: 'Status riammissione non valido' });
  return reviewReadmissionRequest(req, res, next);
});
router.get('/rifugi/pending', getPendingRifugi);
router.patch('/rifugi/:id/status', (req, res, next) => {
  if (req.body?.rifugioStatus === 'approved') return approveRifugio(req, res, next);
  if (req.body?.rifugioStatus === 'rejected') return rejectRifugio(req, res, next);
  return res.status(400).json({ message: 'Status rifugio non valido' });
});

module.exports = router;
