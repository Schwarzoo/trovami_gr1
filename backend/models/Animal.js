const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
    species:            { type: String, required: true }, // Dog, Cat, etc.
    breed:              { type: String, required: true }, // Labrador, Pinscher, etc.
    gender:             { type: String, enum: ['Maschio', 'Femmina', 'Sconosciuto'], required: true },
    color:              { type: String, required: true },
    lunghezzaPelo:      { type: String, enum: ['Corto', 'Lungo', 'Medio', 'Senza'] },
    distinctiveFeatures: { type: String }, // di segni particolari
    microchipId:        { type: String, default: null }, 
    photos:             [{ type: String }], //url foto
    shelterId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } // Se l'animale è in un rifugio[cite: 2]
}, { timestamps: true });

module.exports = mongoose.model('Animal', animalSchema);