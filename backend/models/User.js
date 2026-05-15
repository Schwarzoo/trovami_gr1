const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username:     { type: String, required: true, unique: true },
    email:        { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    phoneNumber:  { type: String, default: null },
    isActive:     { type: Boolean, default: true },
    role:         { type: String, enum: ['Segnalatore', 'Ricercatore', 'Shelter', 'Administrator'], default: 'Segnalatore' },
    sessionToken: { type: String, default: null},

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

module.exports = mongoose.model('User', userSchema);