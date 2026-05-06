require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');

const Announcement = require('./models/Announcement');

const app = express();
app.use(express.json());

mongoose.connect(process.env.DB_URL)
  .then(async () => {
    console.log('Connesso al database!');

    // =================================================================
    // INIZIO BLOCCO TEST - DA ELIMINARE DOPO IL SUCCESSO
    // =================================================================
    try {
      console.log('Tentativo di inserimento ANNOUNCEMENT di test...');

      // Announcement richiede publisherId e animalId come ObjectId refs.
      // Per il test usiamo ID finti validi (24 hex chars) senza creare
      // realmente un User o Animal su Atlas.
      const fakePublisherId = new mongoose.Types.ObjectId();
      const fakeAnimalId    = new mongoose.Types.ObjectId();

      const testAnnouncement = new Announcement({
        type:        'LostAnimal',
        publisherId:  fakePublisherId,
        animalId:     fakeAnimalId,
        description: 'TEST: Cane smarrito nei pressi del parco',
        location: {
          type:        'Point',
          coordinates: [11.1333, 46.0667]  // [longitudine, latitudine] - Trento
        },
        status:      'ACTIVE',
        lastSeenDate: new Date(),

        // Campi Sighting (opzionali su LostAnimal, ma li testiamo)
        isCurrentlyThere: false,
        animalBehaviour:  'spaventato',
        healthCondition:  'in salute'
      });

      await testAnnouncement.save();
      console.log('ANNOUNCEMENT CREATO CON SUCCESSO SU ATLAS:', testAnnouncement._id);

    } catch (testErr) {
      console.error('IL TEST ANNOUNCEMENT È ESPLOSO:', testErr.message);
      console.log('CONSIGLIO: Controlla che models/Announcement.js esista e che DB_URL sia nel .env');
    }
    // =================================================================
    // FINE BLOCCO TEST
    // =================================================================

    app.listen(process.env.PORT || 3000, () => {
      console.log('Server avviato sulla porta 3000');
    });
  })
  .catch(err => console.error('Errore connessione:', err));
