const Announcement = require('../models/Announcement');
const Animal = require('../models/Animal');

// GET /api/announcements
exports.getAnnouncements = async (req, res) => {
    try {
        const { type, species, status } = req.query;
 
        const filter = {};
        filter.status = status || 'ACTIVE'; // default: solo attivi
        if (type) filter.type = type;
 
        // Se filtro per specie, prima trova gli animalId corrispondenti
        if (species) {
            const animals = await Animal.find({ species: new RegExp(species, 'i') }).select('_id');
            filter.animalId = { $in: animals.map(a => a._id) };
        }
 
        const announcements = await Announcement.find(filter)
            .populate('animalId')
            .populate('publisherId', 'username email phoneNumber') // 'name' non esiste nel modello User
            .sort({ createdAt: -1 });
 
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

// GET /api/announcements/:id
exports.getAnnouncementById = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id)
            .populate('animalId')
            .populate('publisherId', 'username email phoneNumber');
 
        if (!announcement) {
            return res.status(404).json({ message: 'Annuncio non trovato' });
        }
 
        res.json(announcement);
    } catch (err) {
        res.status(500).json({ message: "Errore nel recupero dell'annuncio", error: err.message });
    }
};