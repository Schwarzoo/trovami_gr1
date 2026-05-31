const mongoose = require('mongoose');
const Announcement = require('../models/Announcement');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const User = require('../models/User');
const { removeAnnouncementCascade } = require('./announcementController');
const { buildAuditQuery, writeAuditLog } = require('../services/auditService');
const { sendAccountBlockedEmail } = require('../services/emailService');

/**
 * Sends a standardized HTTP 400 response for an invalid MongoDB identifier.
 * @param {Object} res - Express response object.
 * @param {string} label - Human-readable name of the invalid identifier.
 * @returns {import('express').Response} Express response with the validation error body.
 */
function invalidId(res, label) {
  return res.status(400).json({ message: `${label} non valido` });
}

/**
 * Writes an admin audit entry without exposing audit persistence details to handlers.
 * @param {string} actorId - Authenticated admin user identifier.
 * @param {string} action - Audit action label to store.
 * @param {Object|string|null} target - User, announcement owner, or identifier affected by the action.
 * @returns {Promise<void>} Promise resolving after the audit write attempt finishes.
 */
async function writeAudit(actorId, action, target) {
  await writeAuditLog({ actor: actorId, action, target });
}

/**
 * Returns published announcements count.
 * @param {string} userId - Publisher user identifier.
 * @returns {Promise<number>} Number of announcements published by the user.
 */
async function getPublishedAnnouncementsCount(userId) {
  return Announcement.countDocuments({ publisherId: userId });
}

/**
 * Adds the published-announcement count to a user payload.
 * @param {Object} user - Mongoose user document or plain user object.
 * @returns {Promise<Object>} User payload with `publishedAnnouncementsCount`.
 */
async function withPublishedAnnouncementsCount(user) {
  const obj = user.toObject ? user.toObject() : user;
  obj.publishedAnnouncementsCount = await getPublishedAnnouncementsCount(obj._id);
  return obj;
}

/**
 * Handles the get reports API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getReports = async (req, res) => {
  try {
    const status = req.query.status || 'OPEN';
    const filter = status === 'all' ? {} : { status };
    const reports = await Report.find(filter)
      .populate('reporterId', 'username email')
      .populate({
        path: 'announcementId',
        select: '-photo',
        populate: [
          { path: 'animalId' },
          { path: 'publisherId', select: 'username email phoneNumber role rifugioStatus rifugioData isActive createdAt conductWarnings' }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(200);

    const publisherIds = [
      ...new Set(reports
        .map(report => report.announcementId?.publisherId?._id)
        .filter(Boolean)
        .map(id => id.toString()))
    ];
    const counts = await Promise.all(publisherIds.map(async (userId) => ({
      userId,
      count: await getPublishedAnnouncementsCount(userId)
    })));
    const countByUserId = new Map(counts.map(({ userId, count }) => [userId, count]));

    res.json(reports.map(report => {
      const obj = report.toObject();
      const publisher = obj.announcementId?.publisherId;
      if (publisher?._id) {
        publisher.publishedAnnouncementsCount = countByUserId.get(publisher._id.toString()) || 0;
      }
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero report', error: err.message });
  }
};

/**
 * Handles the get user details API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, 'ID utente');

    const user = await User.findById(userId).select('-passwordHash -sessionToken');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    res.json(await withPublishedAnnouncementsCount(user));
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero utente', error: err.message });
  }
};

/**
 * Handles the get user announcement count API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getUserAnnouncementCount = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, 'ID utente');

    res.json({ publishedAnnouncementsCount: await getPublishedAnnouncementsCount(userId) });
  } catch (err) {
    res.status(500).json({ message: 'Errore conteggio annunci utente', error: err.message });
  }
};

/**
 * Handles the get audit logs API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { filter, sort, limit } = buildAuditQuery(req.query);
    const logs = await AuditLog.find(filter).sort(sort).limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero audit logs', error: err.message });
  }
};

/**
 * Handles the update report status API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.updateReportStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return invalidId(res, 'ID report');
    const allowed = ['OPEN', 'REVIEWED', 'DISMISSED'];
    const status = req.body.status;
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Status report non valido' });

    const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!report) return res.status(404).json({ message: 'Report non trovato' });

    if (status === 'DISMISSED') {
      await writeAudit(req.user.userId, 'archiviato report', null);
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Errore aggiornamento report', error: err.message });
  }
};

/**
 * Handles the delete announcement as admin API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.deleteAnnouncementAsAdmin = async (req, res) => {
  try {
    const announcementId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(announcementId)) return invalidId(res, 'ID annuncio');

    const announcement = await Announcement.findById(announcementId).populate('publisherId', 'username email');
    if (!announcement) return res.status(404).json({ message: 'Annuncio non trovato' });

    const publisherId = announcement.publisherId?._id || announcement.publisherId || null;
    const reason = (req.body?.reason || 'violazione delle regole').toString().trim();
    await removeAnnouncementCascade(announcementId);
    await Report.updateMany({ announcementId }, { $set: { status: 'REVIEWED' } });

    if (publisherId) {
      await Notification.create({
        userId: publisherId,
        type: 'admin_warning',
        targetUserId: publisherId,
        message: `Annuncio eliminato, motivo: ${reason}`
      });
    }

    await writeAudit(req.user.userId, 'eliminato annuncio', announcement.publisherId || null);
    res.json({ success: true, warnedUser: !!publisherId });
  } catch (err) {
    res.status(500).json({ message: 'Errore eliminazione admin', error: err.message });
  }
};

/**
 * Handles the block user API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.blockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, 'ID utente');
    if (userId === req.user.userId) return res.status(400).json({ message: 'Non puoi bloccare il tuo account admin' });

    const reason = (req.body?.reason || 'Account bloccato da admin').toString().trim() || 'Account bloccato da admin';
    const userAnnouncements = await Announcement.find({ publisherId: userId }).select('_id');
    const announcementIds = userAnnouncements.map(announcement => announcement._id);
    const relatedReports = announcementIds.length
      ? await Report.find({ announcementId: { $in: announcementIds } }).select('_id')
      : [];
    const relatedReportIds = relatedReports.map(report => report._id);
    const user = await User.findByIdAndUpdate(
      userId,
      {
        isActive: false,
        sessionToken: null,
        conductWarnings: [],
        readmissionRequest: {
          status: 'none',
          message: '',
          requestedAt: null,
          reviewedAt: null,
          reviewedBy: null
        }
      },
      { new: true }
    ).select('-passwordHash -sessionToken');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    await Promise.all(announcementIds.map(announcementId => removeAnnouncementCascade(announcementId)));
    const reviewedReports = announcementIds.length
      ? await Report.updateMany({ announcementId: { $in: announcementIds } }, { $set: { status: 'REVIEWED' } })
      : { modifiedCount: 0 };
    if (announcementIds.length || relatedReportIds.length) {
      await Notification.updateMany(
        {
          type: 'report',
          isRead: false,
          $or: [
            { announcementId: { $in: announcementIds } },
            { reportId: { $in: relatedReportIds } }
          ]
        },
        { $set: { isRead: true } }
      );
    }
    await sendAccountBlockedEmail(user, reason);
    await writeAudit(req.user.userId, 'bloccato utente', user);
    const responseUser = await withPublishedAnnouncementsCount(user);
    responseUser.removedAnnouncementsCount = announcementIds.length;
    responseUser.reviewedReportsCount = reviewedReports.modifiedCount || 0;
    res.json(responseUser);
  } catch (err) {
    res.status(500).json({ message: 'Errore blocco utente', error: err.message });
  }
};

/**
 * Handles the get pending readmission requests API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getPendingReadmissionRequests = async (req, res) => {
  try {
    const users = await User.find({
      isActive: false,
      'readmissionRequest.status': 'pending'
    })
      .select('username email phoneNumber readmissionRequest conductWarnings createdAt')
      .sort({ 'readmissionRequest.requestedAt': -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero richieste riammissione', error: err.message });
  }
};

/**
 * Handles the review readmission request API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.reviewReadmissionRequest = async (req, res) => {
  try {
    const userId = req.params.id;
    const action = req.params.action;
    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, 'ID utente');
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'Azione riammissione non valida' });

    const update = {
      'readmissionRequest.status': action === 'approve' ? 'approved' : 'rejected',
      'readmissionRequest.reviewedAt': new Date(),
      'readmissionRequest.reviewedBy': req.user.userId
    };
    if (action === 'approve') {
      update.isActive = true;
    }

    const user = await User.findByIdAndUpdate(userId, update, { new: true }).select('-passwordHash -sessionToken');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    try {
      await Notification.create({
        userId: user._id,
        type: 'admin_warning',
        targetUserId: user._id,
        message: action === 'approve'
          ? 'La tua richiesta di riammissione e stata approvata. Ora puoi accedere.'
          : 'La tua richiesta di riammissione e stata rifiutata.'
      });
      await Notification.updateMany(
        {
          targetUserId: user._id,
          type: 'admin_warning',
          isRead: false,
          message: { $regex: '^Richiesta di riammissione da ' }
        },
        { $set: { isRead: true } }
      );
      await writeAudit(req.user.userId, action === 'approve' ? 'approvato riammissione' : 'rifiutato riammissione', user);
    } catch (sideEffectErr) {
      console.warn('Errore side effect riammissione:', sideEffectErr.message);
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore gestione riammissione', error: err.message });
  }
};

/**
 * Handles the warn user API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.warnUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, 'ID utente');
    if (userId === req.user.userId) return res.status(400).json({ message: 'Non puoi ammonire il tuo account admin' });

    const reason = (req.body?.reason || 'Ammonimento sulla condotta account').toString().trim() || 'Ammonimento sulla condotta account';
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          conductWarnings: {
            adminId: req.user.userId,
            reason,
            createdAt: new Date()
          }
        }
      },
      { new: true }
    ).select('-passwordHash -sessionToken');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    await Notification.create({
      userId: user._id,
      type: 'admin_warning',
      targetUserId: user._id,
      message: "Hai ricevuto un ammonimento sulla condotta dell'account; al prossimo ammonimento ci sara il blocco dell'account."
    });
    await writeAudit(req.user.userId, 'ammonito utente', user);
    res.json(await withPublishedAnnouncementsCount(user));
  } catch (err) {
    res.status(500).json({ message: 'Errore ammonimento utente', error: err.message });
  }
};

/**
 * Handles the unblock user API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.unblockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, 'ID utente');

    const user = await User.findByIdAndUpdate(userId, { isActive: true }, { new: true }).select('-passwordHash -sessionToken');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    await writeAudit(req.user.userId, 'sbloccato utente', user);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore sblocco utente', error: err.message });
  }
};

/**
 * Handles the get pending rifugi API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getPendingRifugi = async (req, res) => {
  try {
    const status = (req.query?.status || 'pending').toString().trim();
    const rifugi = await User.find({ role: 'shelter', rifugioStatus: status })
      .select('-passwordHash -sessionToken')
      .sort({ createdAt: -1 });
    res.json(rifugi);
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero rifugi', error: err.message });
  }
};

/**
 * Handles the approve rifugio API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.approveRifugio = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, 'ID rifugio');

    const user = await User.findOneAndUpdate(
      { _id: userId, role: 'shelter' },
      { rifugioStatus: 'approved', isActive: true },
      { new: true }
    ).select('-passwordHash -sessionToken');
    if (!user) return res.status(404).json({ message: 'Rifugio non trovato' });

    await Notification.create({
      userId: user._id,
      type: 'admin_warning',
      targetUserId: user._id,
      message: 'Il tuo account rifugio e stato approvato'
    });
    await writeAudit(req.user.userId, 'approvato rifugio', user);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore approvazione rifugio', error: err.message });
  }
};

/**
 * Handles the reject rifugio API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.rejectRifugio = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, 'ID rifugio');

    const reason = req.body?.reason || 'Richiesta rifugio rifiutata';
    const user = await User.findOneAndUpdate(
      { _id: userId, role: 'shelter' },
      { rifugioStatus: 'rejected' },
      { new: true }
    ).select('-passwordHash -sessionToken');
    if (!user) return res.status(404).json({ message: 'Rifugio non trovato' });

    await Notification.create({
      userId: user._id,
      type: 'admin_warning',
      targetUserId: user._id,
      message: `Richiesta rifugio rifiutata: ${reason}`
    });
    await writeAudit(req.user.userId, 'rifiutato rifugio', user);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore rifiuto rifugio', error: err.message });
  }
};
