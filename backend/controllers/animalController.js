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