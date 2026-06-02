const mongoose = require('mongoose');

/**
 * @typedef {Object} AuditLog
 * @description Rappresenta una voce di audit log nel database.
 * @property {mongoose.Types.ObjectId|null} actorId Utente che ha eseguito l'azione.
 * @property {string} actorName Nome visualizzato dell'operatore.
 * @property {string} action Azione registrata nel log.
 * @property {mongoose.Types.ObjectId|null} targetId Utente target dell'azione.
 * @property {string|null} targetUsername Nome utente del target, se disponibile.
 */
const auditLogSchema = new mongoose.Schema({
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    actorName: {
        type: String,
        required: true,
        default: 'anonimo',
        trim: true
    },

    action: {
        type: String,
        required: true,
        trim: true
    },

    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    targetUsername: {
        type: String,
        default: null,
        trim: true
    }
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorName: 1 });
auditLogSchema.index({ targetUsername: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema, 'audit_logs');
