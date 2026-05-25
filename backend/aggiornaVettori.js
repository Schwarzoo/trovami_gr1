require('dotenv').config();
const mongoose = require('mongoose');
const Announcement = require('./models/Announcement');
const smartMatchingEngine = require('./services/SmartMatchingEngine');

// Funzione per far "riposare" lo script ed evitare di bloccare l'API gratuita
const delay = ms => new Promise(res => setTimeout(res, ms));

async function backfillEmbeddings() {
    try {
        // 1. Connessione al DB
        console.log("Connessione al database in corso...");
        await mongoose.connect(process.env.DB_URL);
        console.log("Connesso!");

        // 2. Troviamo gli annunci che HANNO una foto ma NON HANNO ancora l'embedding
        const annunciDaAggiornare = await Announcement.find({
            'photo.data': { $exists: true },
            $or: [
                { imageEmbedding: { $exists: false } },
                { imageEmbedding: null },
                { imageEmbedding: { $size: 0 } }
            ]
        });

        console.log(`Trovati ${annunciDaAggiornare.length} annunci da elaborare.`);

        // 3. Cicliamo su ogni annuncio e generiamo il vettore
        let aggiornati = 0;
        let errori = 0;

        for (const annuncio of annunciDaAggiornare) {
            console.log(`Elaborazione annuncio ID: ${annuncio._id}...`);
            
            const embedding = await smartMatchingEngine.generateImageEmbedding(annuncio.photo.data);
            
            if (embedding && embedding.length > 0) {
                annuncio.imageEmbedding = embedding;
                await annuncio.save();
                console.log(`✅ Vettore salvato per ${annuncio._id}`);
                aggiornati++;
            } else {
                console.log(`❌ Fallito per ${annuncio._id}`);
                errori++;
            }

            // Aspettiamo 2 secondi tra una chiamata e l'altra per non far arrabbiare Hugging Face (Rate Limiting)
            await delay(2000);
        }

        console.log("\n--- MIGRAZIONE COMPLETATA ---");
        console.log(`Annunci aggiornati con successo: ${aggiornati}`);
        console.log(`Errori: ${errori}`);

    } catch (error) {
        console.error("Errore generale:", error);
    } finally {
        // Chiudiamo la connessione alla fine
        mongoose.disconnect();
        process.exit(0);
    }
}

backfillEmbeddings();