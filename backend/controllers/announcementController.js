const Announcement = require('../models/Announcement');
const Animal = require('../models/Animal');

function normalizeCoordinates(input) {
  // accept array [a,b] or string 'a,b'
  let parts = null;
  if (Array.isArray(input)) parts = input.map(Number);
  else if (typeof input === 'string') parts = input.split(',').map(s => Number(s.trim()));
  else if (input && input.coordinates && Array.isArray(input.coordinates)) parts = input.coordinates.map(Number);
  else return null;

  if (parts.length !== 2 || parts.some(p => Number.isNaN(p))) return null;

  let [a, b] = parts;
  // Heuristic for Italy: lat ~ 35..47, lng ~ 6..18
  const aIsLat = a >= 35 && a <= 47;
  const bIsLat = b >= 35 && b <= 47;
  // if a looks like lat and b not, swap to [lng, lat]
  if (aIsLat && !bIsLat) return [b, a];
  if (!aIsLat && bIsLat) return [a, b];
  // otherwise try to detect by typical lng range (6..18)
  const aIsLng = a >= 6 && a <= 18;
  const bIsLng = b >= 6 && b <= 18;
  if (aIsLng && !bIsLng) return [a, b];
  if (!aIsLng && bIsLng) return [b, a];
  // fallback: assume provided order is [lng,lat]
  return [a, b];
}

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
      coordinates,   // [lng, lat] OR possibly [lat, lng]
      lastSeenDate, isCurrentlyThere, animalBehaviour, healthCondition
    } = req.body;

    const coords = normalizeCoordinates(coordinates);
    if (!coords) return res.status(400).json({ message: 'Coordinate non valide' });

    const announcement = new Announcement({
      type,
      publisherId: req.user.userId,  // viene dal middleware auth
      animalId,
      description,
      location: {
        type: 'Point',
        coordinates: coords   // GeoJSON vuole [longitudine, latitudine]
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
  const publisherIdStr = (ann.publisherId && ann.publisherId._id) ? ann.publisherId._id.toString() : ann.publisherId.toString();
  if (publisherIdStr !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });

    const allowed = ['description','lastSeenDate','isCurrentlyThere','animalBehaviour','healthCondition','status','type','location'];
    for (const k of allowed) {
      if (req.body[k] === undefined) continue;
      if (k === 'location') {
        // normalize coordinates if present
        const coords = normalizeCoordinates(req.body[k].coordinates || req.body[k]);
        if (!coords) return res.status(400).json({ message: 'Coordinate non valide' });
        ann.location = { type: 'Point', coordinates: coords };
      } else ann[k] = req.body[k];
    }

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
  const publisherIdStr = (ann.publisherId && ann.publisherId._id) ? ann.publisherId._id.toString() : ann.publisherId.toString();
  if (publisherIdStr !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });

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
    console.log('DELETE /api/announcements/:id called with id=', req.params.id, 'user=', req.user);
    const ann = await Announcement.findById(req.params.id);
    console.log('Announcement fetched:', !!ann);
    if (!ann) return res.status(404).json({ message: 'Annuncio non trovato' });
  const publisherIdStr = (ann.publisherId && ann.publisherId._id) ? ann.publisherId._id.toString() : ann.publisherId.toString();
  if (publisherIdStr !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });

  // use model-level delete to be compatible with Mongoose versions where document.remove() may not exist
  await Announcement.findByIdAndDelete(req.params.id);
  console.log('Announcement removed (by id):', req.params.id);
  res.json({ message: 'Annuncio eliminato' });
  } catch (err) {
    console.error('Errore in deleteAnnouncement:', err);
    res.status(500).json({ message: 'Errore eliminazione', error: err.message });
  }
};
