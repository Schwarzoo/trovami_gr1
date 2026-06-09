const mongoose = require('mongoose');

/**
 * @typedef {Object} Animal
 * @description Rappresenta un animale registrato nel database.
 * @property {string} name Nome dell'animale.
 * @property {string} species Specie dell'animale.
 * @property {string} breed Razza dell'animale.
 * @property {string} gender Genere dell'animale.
 * @property {string} color Colore del mantello.
 * @property {string} lunghezzaPelo Lunghezza del pelo.
 * @property {string} distinctiveFeatures Segni particolari.
 * @property {string} age Età dell'animale.
 * @property {string} microchipId Identificativo del microchip.
 * @property {mongoose.Types.ObjectId} shelterId Rifugio associato, se presente.
 * @property {boolean} adoptable Indica se l'animale è adottabile.
 * @property {{ data: Buffer, contentType: string }} photo Foto principale salvata nel database.
 * @property {string[]} photos Elenco degli URL delle foto o fallback legacy.
 * @property {Date} dateArrived Data di arrivo.
 * @property {Array<{ text: string, createdAt: Date }>} medicalNotes Note mediche.
 * @property {string} otherInfo Informazioni aggiuntive.
 */
const animalSchema = new mongoose.Schema({
    name:               { type: String, trim: true, default: null },
    species:            { type: String, required: true },
    breed:              { type: String, required: true },
    gender:             { type: String, enum: ['Maschio', 'Femmina', 'Sconosciuto'], required: true },
    color:              { type: String, required: true },
    lunghezzaPelo:      { type: String, enum: ['Corto', 'Lungo', 'Medio', 'Senza'] },
    distinctiveFeatures: { type: String },
    age:                { type: String, default: null },
    microchipId:        { type: String, default: null }, 
    shelterId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    adoptable:          { type: Boolean, default: false },
    photo:              {
        data: { type: Buffer, select: false },
        contentType: String
    },
    photos:             [{ type: String }],
    dateArrived:        { type: Date, default: null },
    medicalNotes:       [{ text: String, createdAt: { type: Date, default: Date.now } }],
    otherInfo:          { type: String, default: '' }
}, { timestamps: true });

animalSchema.pre('validate', function validateAdoptableAnimal() {
    if (this.adoptable === true && !this.shelterId) {
        const error = new mongoose.Error.ValidationError(this);
        error.addError(
            'shelterId',
            new mongoose.Error.ValidatorError({
                path: 'shelterId',
                message: 'Un animale adottabile deve avere un rifugio assegnato'
            })
        );
        throw error;
    }
});

module.exports = mongoose.model('Animal', animalSchema);
