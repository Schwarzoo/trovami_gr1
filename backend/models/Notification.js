const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    idAnnoucement: { 
        type: Number, 
        required: true, 
        unique: true 
    },

    date: { 
        type: Date, 
        required: true, 
        default: Date.now 
    },

    description: { 
        type: String, 
        required: true 
    },
    
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true } // [Long, Lat]
    },
    
    // Status deve riflettere l'enumerazione Status del diagramma
    status: { 
        type: String, 
        enum: ['ACTIVE', 'RESOLVED', 'ARCHIVED'], 
        required: true,
        default: 'ACTIVE' 
    }
    
}, { timestamps: true });

// Indice fondamentale per le query spaziali su Trento (RF2)[cite: 1]
announcementSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Announcement', announcementSchema);