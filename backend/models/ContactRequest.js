const mongoose = require('mongoose');

const contactRequestSchema = new mongoose.Schema({
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shelterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  animalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal', required: true },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  replyMessage: { type: String, default: '', trim: true, maxlength: 1000 },
  repliedAt: { type: Date, default: null },
  hiddenForShelter: { type: Boolean, default: false },
  hiddenForRequester: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['pending', 'replied', 'closed'],
    default: 'pending'
  }
}, { timestamps: true });

contactRequestSchema.index({ shelterId: 1, status: 1, createdAt: -1 });
contactRequestSchema.index({ requesterId: 1, createdAt: -1 });

module.exports = mongoose.model('ContactRequest', contactRequestSchema);
