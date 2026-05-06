const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['LostAnimal', 'Sighting'],
        required: true
    },
    publisherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    animalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Animal',
        required: true
    },
    date: { type: Date, default: Date.now },
    description: { type: String, required: true },

    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true } // [Longitudine, Latitudine]
    },

    status: {
        type: String,
        enum: ['ACTIVE', 'RESOLVED', 'ARCHIVED'],
        default: 'ACTIVE'
    },

    lastSeenDate: { type: Date },

    // Campi specifici per Sighting (UC4)[cite: 1, 2]
    isCurrentlyThere: { type: Boolean, default: false },
    animalBehaviour:  { type: String,
        enum: ['tranquillo', 'spaventato', 'indifferente', 'aggressivo'],
        default: 'indifferente'
    },

    healthCondition:  { type: String,
        enum: ['in salute', 'ferito', 'malnutrito'],
        default: 'in salute'
    }

}, { timestamps: true });

// Indice per le query geografiche (Mappa)
announcementSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Announcement', announcementSchema);
