const Announcement = require('../models/Announcement');
const Animal = require('../models/Animal');



const smartMatchingEngine = require('../services/SmartMatchingEngine');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const mongoose = require('mongoose');
const sharp = require('sharp');
const nodemailer = require('nodemailer');

function maskPublisherContacts(publisher) {
    if (!publisher) return publisher;
    const vis = publisher.contactVisibility || {};
    const showEmail = vis.showEmail !== false;
    const showPhone = vis.showPhone !== false;
    return {
        ...publisher,
        email: showEmail ? publisher.email : null,
        phoneNumber: showPhone ? publisher.phoneNumber : null
    };
}

function createTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

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

function normalizeOptionalName(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const text = typeof value === 'string' ? value.trim() : String(value).trim();
    return text || null;
}

// Helper interno per gestire il salvataggio dei match
async function saveMatchNotification(announcement, matches) {
    try {
        for (const match of matches) {
            const similarityPercentage = ((match.score || 0) * 100).toFixed(2);
            await Notification.create({
                announcementId: announcement._id,
                userId: announcement.publisherId,
                message: `Trovato un possibile match visivo per il tuo annuncio: ${similarityPercentage}% di similitudine!`,
                type: 'SMART_MATCH'
            });
        }
    } catch (err) {
        console.error("Errore salvataggio notifica:", err);
    }
}

async function notifyAdmins(payload) {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    await Promise.all(admins.map(admin => Notification.create({
        userId: admin._id,
        ...payload
    })));
}

exports.getAnnouncements = async (req, res) => {
    try {
        const { type, species, status, rifugioId } = req.query;
        const filter = {};
        filter.status = status || 'ACTIVE';
        if (type) filter.type = type;
        if (rifugioId) {
            if (!mongoose.Types.ObjectId.isValid(rifugioId)) {
                return res.status(400).json({ message: 'ID rifugio non valido' });
            }
            filter.publisherId = rifugioId;
        }

        if (species) {
            const animals = await Animal.find({ species: new RegExp(species, 'i') }).select('_id');
            filter.animalId = { $in: animals.map(a => a._id) };
        }

        const announcements = await Announcement.find(filter)
            .select('-photo -comments')
            .populate('animalId')
            .populate('publisherId', 'username email phoneNumber contactVisibility role rifugioStatus rifugioData shelterData') // 'name' non esiste nel modello User
            .sort({ createdAt: -1 });

        const masked = announcements.map(a => {
            const obj = a.toObject ? a.toObject() : a;
            if (obj.publisherId) obj.publisherId = maskPublisherContacts(obj.publisherId);
            return obj;
        });

        res.json(masked);
    } catch (err) {
        res.status(500).json({ message: 'Errore nel recupero degli annunci', error: err.message });
    }
};


// POST /api/announcements/:id/comments  (auth) - add comment
exports.addAnnouncementComment = async (req, res) => {
    try {
        const announcementId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(announcementId)) {
            return res.status(400).json({ message: 'ID annuncio non valido' });
        }

        const text = (req.body?.text ?? '').toString().trim();
        if (!text) return res.status(400).json({ message: 'Testo mancante' });
        if (text.length > 500) return res.status(400).json({ message: 'Testo troppo lungo (max 500)' });

        const user = await User.findById(req.user.userId).select('username');
        if (!user) return res.status(401).json({ message: 'Utente non valido' });

        const ann = await Announcement.findById(announcementId);
        if (!ann) return res.status(404).json({ message: 'Annuncio non trovato' });

        ann.comments.push({
            userId: user._id,
            username: user.username,
            text
        });

        await ann.save();

        const newComment = ann.comments[ann.comments.length - 1];

        // notification for announcement owner (skip self-comments)
        try {
            const publisherId = (ann.publisherId && ann.publisherId._id) ? ann.publisherId._id : ann.publisherId;
            if (publisherId && publisherId.toString() !== user._id.toString()) {
                const msg = `Nuovo commento su annuncio: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`;
                await Notification.create({
                    userId: publisherId,
                    type: 'comment',
                    announcementId: ann._id,
                    commentId: newComment?._id || null,
                    message: msg
                });

                const publisher = await User.findById(publisherId).select('email username notificationPrefs');
                const emailOn = !!publisher?.notificationPrefs?.emailOnComment;
                const canSend = emailOn && publisher?.email && process.env.SMTP_USER && process.env.SMTP_PASS;
                if (canSend) {
                    const transporter = createTransporter();
                    const annUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/announcements.html?highlight=${ann._id}`;
                    await transporter.sendMail({
                        from: process.env.SMTP_FROM || process.env.SMTP_USER,
                        to: publisher.email,
                        subject: 'Trovami - Nuovo commento',
                        html: `
                            <h2>Nuovo commento su un tuo annuncio</h2>
                            <p><strong>${user.username}</strong>: ${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
                            <p><a href="${annUrl}">Vedi annuncio</a></p>
                        `
                    });
                }
            }
        } catch (e) {
            // best-effort
        }

        res.status(201).json({ comment: newComment, comments: ann.comments });
    } catch (err) {
        res.status(500).json({ message: 'Errore inserimento commento', error: err.message });
    }
};

// POST /api/announcements
exports.createAnnouncement = async (req,res)=>{
        
    try {
        const { type, animalId, description, coordinates, location, lastSeenDate, isCurrentlyThere, animalBehaviour, healthCondition } = req.body;
        const isCurrentlyThereBool = (typeof isCurrentlyThere === 'string') ? (isCurrentlyThere === 'true') : !!isCurrentlyThere;

        const animal = await Animal.findById(animalId);
        if (!animal) return res.status(404).json({ message: 'Animale non trovato' });

        const incomingName = normalizeOptionalName(req.body.name ?? req.body.animalName);
        if (incomingName !== undefined) {
            animal.name = incomingName;
            await animal.save();
        }

        const publisher = await User.findById(req.user.userId).select('role rifugioStatus rifugioData.location');
        if (!publisher) return res.status(401).json({ message: 'Utente non valido' });
        if (publisher.role === 'shelter' && publisher.rifugioStatus !== 'approved') {
            return res.status(403).json({ message: 'Il rifugio deve essere approvato da un admin prima di pubblicare annunci' });
        }
        if (publisher.role === 'shelter') {
            animal.shelterId = publisher._id;
            await animal.save();
        }

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

// POST /api/announcements/quick
exports.createQuickAnnouncement = async (req, res) => {
    try {
        const {
            name,
            type,
            species,
            breed,
            gender,
            color,
            lunghezzaPelo,
            distinctiveFeatures,
            description,
            coordinates,
            location,
            lastSeenDate,
            isCurrentlyThere,
            animalBehaviour,
            healthCondition,
            contactName,
            contactEmail,
            contactPhone
        } = req.body;

        if (!species || !color) {
            return res.status(400).json({ message: 'Specie e colore sono obbligatori' });
        }

        const fallbackRifugioLocation = publisher.role === 'shelter' ? publisher.rifugioData?.location : null;
        const coords = normalizeCoordinates(coordinates || location || fallbackRifugioLocation);
        if (!coords) return res.status(400).json({ message: 'Coordinate non valide' });

        const animal = await Animal.create({
            name: normalizeOptionalName(name),
            species,
            breed: breed || 'Non specificato',
            gender: gender || 'Sconosciuto',
            color,
            lunghezzaPelo: lunghezzaPelo || undefined,
            distinctiveFeatures: distinctiveFeatures || ''
        });

        const announcement = new Announcement({
            type: type || 'Sighting',
            publisherId: null,
            animalId: animal._id,
            description: description || 'Segnalazione veloce',
            isQuick: true,
            quickContact: {
                name: contactName || null,
                email: contactEmail || null,
                phoneNumber: contactPhone || null
            },
            location: { type: 'Point', coordinates: coords },
            lastSeenDate,
            isCurrentlyThere: (typeof isCurrentlyThere === 'string') ? (isCurrentlyThere === 'true') : !!isCurrentlyThere,
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
            }
        }

        await announcement.save();
        res.status(201).json(announcement);
    } catch (err) {
        res.status(500).json({ message: 'Errore creazione annuncio veloce', error: err.message });
    }
};

// POST /api/announcements/:id/reports
exports.reportAnnouncement = async (req, res) => {
    try {
        const announcementId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(announcementId)) {
            return res.status(400).json({ message: 'ID annuncio non valido' });
        }

        const { reason, details } = req.body;
        const allowedReasons = ['troll', 'offensivo', 'falso', 'altro'];
        if (!allowedReasons.includes(reason)) {
            return res.status(400).json({ message: 'Motivo segnalazione non valido' });
        }

        const announcement = await Announcement.findById(announcementId).populate('publisherId', 'username role rifugioData');
        if (!announcement) return res.status(404).json({ message: 'Annuncio non trovato' });

        const report = await Report.create({
            announcementId,
            reporterId: req.user.userId,
            reason,
            details: details || ''
        });

        const ownerLabel = announcement.publisherId
            ? (announcement.publisherId.rifugioData?.rifugioName || announcement.publisherId.username)
            : 'annuncio veloce anonimo';

        await notifyAdmins({
            type: 'report',
            announcementId: announcement._id,
            reportId: report._id,
            targetUserId: announcement.publisherId?._id || null,
            message: `Nuova segnalazione (${reason}) su ${ownerLabel}`
        });

        res.status(201).json({ message: 'Segnalazione inviata', report });
    } catch (err) {
        res.status(500).json({ message: 'Errore invio segnalazione', error: err.message });
    }
};

// GET /api/announcements/:id
	exports.getAnnouncementById = async (req, res) => {
	    try {
	        const announcement = await Announcement.findById(req.params.id)
	            .select('-photo')
	            .populate('animalId')
	            .populate('publisherId', 'username email phoneNumber contactVisibility role rifugioStatus rifugioData shelterData');

        if (!announcement) {
            return res.status(404).json({ message: 'Annuncio non trovato' });
        }

	        const obj = announcement.toObject();
	        if (obj.publisherId) obj.publisherId = maskPublisherContacts(obj.publisherId);
	        res.json(obj);
	    } catch (err) {
	        res.status(500).json({ message: "Errore nel recupero dell'annuncio", error: err.message });
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
        
        if (!ann.publisherId) return res.status(403).json({ message: 'Non autorizzato' });
        const publisherIdStr = (ann.publisherId && ann.publisherId._id) ? ann.publisherId._id.toString() : ann.publisherId.toString();
        if (publisherIdStr !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });

        const animal = await Animal.findById(ann.animalId);
        if (!animal) return res.status(404).json({ message: 'Animale non trovato' });

        const incomingName = normalizeOptionalName(req.body.name ?? req.body.animalName);
        if (incomingName !== undefined) {
            animal.name = incomingName;
            await animal.save();
        }

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
        
        if (!ann.publisherId) return res.status(403).json({ message: 'Non autorizzato' });
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
        if (!announcement.publisherId || announcement.publisherId.toString() !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });
        await removeAnnouncementCascade(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
