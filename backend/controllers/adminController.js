const mongoose = require('mongoose');
const Announcement = require('../models/Announcement');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const User = require('../models/User');
const { removeAnnouncementCascade } = require('./announcementController');

function invalidId(res, label) {
  return res.status(400).json({ message: `${label} non valido` });
}

async function writeAudit(adminId, action, targetId, details) {
  await AuditLog.create({ adminId, action, targetId, details });
}

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
          { path: 'publisherId', select: 'username email role rifugioData isActive' }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero report', error: err.message });
  }
};

exports.updateReportStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return invalidId(res, 'ID report');
    const allowed = ['OPEN', 'REVIEWED', 'DISMISSED'];
    const status = req.body.status;
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Status report non valido' });

    const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!report) return res.status(404).json({ message: 'Report non trovato' });

    if (status === 'DISMISSED') {
      await writeAudit(req.user.userId, 'DISMISS_REPORT', report._id, req.body.details || 'Report archiviato');
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Errore aggiornamento report', error: err.message });
  }
};

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
        announcementId,
        targetUserId: publisherId,
        message: `Un tuo annuncio e' stato rimosso: ${reason}`
      });
    }

    await writeAudit(req.user.userId, 'DELETE_CONTENT', announcementId, reason);
    res.json({ success: true, warnedUser: !!publisherId });
  } catch (err) {
    res.status(500).json({ message: 'Errore eliminazione admin', error: err.message });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, 'ID utente');
    if (userId === req.user.userId) return res.status(400).json({ message: 'Non puoi bloccare il tuo account admin' });

    const user = await User.findByIdAndUpdate(userId, { isActive: false, sessionToken: null }, { new: true }).select('-passwordHash -sessionToken');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    await writeAudit(req.user.userId, 'BLOCK_USER', user._id, req.body?.reason || 'Account bloccato da admin');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore blocco utente', error: err.message });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, 'ID utente');

    const user = await User.findByIdAndUpdate(userId, { isActive: true }, { new: true }).select('-passwordHash -sessionToken');
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    await writeAudit(req.user.userId, 'UNBLOCK_USER', user._id, 'Account sbloccato da admin');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore sblocco utente', error: err.message });
  }
};

exports.getPendingRifugi = async (req, res) => {
  try {
    const rifugi = await User.find({ role: 'shelter', rifugioStatus: 'pending' })
      .select('-passwordHash -sessionToken')
      .sort({ createdAt: -1 });
    res.json(rifugi);
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero rifugi', error: err.message });
  }
};

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
    await writeAudit(req.user.userId, 'APPROVE_RIFUGIO', user._id, 'Rifugio approvato');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore approvazione rifugio', error: err.message });
  }
};

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
    await writeAudit(req.user.userId, 'REJECT_RIFUGIO', user._id, reason);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore rifiuto rifugio', error: err.message });
  }
};
