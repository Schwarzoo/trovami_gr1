const mongoose = require('mongoose');

/**
 * @typedef {Object} ContactRequest
 * @description Rappresenta una richiesta di contatto tra un utente e un rifugio.
 * @property {mongoose.Types.ObjectId} requesterId Utente che invia la richiesta.
 * @property {mongoose.Types.ObjectId} shelterId Rifugio destinatario.
 * @property {mongoose.Types.ObjectId} animalId Animale a cui la richiesta fa riferimento.
 * @property {string} message Messaggio inviato dal richiedente.
 * @property {string} replyMessage Risposta del rifugio, se presente.
 * @property {Date|null} repliedAt Data della risposta, se disponibile.
 * @property {boolean} hiddenForShelter Visibilità della richiesta per il rifugio.
 * @property {boolean} hiddenForRequester Visibilità della richiesta per il richiedente.
 * @property {string} status Stato corrente della richiesta.
 */
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
