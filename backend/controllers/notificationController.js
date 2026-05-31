const mongoose = require('mongoose');
const Notification = require('../models/Notification');

/**
 * Handles the get notifications API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getNotifications = async (req, res) => {
  try {
    const unread = (req.query.unread === undefined) ? true : (String(req.query.unread) !== '0');
    const filter = { userId: req.user.userId };
    if (unread) filter.isRead = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero notifiche', error: err.message });
  }
};

/**
 * Handles the mark notification read API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.markNotificationRead = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID notifica non valido' });

    const notif = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      { isRead: true },
      { new: true }
    );

    if (!notif) return res.status(404).json({ message: 'Notifica non trovata' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ message: 'Errore aggiornamento notifica', error: err.message });
  }
};

/**
 * Handles the mark all read API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.markAllRead = async (req, res) => {
  try {
    const r = await Notification.updateMany(
      { userId: req.user.userId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true, modified: r.modifiedCount ?? r.nModified ?? 0 });
  } catch (err) {
    res.status(500).json({ message: 'Errore aggiornamento notifiche', error: err.message });
  }
};

