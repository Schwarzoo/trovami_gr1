const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    announcementId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Announcement',
        required: true 
    },

    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    date: { 
        type: Date, 
        required: true, 
        default: Date.now 
    },

    message: { 
        type: String, 
        required: true 
    },

    isRead: {
        type: Boolean,
        default: false
    },

    type: {
        type: String,
        enum: ['SMART_MATCH', 'SHELTER_CONTACT', 'ADMIN_ACTION'],
        required: true
    }

}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);