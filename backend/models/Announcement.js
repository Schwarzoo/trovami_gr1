const mongoose = require('mongoose');

/**
 * @typedef {Object} AnnouncementComment
 * @property {mongoose.Types.ObjectId} userId Identificativo dell'utente che scrive il commento.
 * @property {string} username Nome utente del commentatore.
 * @property {string} text Testo del commento.
 */
const commentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 }
}, { timestamps: { createdAt: true, updatedAt: false } });

/**
 * @typedef {Object} AnnouncementBase
 * @description Rappresenta i campi comuni a tutti gli annunci.
 * @property {mongoose.Types.ObjectId|null} publisherId Utente o rifugio che pubblica l'annuncio.
 * @property {mongoose.Types.ObjectId} animalId Animale collegato all'annuncio.
 * @property {Date} date Data di pubblicazione.
 * @property {string} description Descrizione testuale dell'annuncio.
 * @property {boolean} isQuick Indica se l'annuncio è stato creato rapidamente.
 * @property {{ name: string|null, email: string|null, phoneNumber: string|null }} quickContact Contatto rapido opzionale.
 * @property {{ type: string, coordinates: number[] }} location Posizione geografica dell'annuncio.
 * @property {string} status Stato operativo dell'annuncio.
 * @property {number[]|null} imageEmbedding Embedding dell'immagine, se presente.
 * @property {Date|null} lastSeenDate Data dell'ultimo avvistamento o della perdita.
 * @property {{ data: Buffer, contentType: string }|null} photo Foto associata all'annuncio.
 * @property {AnnouncementComment[]} comments Commenti collegati all'annuncio.
 */
const announcementBaseSchema = new mongoose.Schema({
    publisherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
    lastSeenDate: { type: Date, default: null },
    photo: {
        data: Buffer,
        contentType: String
    },
    comments: { type: [commentSchema], default: [] }
}, {
    timestamps: true,
    discriminatorKey: 'type'
});

announcementBaseSchema.pre('validate', function validateQuickAnnouncement() {
    if (this.isQuick === true) {
        const phoneNumber = this.quickContact?.phoneNumber;
        const email = this.quickContact?.email;

        if (!phoneNumber && !email) {
            const error = new mongoose.Error.ValidationError(this);
            error.addError(
                'quickContact',
                new mongoose.Error.ValidatorError({
                    path: 'quickContact',
                    message: 'Un annuncio rapido deve avere almeno un contatto tra phoneNumber ed email'
                })
            );
            throw error;
        }
    }
});

announcementBaseSchema.index({ location: '2dsphere' });

const Announcement = mongoose.model('Announcement', announcementBaseSchema);

/**
 * @typedef {AnnouncementBase & { isCurrentlyThere: boolean, animalBehaviour: string, healthCondition: string }} Sighting
 * @description Rappresenta un annuncio di avvistamento con campi dedicati.
 * @property {boolean} isCurrentlyThere Indica se l'animale è ancora presente nel luogo dell'avvistamento.
 * @property {string} animalBehaviour Comportamento osservato dell'animale.
 * @property {string} healthCondition Condizioni di salute osservate.
 */
const sightingSchema = new mongoose.Schema({
    isCurrentlyThere: { type: Boolean, default: false },
    animalBehaviour: {
        type: String,
        enum: ['tranquillo', 'spaventato', 'indifferente', 'aggressivo'],
        default: 'indifferente'
    },
    healthCondition: {
        type: String,
        enum: ['in salute', 'ferito', 'malnutrito'],
        default: 'in salute'
    }
});

/**
 * @typedef {AnnouncementBase} LostAnimal
 * @description Rappresenta un annuncio di smarrimento.
 */
const LostAnimal = Announcement.discriminator('LostAnimal', new mongoose.Schema({}, { _id: false }));

/**
 * @typedef {AnnouncementBase & { isCurrentlyThere: boolean, animalBehaviour: string, healthCondition: string }} Sighting
 * @description Rappresenta un annuncio di avvistamento con campi dedicati.
 * @property {boolean} isCurrentlyThere Indica se l'animale è ancora presente nel luogo dell'avvistamento.
 * @property {string} animalBehaviour Comportamento osservato dell'animale.
 * @property {string} healthCondition Condizioni di salute osservate.
 */
const Sighting = Announcement.discriminator('Sighting', sightingSchema);

module.exports = Announcement;
module.exports.Announcement = Announcement;
module.exports.announcementBaseSchema = announcementBaseSchema;
module.exports.LostAnimal = LostAnimal;
module.exports.Sighting = Sighting;
