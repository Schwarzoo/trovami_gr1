const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  announcementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Announcement',
    required: true
  },
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    enum: ['troll', 'offensivo', 'falso', 'altro'],
    required: true
  },
  details: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  status: {
    type: String,
    enum: ['OPEN', 'REVIEWED', 'DISMISSED'],
    default: 'OPEN'
  }
}, { timestamps: true });

reportSchema.index({ announcementId: 1, reporterId: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
