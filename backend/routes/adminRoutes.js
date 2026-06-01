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

/**
 * @openapi
 * /api/v1/admin/reports:
 *   get:
 *     summary: Lista report amministrativi
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filtra i report per stato, oppure usa all per includerli tutti.
 *     responses:
 *       '200':
 *         description: Lista dei report.
 */
router.get('/reports', getReports);
/**
 * @openapi
 * /api/v1/admin/audit-logs:
 *   get:
 *     summary: Lista log di audit
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numero massimo di log da restituire.
 *     responses:
 *       '200':
 *         description: Lista dei log di audit.
 */
router.get('/audit-logs', getAuditLogs);
router.get('/users/:id/announcement-count', getUserAnnouncementCount);
router.get('/users/:id', getUserDetails);
router.get('/readmissions', getPendingReadmissionRequests);
router.patch('/reports/:id/status', updateReportStatus);
router.delete('/announcements/:id', deleteAnnouncementAsAdmin);
/**
 * Routes admin user-status updates to the matching block or unblock controller.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware callback.
 * @returns {Promise<void>|void} Controller result or validation response.
 * @throws {Error} Returns an HTTP error response when the requested status is invalid.
 */
router.patch('/users/:id/status', (req, res, next) => {
  if (req.body?.status === 'blocked') return blockUser(req, res, next);
  if (req.body?.status === 'active') return unblockUser(req, res, next);
  return res.status(400).json({ message: 'Status utente non valido' });
});
/**
 * @openapi
 * /api/v1/admin/users/{id}/warnings:
 *   post:
 *     summary: Aggiunge un ammonimento a un utente
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Utente aggiornato con ammonimento.
 */
router.post('/users/:id/warnings', warnUser);
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
/**
 * @openapi
 * /api/v1/admin/rifugi:
 *   get:
 *     summary: Lista richieste rifugio
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filtra i rifugi per stato della richiesta.
 *     responses:
 *       '200':
 *         description: Lista dei rifugi filtrati.
 */
router.get('/rifugi', getPendingRifugi);
/**
 * Routes admin shelter-status updates to the approval or rejection controller.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware callback.
 * @returns {Promise<void>|void} Controller result or validation response.
 * @throws {Error} Returns an HTTP error response when the requested shelter status is invalid.
 */
router.patch('/rifugi/:id/status', (req, res, next) => {
  if (req.body?.rifugioStatus === 'approved') return approveRifugio(req, res, next);
  if (req.body?.rifugioStatus === 'rejected') return rejectRifugio(req, res, next);
  return res.status(400).json({ message: 'Status rifugio non valido' });
});

module.exports = router;
