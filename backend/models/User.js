const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username:     { type: String, required: true, unique: true },
    email:        { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    phoneNumber:  { type: String, default: null },
    isActive:     { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    role:         { type: String, enum: ['user', 'shelter', 'admin'], default: 'user' },
    rifugioStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    sessionToken: { type: String, default: null},

    contactVisibility: {
        showEmail: { type: Boolean, default: true },
        showPhone: { type: Boolean, default: true }
    },

    notificationPrefs: {
        emailOnComment: { type: Boolean, default: false },
        soundOnSite:    { type: Boolean, default: true }
    },

    conductWarnings: [{
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, default: 'Ammonimento sulla condotta account' },
        createdAt: { type: Date, default: Date.now }
    }],

    readmissionRequest: {
        status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
        message: { type: String, default: '' },
        requestedAt: { type: Date, default: null },
        reviewedAt: { type: Date, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    },

    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    emailVerificationToken: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },

    rifugioData: {
        rifugioName: { type: String },
        address: { type: String },
        city: { type: String },
        description: { type: String },
        totalSlots: { type: Number },
        availableSlots: { type: Number },
        location: {
            type: { type: String, enum: ['Point'] },
            coordinates: { type: [Number], default: undefined }
        }
    },

    shelterData: {
        shelterName:    { type: String },
        totalSlots:     { type: Number },
        availableSlots: { type: Number }, 
        location: {
            type: { type: String, enum: ['Point'] },
            coordinates: { type: [Number] , default: undefined }
        }
    }
}, { timestamps: true });

userSchema.pre('validate', function normalizeRole() {
    if (typeof this.role === 'string') {
        this.role = this.role.toLowerCase();
    }
    if (this.role === 'shelter' && (!this.rifugioStatus || this.rifugioStatus === 'none')) {
        this.rifugioStatus = 'pending';
    }
    if (this.role !== 'shelter' && (!this.rifugioStatus || this.rifugioStatus === 'pending')) {
        this.rifugioStatus = 'none';
    }
});

module.exports = mongoose.model('User', userSchema);
