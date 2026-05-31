const mongoose = require('mongoose');

/**
 * @typedef {Object} Announcement
 * @description Rappresenta un annuncio pubblicato nel database.
 * @property {string} type Tipo di annuncio.
 * @property {mongoose.Types.ObjectId} publisherId Utente che pubblica l'annuncio.
 * @property {mongoose.Types.ObjectId} animalId Animale associato all'annuncio.
 * @property {Date} date Data dell'annuncio.
 * @property {string} description Descrizione dell'annuncio.
 * @property {boolean} isQuick Indica se l'annuncio è stato creato rapidamente.
 * @property {{ name: string, email: string, phoneNumber: string }} quickContact Contatto rapido, se presente.
 * @property {{ type: string, coordinates: number[] }} location Posizione geografica dell'annuncio.
 * @property {string} status Stato corrente dell'annuncio.
 * @property {number[]|null} imageEmbedding Embedding immagine, se presente.
 * @property {Date} lastSeenDate Data dell'ultimo avvistamento.
 * @property {boolean} isCurrentlyThere Indica se l'animale è ancora sul posto.
 * @property {string} animalBehaviour Comportamento osservato.
 * @property {string} healthCondition Condizioni di salute.
 * @property {{ data: Buffer, contentType: string }} photo Foto archiviata nel database.
 * @property {Array<{ userId: mongoose.Types.ObjectId, username: string, text: string }>} comments Commenti collegati all'annuncio.
 */
const commentSchema = new mongoose.Schema({
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    text:     { type: String, required: true, trim: true, maxlength: 500 }
}, { timestamps: { createdAt: true, updatedAt: false } });

const announcementSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['LostAnimal', 'Sighting'],
        required: true
    },
    publisherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        default: null
    },
    animalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Animal',
        required: true
    },
    date: { type: Date, default: Date.now },
    description: { type: String, required: true },
    isQuick: { type: Boolean, default: false },
    quickContact: {
        name: { type: String, default: null },
        email: { type: String, default: null },
        phoneNumber: { type: String, default: null }
    },

    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }
    },

    status: {
        type: String,
        enum: ['ACTIVE', 'RESOLVED', 'ARCHIVED'],
        default: 'ACTIVE'
    },

    imageEmbedding: { 
        type: [Number], 
        default: null 
    },

    lastSeenDate: { type: Date },

    isCurrentlyThere: { type: Boolean, default: false },
    animalBehaviour:  { type: String,
        enum: ['tranquillo', 'spaventato', 'indifferente', 'aggressivo'],
        default: 'indifferente'
    },

    healthCondition:  { type: String,
        enum: ['in salute', 'ferito', 'malnutrito'],
        default: 'in salute'
    }

    ,
    photo: {
        data: Buffer,
        contentType: String
    }

    ,
    comments: { type: [commentSchema], default: [] }

}, { timestamps: true });

announcementSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Announcement', announcementSchema);
