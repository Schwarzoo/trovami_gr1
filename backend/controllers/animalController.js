const Animal = require('../models/Animal');

// POST /api/animals
exports.createAnimal = async (req, res) => {
  try {
    const {
      species,
      breed,
      gender,
      color,
      lunghezzaPelo,
      distinctiveFeatures,
      microchipId,
      photos,
      shelterId
    } = req.body;

    const animal = new Animal({
      species,
      breed,
      gender,
      color,
      lunghezzaPelo,
      distinctiveFeatures,
      microchipId,
      photos,
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
    const allowed = ['species','breed','gender','color','lunghezzaPelo','distinctiveFeatures','microchipId','photos','shelterId'];
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const animal = await Animal.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!animal) return res.status(404).json({ message: 'Animal non trovato' });
    res.json(animal);
  } catch (err) {
    res.status(400).json({ message: 'Errore aggiornamento animal', error: err.message });
  }
};
