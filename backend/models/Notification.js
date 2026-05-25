const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['comment', 'SMART_MATCH'], required: true },
  announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true },
  commentId: { type: mongoose.Schema.Types.ObjectId, required: false, default: null },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

