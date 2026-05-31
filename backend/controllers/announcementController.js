const Announcement = require('../models/Announcement');
const Animal = require('../models/Animal');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');


const smartMatchingEngine = require('../services/SmartMatchingEngine');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const mongoose = require('mongoose');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const { writeAuditLog } = require('../services/auditService');
const {
    sendAnnouncementCommentEmail,
    sendShelterAnnouncementEmail,
    sendSmartMatchEmail
} = require('../services/emailService');

/**
 * Applies publisher contact-visibility preferences to public publisher data.
 * @param {Object|null} publisher - Populated publisher data attached to an announcement.
 * @returns {Object|null} Publisher data with hidden email or phone fields set to null.
 */
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

/**
 * Builds the frontend URL for opening a specific announcement.
 * @param {string} announcementId - Announcement identifier to highlight in the frontend.
 * @returns {string} Absolute frontend URL for the announcement detail view.
 */
function buildAnnouncementUrl(announcementId) {
    return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/announcements.html?highlight=${announcementId}`;
}

/**
 * Builds the frontend URL for opening an animal inside a shelter page.
 * @param {string} shelterId - Shelter identifier used by the shelter page.
 * @param {string} animalId - Animal identifier to open inside the shelter page.
 * @returns {string} Absolute frontend URL for the shelter animal detail view.
 */
function buildShelterAnimalUrl(shelterId, animalId) {
    return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/rifugio.html?rifugioId=${shelterId}&animalId=${animalId}`;
}

/**
 * Creates notifications for users following a shelter and optionally emails them.
 * @param {Object} announcement - New shelter announcement used as notification context.
 * @param {Object} animal - Animal document referenced by the announcement.
 * @param {Object} shelter - Approved shelter user document that owns the announcement.
 * @returns {Promise<void>} Promise resolving after follower notifications and emails are attempted.
 */
async function notifyShelterFollowers(announcement, animal, shelter) {
    try {
        if (!shelter || shelter.role !== 'shelter' || shelter.rifugioStatus !== 'approved') return;

        const shelterId = shelter._id || announcement.publisherId;
        const animalId = animal?._id || announcement.animalId;
        if (!shelterId || !animalId) return;

        const followers = await User.find({
            role: 'user',
            isActive: true,
            'followedShelters.shelterId': shelterId
        }).select('username email followedShelters');

        if (!followers.length) return;

        const shelterName = shelter?.rifugioData?.rifugioName || shelter?.username || 'Il rifugio che segui';
        const animalLabel = animal?.name || animal?.species || 'un animale';
        const url = buildShelterAnimalUrl(shelterId, animalId);

        await Promise.all(followers.map(async (follower) => {
            const follow = (follower.followedShelters || []).find(item => String(item.shelterId) === String(shelterId));
            if (!follow) return;

            await Notification.create({
                userId: follower._id,
                type: 'shelter_announcement',
                announcementId: announcement._id,
                shelterId,
                animalId,
                message: `${shelterName} ha pubblicato un nuovo annuncio: ${animalLabel}`
            });

            if (follow.emailEnabled) {
                await sendShelterAnnouncementEmail(follower, shelter, animal, url);
            }
        }));
    } catch (err) {
        console.error('Errore notifiche follower rifugio:', err);
    }
}

/**
 * Normalizes coordinate input into GeoJSON longitude-latitude order.
 * @param {Array<number>|string|Object} input - Coordinate array, comma-separated string, JSON string, or GeoJSON-like object.
 * @returns {number[]|null} `[longitude, latitude]` coordinates, or null when parsing fails.
 */
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

/**
 * Normalizes an optional animal name while preserving undefined updates.
 * @param {*} value - Raw animal name submitted by the client.
 * @returns {string|null|undefined} Trimmed name, null for empty names, or undefined when no update was submitted.
 */
function normalizeOptionalName(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const text = typeof value === 'string' ? value.trim() : String(value).trim();
    return text || null;
}

/**
 * Capitalizes the first character of a string value.
 * @param {*} value - Value to display as a capitalized label.
 * @returns {string} Trimmed string with an uppercase first character, or an empty string.
 */
function capitalizeFirst(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Downloads a remote URL and resolves its response body as a buffer.
 * @param {string} url - HTTP or HTTPS URL to download.
 * @returns {Promise<Buffer>} Response body as a Buffer.
 * @throws {Error} When the request cannot be created or completed.
 */
async function fetchUrlBuffer(url) {
    return new Promise((resolve, reject) => {
        try {
            const lib = url.startsWith('https') ? https : http;
            lib.get(url, (res) => {
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', (err) => reject(err));
            }).on('error', (err) => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Stores smart-match notifications and sends related emails for matching announcements.
 * @param {Object} announcement - Announcement that triggered smart matching.
 * @param {Array<Object>} matches - Match results returned by the smart matching engine.
 * @returns {Promise<void>} Promise resolving after notifications and emails are attempted.
 */
async function saveMatchNotification(announcement, matches) {
    try {
        if (!matches || matches.length === 0) return;

        if (announcement.type === 'LostAnimal') {
            const bestMatch = matches[0];
            const bestSimilarity = ((bestMatch.score || 0) * 100).toFixed(2);
            const matchedAnnouncementId = bestMatch.announcement?._id;

            await Notification.create({
                userId: announcement.publisherId,
                announcementId: matchedAnnouncementId || announcement._id,
                message: `Trovati ${matches.length} possibili annunci compatibili con il tuo annuncio. Miglior similitudine: ${bestSimilarity}%`,
                type: 'SMART_MATCH'
            });

            if (matchedAnnouncementId) {
                await sendSmartMatchEmail(
                    announcement.publisherId,
                    'Trovami - Smart match trovato',
                    `
                        <h2>Smart match trovato</h2>
                        <p>Abbiamo trovato ${matches.length} possibile/i annuncio/i compatibile/i con il tuo annuncio.</p>
                        <p><strong>Miglior similitudine:</strong> ${bestSimilarity}%</p>
                        <p><a href="${buildAnnouncementUrl(matchedAnnouncementId)}">Apri l'annuncio compatibile</a></p>
                    `
                );
            }
            return;
        }

        for (const match of matches) {
            const recipientId = match.announcement?.publisherId?._id || match.announcement?.publisherId;
            if (!recipientId) continue;

            const similarityPercentage = ((match.score || 0) * 100).toFixed(2);
            await Notification.create({
                userId: recipientId,
                announcementId: announcement._id,
                message: `Il tuo annuncio ha trovato un possibile match visivo: ${similarityPercentage}% di similitudine.`,
                type: 'SMART_MATCH'
            });

            await sendSmartMatchEmail(
                recipientId,
                'Trovami - Nuovo smart match',
                `
                    <h2>Nuovo smart match</h2>
                    <p>Il tuo annuncio ha trovato un possibile match visivo con una similitudine del ${similarityPercentage}%.</p>
                    <p><a href="${buildAnnouncementUrl(announcement._id)}">Apri l'annuncio compatibile</a></p>
                `
            );
        }
    } catch (err) {
        console.error("Errore salvataggio notifica:", err);
    }
}

/**
 * Creates notifications for all active admin users.
 * @param {Object} payload - Notification fields to copy onto each admin notification.
 * @returns {Promise<void>} Promise resolving after all admin notifications are created.
 */
async function notifyAdmins(payload) {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    await Promise.all(admins.map(admin => Notification.create({
        userId: admin._id,
        ...payload
    })));
}

/**
 * Handles the get announcements API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getAnnouncements = async (req, res) => {
    try {
        const { type, species, status, rifugioId, userId } = req.query;
        const filter = {};
        if (status !== 'all') filter.status = status || 'ACTIVE';
        if (type) filter.type = type;
        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ message: 'ID utente non valido' });
            }
            filter.publisherId = userId;
        }
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

/**
 * Handles the get resolved announcements count API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getResolvedAnnouncementsCount = async (req, res) => {
    try {
        const resolvedCount = await Announcement.countDocuments({ status: 'RESOLVED' });
        res.json({ resolvedCount });
    } catch (err) {
        res.status(500).json({ message: 'Errore recupero conteggio annunci risolti', error: err.message });
    }
};


/**
 * Handles the add announcement comment API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
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
                const annUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/announcements.html?highlight=${ann._id}`;
                await sendAnnouncementCommentEmail(publisher, user.username, text, annUrl);
            }
        } catch (e) {
        }

        res.location(`${req.protocol}://${req.get('host')}${req.baseUrl}/${announcementId}/comments/${newComment._id}`).status(201).json({ comment: newComment, comments: ann.comments });
    } catch (err) {
        res.status(500).json({ message: 'Errore inserimento commento', error: err.message });
    }
};

/**
 * Handles the create announcement API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
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

        const publisher = await User.findById(req.user.userId).select('username role rifugioStatus rifugioData');
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
        await writeAuditLog({ actor: publisher, action: 'creato annuncio', target: null });

            try {
                if (announcement.photo && announcement._id) {
                    const base = req.protocol + '://' + req.get('host');
                    const photoUrl = `${base}/api/v1/announcements/${announcement._id}/photo`;
                    await Animal.findByIdAndUpdate(animal._id, { $set: { photos: [photoUrl] } });
                }
            } catch (err) {
                console.warn('Impossibile aggiornare foto animale:', err.message || err);
            }

        if (announcement.imageEmbedding && announcement.imageEmbedding.length > 0) {
            const matches = await smartMatchingEngine.findMatches(announcement, animal.species);
            if (matches.length > 0) {
                await saveMatchNotification(announcement, matches);
            }
        }

        await notifyShelterFollowers(announcement, animal, publisher);

            res.location(`${req.protocol}://${req.get('host')}${req.baseUrl}/${announcement._id}`).status(201).json(announcement);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Handles the create quick announcement API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
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

        const coords = normalizeCoordinates(coordinates || location);
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
        try {
            if (announcement.photo && announcement._id) {
                const base = req.protocol + '://' + req.get('host');
                const photoUrl = `${base}/api/v1/announcements/${announcement._id}/photo`;
                await Animal.findByIdAndUpdate(animal._id, { $set: { photos: [photoUrl] } });
            }
        } catch (err) {
            console.warn('Impossibile aggiornare foto animale (quick):', err.message || err);
        }
        await writeAuditLog({ actor: null, action: 'creato annuncio', target: null });
        res.location(`${req.protocol}://${req.get('host')}${req.baseUrl}/${announcement._id}`).status(201).json(announcement);
    } catch (err) {
        console.error('Errore creazione annuncio veloce:', err);
        res.status(500).json({ message: 'Errore creazione annuncio veloce', error: err.message });
    }
};

/**
 * Handles the report announcement API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
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
        await writeAuditLog({
            actor: req.user.userId,
            action: 'segnalato annuncio',
            target: announcement.publisherId || null
        });

        res.location(`${req.protocol}://${req.get('host')}${req.baseUrl}/${announcementId}/reports/${report._id}`).status(201).json({ message: 'Segnalazione inviata', report });
    } catch (err) {
        res.status(500).json({ message: 'Errore invio segnalazione', error: err.message });
    }
};

	/**
	 * Handles the get announcement by id API request and writes the HTTP response.
	 * @param {Object} req - Express request object.
	 * @param {Object} res - Express response object.
	 * @returns {Promise<void>} Promise resolving when the operation completes.
	 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
	 */
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

/**
 * Handles the get announcement photo API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
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

/**
 * Handles the generate flyer API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.generateFlyer = async (req, res) => {
    try {
        const announcementId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(announcementId)) {
            return res.status(400).json({ message: 'ID annuncio non valido' });
        }

        const announcement = await Announcement.findById(announcementId).populate('animalId').populate('publisherId');
        if (!announcement) return res.status(404).json({ message: 'Annuncio non trovato' });

        const publisherId = (announcement.publisherId && announcement.publisherId._id) ? announcement.publisherId._id.toString() : (announcement.publisherId ? announcement.publisherId.toString() : null);
        if (!publisherId || publisherId !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="volantino-${announcement._id}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.pipe(res);

        try {
            const bgPath = path.join(__dirname, '../assests/sfondo volantino.png');
            if (fs.existsSync(bgPath)) {
                doc.image(bgPath, 0, 0, { width: 595, height: 842 });
            }
        } catch (err) {
            console.warn('Errore caricamento sfondo:', err);
        }

        doc.opacity(0.75);
        doc.fillColor('#ffffff').rect(0, 0, 595, 842).fill();
        doc.opacity(1);

        const animal = announcement.animalId || {};
        const species = (animal.species || '').toLowerCase();
        const breed = (animal.breed || '').toLowerCase();
        const color = (animal.color || '').toLowerCase();
        const animalName = capitalizeFirst(animal.name);

       
        doc.fontSize(44).fillColor('#b42318').font('Helvetica-Bold').text('SMARRITO', { align: 'center' });
        doc.moveDown(0.8);

        if (announcement.photo && announcement.photo.data) {
            try {
                const imageTop = doc.y;
                const imgWidth = 450;
                const imgHeight = 260;
                const imgX = 75;
                const imgY = imageTop;
                const borderRadius = 15;
                
                
                
                doc.image(announcement.photo.data, imgX + 2, imgY + 2, { fit: [imgWidth - 4, imgHeight - 4], align: 'center', valign: 'center' });
                doc.y = imageTop + imgHeight + 18;
            } catch (err) {
                console.warn('Errore embed immagine:', err);
            }
        } else {
            doc.moveDown(0.5);
        }

        const descriptionParts = [];
        if (species) descriptionParts.push(species);
        if (breed) descriptionParts.push(`(${breed})`);
        if (color) descriptionParts.push(color);
        const descriptionLine = descriptionParts.join(' ');

        doc.fontSize(20).fillColor('#111827').font('Helvetica-Bold').text(`Smarrito ${descriptionLine}${animalName ? ` che risponde al nome di ${animalName}` : ''}.`, { align: 'center' });
        doc.moveDown(1);
 
        const when = announcement.date ? new Date(announcement.date).toLocaleString('it-IT') : (announcement.lastSeenDate ? new Date(announcement.lastSeenDate).toLocaleString('it-IT') : 'Non disponibile');

        doc.fontSize(13).fillColor('#111827').font('Helvetica').text(`Data: ${when}`, { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(14).fillColor('#111827').font('Helvetica-Bold').text('Descrizione:', { align: 'center' });
        doc.font('Helvetica').fontSize(12).text(announcement.description || 'Nessuna descrizione', { align: 'center' });
        doc.moveDown(0.8);

        const publisher = announcement.publisherId || {};
        doc.fontSize(14).fillColor('#111827').font('Helvetica-Bold').text('In caso di ritrovamento contattare:', { align: 'center' });
        doc.font('Helvetica').fontSize(13);
        if (publisher.rifugioData && publisher.rifugioData.rifugioName) {
            doc.text(`${publisher.rifugioData.rifugioName}`, { align: 'center' });
        } else if (publisher.username) {
            doc.text(`${publisher.username}`, { align: 'center' });
        }
        if (publisher.email) doc.text(`Mail: ${publisher.email}`, { align: 'center' });
        if (publisher.phoneNumber) doc.text(`Numero: ${publisher.phoneNumber}`, { align: 'center' });

        try {
            const announcementUrl = buildAnnouncementUrl(announcement._id);
            const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(announcementUrl)}`;
            const qrBuf = await fetchUrlBuffer(qrApi);
            const qrSize = 100;

            const captionFontSize = 11;
            const genFontSize = 10;
            const gap = 6;
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;
            const leftMargin = doc.page.margins.left;
            const rightMargin = doc.page.margins.right;
            const bottom = pageHeight - doc.page.margins.bottom;

            const captionHeight = captionFontSize + 2;
            const genHeight = genFontSize + 2;
            const totalHeight = captionHeight + gap + qrSize + gap + genHeight;
            const topY = bottom - totalHeight;

            doc.fontSize(captionFontSize).font('Helvetica-Bold').fillColor('#111827');
            doc.text("Scansiona per vedere l'annuncio completo", leftMargin, topY, { width: pageWidth - leftMargin - rightMargin, align: 'center' });

            const qrX = (pageWidth - qrSize) / 2;
            const qrY = topY + captionHeight + gap;
            doc.image(qrBuf, qrX, qrY, { width: qrSize });

            const genY = qrY + qrSize + gap;
            doc.fontSize(genFontSize).fillColor('gray').font('Helvetica');
            doc.text('Generato da Trovami', leftMargin, genY, { width: pageWidth - leftMargin - rightMargin, align: 'center' });
        } catch (err) {
            console.warn('Errore generazione QR:', err);
        }

        await writeAuditLog({ actor: req.user.userId, action: 'generato volantino', target: announcement._id });

        doc.end();
    } catch (err) {
        console.error('Errore generazione volantino:', err);
        if (!res.headersSent) res.status(500).json({ message: 'Errore generazione volantino', error: err.message });
    }
};

/**
 * Handles the get similar announcements API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getSimilarAnnouncements = async (req, res) => {
    try {
        const announcementId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(announcementId)) {
            return res.status(400).json({ message: 'ID annuncio non valido' });
        }

        const base = await Announcement.findById(announcementId)
            .select('type imageEmbedding animalId status')
            .populate('animalId', 'species');

        if (!base) return res.status(404).json({ message: 'Annuncio non trovato' });

        if (!Array.isArray(base.imageEmbedding) || base.imageEmbedding.length === 0) {
            return res.json({ matches: [] });
        }

        const animalSpecies = base.animalId?.species;
        if (!animalSpecies) return res.json({ matches: [] });

        const limit = Math.min(parseInt(req.query.limit, 10) || 6, 20);
        const matches = await smartMatchingEngine.findMatches(base, animalSpecies);

        const payload = matches.slice(0, limit).map((match) => {
            const annObj = match.announcement?.toObject ? match.announcement.toObject() : match.announcement;
            if (annObj?.publisherId) annObj.publisherId = maskPublisherContacts(annObj.publisherId);
            return {
                announcement: annObj,
                score: match.score
            };
        });

        res.json({ matches: payload });
    } catch (err) {
        res.status(500).json({ message: 'Errore recupero smart match', error: err.message });
    }
};

/**
 * Handles the update announcement API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
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
        let embeddingRegenerated = false;
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
                
                const embedding = await smartMatchingEngine.generateImageEmbedding(processed);
                if (embedding) {
                    ann.imageEmbedding = embedding;
                    embeddingRegenerated = true;
                }
            } catch (err) {
                ann.photo = { data: req.file.buffer, contentType: req.file.mimetype };
                const embedding = await smartMatchingEngine.generateImageEmbedding(req.file.buffer);
                if (embedding) {
                    ann.imageEmbedding = embedding;
                    embeddingRegenerated = true;
                }
            }
        }

        await ann.save();
        await writeAuditLog({ actor: req.user.userId, action: 'modificato annuncio', target: null });

        try {
            if (ann.photo && ann._id) {
                const base = req.protocol + '://' + req.get('host');
                const photoUrl = `${base}/api/v1/announcements/${ann._id}/photo`;
                await Animal.findByIdAndUpdate(ann.animalId, { $set: { photos: [photoUrl] } });
            }
        } catch (err) {
            console.warn('Impossibile aggiornare foto animale:', err.message || err);
        }

        if (embeddingRegenerated && ann.imageEmbedding && ann.imageEmbedding.length > 0) {
            const matches = await smartMatchingEngine.findMatches(ann, animal.species);
            if (matches.length > 0) {
                await saveMatchNotification(ann, matches);
            }
        }

        res.json(ann);
    } catch (err) {
        res.status(500).json({ message: 'Errore aggiornamento', error: err.message });
    }
};

/**
 * Handles the change status API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.changeStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ message: 'Status mancante' });
        if (!['ACTIVE', 'RESOLVED', 'ARCHIVED'].includes(status)) {
            return res.status(400).json({ message: 'Status non valido' });
        }
        const ann = await Announcement.findById(req.params.id);
        if (!ann) return res.status(404).json({ message: 'Annuncio non trovato' });
        
        const publisherIdStr = (ann.publisherId && ann.publisherId._id) ? ann.publisherId._id.toString() : (ann.publisherId ? ann.publisherId.toString() : null);
        const isOwner = publisherIdStr && publisherIdStr === req.user.userId;
        const isAdmin = req.user?.role === 'admin';
        if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Non autorizzato' });

        ann.status = status;
        await ann.save();
        await writeAuditLog({ actor: req.user.userId, action: 'modificato annuncio', target: null });
        res.json(ann);
    } catch (err) {
        res.status(500).json({ message: 'Errore cambio status', error: err.message });
    }
};

/**
 * Deletes an announcement and its linked animal record as one cascade operation.
 * @param {string} announcementId - Announcement identifier to remove with its animal.
 * @returns {Promise<boolean>} True when an announcement was found and deleted, otherwise false.
 */
async function removeAnnouncementCascade(announcementId) {
    const announcement = await Announcement.findById(announcementId).populate('animalId');
    if (!announcement) return false;
    const animalId = announcement.animalId?._id || announcement.animalId;
    if (animalId) await Animal.findByIdAndDelete(animalId);
    await Announcement.findByIdAndDelete(announcementId);
    return true;
}

exports.removeAnnouncementCascade = removeAnnouncementCascade;

/**
 * Handles the delete announcement API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.deleteAnnouncement = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) return res.status(404).json({ message: 'Annuncio non trovato' });
        if (!announcement.publisherId || announcement.publisherId.toString() !== req.user.userId) return res.status(403).json({ message: 'Non autorizzato' });
        await removeAnnouncementCascade(req.params.id);
        await writeAuditLog({ actor: req.user.userId, action: 'eliminato annuncio', target: null });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
