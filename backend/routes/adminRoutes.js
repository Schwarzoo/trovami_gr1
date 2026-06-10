const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
  getReports,
  getAuditLogs,
  getUserDetails,
  updateReportStatus,
  deleteAnnouncementAsAdmin,
  updateUserStatus,
  getPendingReadmissionRequests,
  reviewReadmissionRequest,
  getPendingRifugi,
  updateRifugioStatus
} = require('../controllers/adminController');

router.use(authMiddleware, requireRole('admin'));

router.get('/reports', getReports);
router.get('/audit-logs', getAuditLogs);
router.get('/users/:id', getUserDetails);
router.get('/readmissions', getPendingReadmissionRequests);
router.patch('/reports/:id', updateReportStatus);
router.delete('/announcements/:id', deleteAnnouncementAsAdmin);
router.patch('/users/:id', updateUserStatus);
router.post('/users/:id/warnings', (req, res, next) => {
  req.body = { ...(req.body || {}), action: 'warn' };
  return updateUserStatus(req, res, next);
});
/**
 * Converts readmission status values into the controller action parameter.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware callback.
 * @returns {Promise<void>|void} Controller result or validation response.
 * @throws {Error} Returns an HTTP error response when the requested status is invalid.
 */
router.patch('/readmissions/:id', (req, res, next) => {
  const status = req.body?.status;
  if (status === 'approved') req.params.action = 'approve';
  else if (status === 'rejected') req.params.action = 'reject';
  else return res.status(400).json({ message: 'Status riammissione non valido' });
  return reviewReadmissionRequest(req, res, next);
});
router.get('/rifugi', getPendingRifugi);
router.patch('/rifugi/:id', updateRifugioStatus);

module.exports = router;
