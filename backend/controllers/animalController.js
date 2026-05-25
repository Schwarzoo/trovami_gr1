const Animal = require('../models/Animal');

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
      microchipId,
      shelterId
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
      microchipId,
      
      shelterId
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

    const allowed = ['species','breed','gender','color','lunghezzaPelo','distinctiveFeatures','microchipId','shelterId'];
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const animal = await Animal.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!animal) return res.status(404).json({ message: 'Animal non trovato' });
    res.json(animal);
  } catch (err) {
    res.status(400).json({ message: 'Errore aggiornamento animal', error: err.message });
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
