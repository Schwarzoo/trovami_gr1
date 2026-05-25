const Announcement = require('../models/Announcement');
const Animal = require('../models/Animal');
const Notification = require('../models/Notification'); // Import necessario
const mongoose = require('mongoose');
const sharp = require('sharp');
const smartMatchingEngine = require('../services/SmartMatchingEngine');

function normalizeCoordinates(input) {
    let parts = null;
    if (Array.isArray(input)) parts = input.map(Number);
    else if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try { return normalizeCoordinates(JSON.parse(trimmed)); } catch (err) { return null; }
        }
        parts = trimmed.split(',').map(s => Number(s.trim()));
    }
    else if (input && input.coordinates && Array.isArray(input.coordinates)) parts = input.coordinates.map(Number);
    else return null;

    if (parts.length !== 2 || parts.some(p => Number.isNaN(p))) return null;

    let [a, b] = parts;
    const aIsLat = a >= 35 && a <= 47;
    const bIsLat = b >= 35 && b <= 47;
    if (aIsLat && !bIsLat) return [b, a];
    if (!aIsLat && bIsLat) return [a, b];
    const aIsLng = a >= 6 && a <= 18;
    const bIsLng = b >= 6 && b <= 18;
    if (aIsLng && !bIsLng) return [a, b];
    if (!aIsLng && bIsLng) return [b, a];
    return [a, b];
}

// Helper interno per gestire il salvataggio dei match
async function saveMatchNotification(announcement, matches) {
    try {
        for (const match of matches) {
            const similarityPercentage = ((match.score || 0) * 100).toFixed(2);
            await Notification.create({
                announcementId: announcement._id,
                recipientId: announcement.publisherId,
                message: `Trovato un possibile match visivo per il tuo annuncio: ${similarityPercentage}% di similitudine!`,
                type: 'SMART_MATCH'
            });
        }
    } catch (err) {
        console.error("Errore salvataggio notifica:", err);
    }
}

exports.getAnnouncements = async (req, res) => {
    try {
        const { type, species, status } = req.query;
        const filter = {};
        filter.status = status || 'ACTIVE';
        if (type) filter.type = type;

        if (species) {
            const animals = await Animal.find({ species: new RegExp(species, 'i') }).select('_id');
            filter.animalId = { $in: animals.map(a => a._id) };
        }

        const announcements = await Announcement.find(filter)
            .select('-photo')
            .populate('animalId')
            .populate('publisherId', 'username email phoneNumber')
            .sort({ createdAt: -1 });

        res.json(announcements);
    } catch (err) {
        res.status(500).json({ message: 'Errore nel recupero degli annunci', error: err.message });
    }
};

exports.createAnnouncement = async (req, res) => {
    try {
        const { type, animalId, description, coordinates, location, lastSeenDate, isCurrentlyThere, animalBehaviour, healthCondition } = req.body;
        const isCurrentlyThereBool = (typeof isCurrentlyThere === 'string') ? (isCurrentlyThere === 'true') : !!isCurrentlyThere;

        const animal = await Animal.findById(animalId);
        if (!animal) return res.status(404).json({ message: 'Animale non trovato' });

        const coords = normalizeCoordinates(coordinates || location);
        if (!coords) return res.status(400).json({ message: 'Coordinate non valide' });

        const announcement = new Announcement({
            type,
            publisherId: req.user.userId,
            animalId: animal._id,
            description: description || 'Nessuna descrizione',
            location: { type: 'Point', coordinates: coords },
            lastSeenDate,
            isCurrentlyThere: isCurrentlyThereBool,
            animalBehaviour,
            healthCondition,
            status: 'ACTIVE'
        });

        if (req.file && req.file.buffer) {
            try {
                const processed = await sharp(req.file.buffer)
                    .resize({ width: 1024, height: 1024, fit: 'inside' })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                announcement.photo = { data: processed, contentType: 'image/jpeg' };
                const embedding = await smartMatchingEngine.generateImageEmbedding(processed);
                if (embedding) announcement.imageEmbedding = embedding;
            } catch (err) {
                announcement.photo = { data: req.file.buffer, contentType: req.file.mimetype };
                const embedding = await smartMatchingEngine.generateImageEmbedding(req.file.buffer);
                if (embedding) announcement.imageEmbedding = embedding;
            }
        }

        await announcement.save();

        if (announcement.imageEmbedding && announcement.imageEmbedding.length > 0) {
            smartMatchingEngine.findMatches(announcement, animal.species)
                .then(matches => {
                    if (matches.length > 0) saveMatchNotification(announcement, matches);
                })
                .catch(err => console.error("[Smart Matching] Errore:", err));
        }

        res.status(201).json(announcement);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getAnnouncementById = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id)
            .select('-photo')
            .populate('animalId')
            .populate('publisherId', 'username email phoneNumber');
        if (!announcement) return res.status(404).json({ message: 'Annuncio non trovato' });
        res.json(announcement);
    } catch (err) {
        res.status(500).json({ message: "Errore nel recupero", error: err.message });
    }
};

exports.getAnnouncementPhoto = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id).select('photo');
        if (!announcement || !announcement.photo || !announcement.photo.data) return res.status(404).json({ message: 'Foto non trovata' });
        res.contentType(announcement.photo.contentType || 'image/jpeg');
        res.send(announcement.photo.data);
    } catch (err) {
        res.status(500).json({ message: 'Errore recupero foto', error: err.message });
    }
};

exports.updateAnnouncement = async (req, res) => {
    try {
        const ann = await Announcement.findById(req.params.id);
        if (!ann) return res.status(404).json({ message: 'Annuncio non trovato' });
        
        const publisherIdStr = (ann.publisherId && ann.publisherId._id) ? ann.publisherId._id.toString() : ann.publisherId.toString();
        if (publisherIdStr !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });

        const allowed = ['description', 'lastSeenDate', 'isCurrentlyThere', 'animalBehaviour', 'healthCondition', 'status', 'type', 'location'];
        for (const k of allowed) {
            if (req.body[k] === undefined) continue;
            if (k === 'location') {
                const coords = normalizeCoordinates(req.body[k].coordinates || req.body[k]);
                if (!coords) return res.status(400).json({ message: 'Coordinate non valide' });
                ann.location = { type: 'Point', coordinates: coords };
            } else if (k === 'description') {
                ann.description = req.body[k] || 'Nessuna descrizione';
            } else ann[k] = req.body[k];

            if (k === 'isCurrentlyThere') {
                ann.isCurrentlyThere = (typeof req.body[k] === 'string') ? (req.body[k] === 'true') : !!req.body[k];
            }
        }

        if (req.file && req.file.buffer) {
            try {
                const processed = await sharp(req.file.buffer)
                    .resize({ width: 1024, height: 1024, fit: 'inside' })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                ann.photo = { data: processed, contentType: 'image/jpeg' };
                
                // Rigeneriamo embedding se la foto cambia
                const embedding = await smartMatchingEngine.generateImageEmbedding(processed);
                if (embedding) ann.imageEmbedding = embedding;
            } catch (err) {
                ann.photo = { data: req.file.buffer, contentType: req.file.mimetype };
                const embedding = await smartMatchingEngine.generateImageEmbedding(req.file.buffer);
                if (embedding) ann.imageEmbedding = embedding;
            }
        }

        await ann.save();
        res.json(ann);
    } catch (err) {
        res.status(500).json({ message: 'Errore aggiornamento', error: err.message });
    }
};

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

async function removeAnnouncementCascade(announcementId) {
    const announcement = await Announcement.findById(announcementId).populate('animalId');
    if (!announcement) return false;
    const animalId = announcement.animalId?._id || announcement.animalId;
    if (animalId) await Animal.findByIdAndDelete(animalId);
    await Announcement.findByIdAndDelete(announcementId);
    return true;
}

exports.removeAnnouncementCascade = removeAnnouncementCascade;

exports.deleteAnnouncement = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) return res.status(404).json({ message: 'Annuncio non trovato' });
        if (announcement.publisherId.toString() !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });
        await removeAnnouncementCascade(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};