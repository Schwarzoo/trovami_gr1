require('dotenv').config();
const mongoose = require('mongoose');
const Announcement = require('./models/Announcement');

async function inizializzaCampi() {
    try {
        console.log("Connessione al database...");
        await mongoose.connect(process.env.DB_URL);
        console.log("Connesso!");

        // Trova tutti gli annunci che non hanno proprio il campo 'imageEmbedding'
        const result = await Announcement.updateMany(
            { imageEmbedding: { $exists: false } }, 
            { $set: { imageEmbedding: null } }
        );

        console.log(`Aggiornamento completato: ${result.modifiedCount} annunci inizializzati con 'null'.`);
        process.exit();
    } catch (error) {
        console.error("Errore durante l'inizializzazione:", error);
        process.exit(1);
    }
}

inizializzaCampi();