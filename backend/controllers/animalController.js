const Animal = require('../models/Animal');
const mongoose = require('mongoose');

// POST /api/animals
exports.createAnimal = async (req, res) => {
  try {
    const {
      name,
      animalName,
      species,
        breed,
        gender,
        color,
        lunghezzaPelo,
        distinctiveFeatures,
        age,
        microchipId,
        shelterId,
        adoptable
    } = req.body;

    const normalizedName = typeof (name ?? animalName) === 'string'
      ? (name ?? animalName).trim()
      : (name ?? animalName ?? null);

    const animal = new Animal({
      name: normalizedName || null,
      species,
      breed,
      gender,
      color,
      lunghezzaPelo,
      distinctiveFeatures,
      age: typeof age === 'string' ? age.trim() : age,
      microchipId,
      shelterId: shelterId || (req.user && req.user.userId) || null,
      adoptable: !!adoptable
    });

    await animal.save();
    res.status(201).json(animal);
  } catch (err) {
    res.status(400).json({ message: 'Errore nella creazione', error: err.message });
  }
};

// PUT /api/animals/:id
exports.updateAnimal = async (req, res) => {
  try {
    const updates = {};

    const incomingName = req.body.name ?? req.body.animalName;
    if (incomingName !== undefined) {
      updates.name = typeof incomingName === 'string' ? incomingName.trim() : incomingName;
    }

    const allowed = ['species','breed','gender','color','lunghezzaPelo','distinctiveFeatures','age','microchipId','shelterId','adoptable','otherInfo'];
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    // handle dateArrived specifically (expect ISO date or empty)
    if (req.body.dateArrived !== undefined) {
      updates.dateArrived = req.body.dateArrived ? new Date(req.body.dateArrived) : null;
    }

    const animal = await Animal.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!animal) return res.status(404).json({ message: 'Animal non trovato' });

    // handle adding a medical note if provided
    if (req.body.medicalNote) {
      const noteText = String(req.body.medicalNote).trim();
      if (noteText) {
        animal.medicalNotes = animal.medicalNotes || [];
        animal.medicalNotes.push({ text: noteText });
        await animal.save();
      }
    }

    res.json(animal);
  } catch (err) {
    res.status(400).json({ message: 'Errore aggiornamento animal', error: err.message });
  }
};

// GET /api/animals/:id
exports.getAnimalById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'ID animale non valido' });
    const animal = await Animal.findById(id);
    if (!animal) return res.status(404).json({ message: 'Animal non trovato' });
    res.json(animal);
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero animal', error: err.message });
  }
};

// DELETE /api/animals/:id
exports.deleteAnimal = async (req, res) => {
  try {
    const animalId = req.params.id;

    // 1) controlla che sia un ObjectId valido
    if (!mongoose.isValidObjectId(animalId)) {
      return res.status(400).json({ message: "ID animale non valido" });
    }

    // 2) tenta cancellazione
    const deleted = await Animal.findByIdAndDelete(animalId);
    if (!deleted) {
      return res.status(404).json({ message: "Animal non trovato" });
    }

    res.json({ message: "Animal eliminato", id: deleted._id });
  } catch (err) {
    console.error("Errore in deleteAnimal:", err);
    res.status(500).json({ message: "Errore eliminazione animal", error: err.message });
  }
};

// GET /api/animals?shelterId=...
exports.listAnimals = async (req, res) => {
  try {
    const { shelterId } = req.query;
    const filter = {};
    if (shelterId) {
      if (!mongoose.isValidObjectId(shelterId)) return res.status(400).json({ message: 'ID rifugio non valido' });
      filter.shelterId = shelterId;
    } else if (req.user && req.user.userId) {
      filter.shelterId = req.user.userId;
    } else {
      // no filter and no auth -> return empty
      return res.json([]);
    }

    const animals = await Animal.find(filter).sort({ createdAt: -1 });

    // If some animals have empty photos, try to find a recent announcement photo to use as fallback
    const Announcement = require('../models/Announcement');
    const hostBase = req.protocol + '://' + req.get('host');
    const out = await Promise.all(animals.map(async (a) => {
      const obj = a.toObject ? a.toObject() : a;
      if ((!obj.photos || obj.photos.length === 0) && obj._id) {
        try {
          const ann = await Announcement.findOne({ animalId: obj._id, 'photo.data': { $exists: true } }).sort({ createdAt: -1 }).select('_id');
          if (ann && ann._id) {
            obj.photos = [`${hostBase}/api/announcements/${ann._id}/photo`];
          }
        } catch (e) {
          // ignore fallback error
        }
      }
      return obj;
    }));

    res.json(out);
  } catch (err) {
    res.status(500).json({ message: 'Errore recupero animali', error: err.message });
  }
};
