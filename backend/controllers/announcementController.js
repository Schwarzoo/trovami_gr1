const Announcement = require('../models/Announcement');

// GET /api/announcements
exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ status: 'ACTIVE' })
      .populate('animalId')    // popola i dati dell'animale
      .populate('publisherId', 'name email'); // popola solo nome/email

    res.json(announcements);
  } catch (err) {
    res.status(500).json({ message: 'Errore nel recupero degli annunci', error: err.message });
  }
};

// POST /api/announcements
exports.createAnnouncement = async (req, res) => {
  try {
    const {
      type, animalId, description,
      coordinates,   // [lng, lat]
      lastSeenDate, isCurrentlyThere, animalBehaviour, healthCondition
    } = req.body;

    const announcement = new Announcement({
      type,
      publisherId: req.user.id,  // viene dal middleware auth
      animalId,
      description,
      location: {
        type: 'Point',
        coordinates   // GeoJSON vuole [longitudine, latitudine]
      },
      lastSeenDate,
      isCurrentlyThere,
      animalBehaviour,
      healthCondition
    });

    await announcement.save();
    res.status(201).json(announcement);
  } catch (err) {
    res.status(400).json({ message: 'Errore nella creazione', error: err.message });
  }
};
