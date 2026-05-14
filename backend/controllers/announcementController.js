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
      publisherId: req.user.userId,  // viene dal middleware auth
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

// PUT /api/announcements/:id  (update announcement) - auth, only publisher
exports.updateAnnouncement = async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ message: 'Annuncio non trovato' });
    if (ann.publisherId.toString() !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });

    const allowed = ['description','lastSeenDate','isCurrentlyThere','animalBehaviour','healthCondition','status','type','location'];
    allowed.forEach(k => { if (req.body[k] !== undefined) ann[k] = req.body[k]; });

    await ann.save();
    res.json(ann);
  } catch (err) {
    res.status(500).json({ message: 'Errore aggiornamento', error: err.message });
  }
};

// PATCH /api/announcements/:id/status  - set status (e.g. RESOLVED)
exports.changeStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'Status mancante' });

    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ message: 'Annuncio non trovato' });
    if (ann.publisherId.toString() !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });

    ann.status = status;
    await ann.save();
    res.json(ann);
  } catch (err) {
    res.status(500).json({ message: 'Errore cambio status', error: err.message });
  }
};

// DELETE /api/announcements/:id
exports.deleteAnnouncement = async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ message: 'Annuncio non trovato' });
    if (ann.publisherId.toString() !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });

    await ann.remove();
    res.json({ message: 'Annuncio eliminato' });
  } catch (err) {
    res.status(500).json({ message: 'Errore eliminazione', error: err.message });
  }
};
