const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    adminId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },

    date: { 
        type: Date, 
        required: true, 
        default: Date.now 
    },

    action: { 
        type: String, 
        enum: ['APPROVE_CONTENT', 'DELETE_CONTENT', 'BLOCK_USER', 'CREATE_SHELTER'], 
        required: true 
    },
   
    targetId: { //per capire il target dell'azione dell'admin (es. id dell'annuncio approvato o utente bloccato) 
        type: mongoose.Schema.Types.ObjectId, 
        required: true 
    },

    details: { type: String } 
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);