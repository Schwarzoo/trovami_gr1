const mongoose = require('mongoose');

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
