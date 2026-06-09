const Animal = require('../models/Animal');
const mongoose = require('mongoose');
const { sendError } = require('../utils/errorResponse');

/**
 * Returns the API path for the animal photo endpoint.
 * @param {string|mongoose.Types.ObjectId} animalId - Animal identifier.
 * @returns {string} Relative URL path that serves the animal photo.
 */
function buildAnimalPhotoUrl(animalId) {
  return `/api/v1/animals/${animalId}/photo`;
}

/**
 * Stores an uploaded photo buffer inside an animal document.
 * @param {Object} animal - Animal mongoose document to update.
 * @param {Express.Multer.File|undefined} file - Uploaded image file.
 * @returns {boolean} True when a photo was stored.
 */
function applyUploadedAnimalPhoto(animal, file) {
  if (!file?.buffer) return false;
  animal.photo = {
    data: file.buffer,
    contentType: file.mimetype || 'image/jpeg'
  };
  animal.photos = [];
  return true;
}

/**
 * Converts an animal document to a JSON-safe response without binary photo data.
 * @param {Object} req - Express request object.
 * @param {Object} animal - Animal mongoose document or plain object.
 * @returns {Object} Animal response payload with photo URLs.
 */
function toAnimalResponse(req, animal) {
  const obj = animal?.toObject ? animal.toObject() : { ...animal };
  const hasDbPhoto = !!(obj.photo?.data || obj.photo?.contentType);
  delete obj.photo;
  if (hasDbPhoto && obj._id) {
    obj.photos = [buildAnimalPhotoUrl(obj._id)];
  }
  return obj;
}

/**
 * Handles the create animal API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
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
        age,
        microchipId,
        shelterId,
        adoptable
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
      age: typeof age === 'string' ? age.trim() : age,
      microchipId,
      shelterId: shelterId || (req.user && req.user.userId) || null,
      adoptable: req.user?.role === 'shelter' ? !!adoptable : false
    });

    applyUploadedAnimalPhoto(animal, req.file);
    await animal.save();

    res.location(`${req.protocol}://${req.get('host')}${req.baseUrl}/${animal._id}`).status(201).json(toAnimalResponse(req, animal));
  } catch (err) {
    sendError(res, 400, err.message, 'Errore nella creazione', 'ANIMAL_CREATE_ERROR');
  }
};

/**
 * Handles the update animal API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.updateAnimal = async (req, res) => {
  try {
    const updates = {};

    const incomingName = req.body.name ?? req.body.animalName;
    if (incomingName !== undefined) {
      updates.name = typeof incomingName === 'string' ? incomingName.trim() : incomingName;
    }

    const allowed = ['species','breed','gender','color','lunghezzaPelo','distinctiveFeatures','age','microchipId','shelterId','otherInfo'];
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (req.body.adoptable !== undefined && req.user?.role === 'shelter') {
      updates.adoptable = !!req.body.adoptable;
    }
    if (req.body.dateArrived !== undefined) {
      updates.dateArrived = req.body.dateArrived ? new Date(req.body.dateArrived) : null;
    }

    const animal = await Animal.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!animal) return res.status(404).json({ message: 'Animal non trovato' });

    if (applyUploadedAnimalPhoto(animal, req.file)) {
      await animal.save();
    }

    if (req.body.medicalNote) {
      const noteText = String(req.body.medicalNote).trim();
      if (noteText) {
        animal.medicalNotes = animal.medicalNotes || [];
        animal.medicalNotes.push({ text: noteText });
        await animal.save();
      }
    }

    res.json(toAnimalResponse(req, animal));
  } catch (err) {
    sendError(res, 400, err.message, 'Errore aggiornamento animal', 'ANIMAL_UPDATE_ERROR');
  }
};

/**
 * Handles the get animal by id API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getAnimalById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'ID animale non valido' });
    const animal = await Animal.findById(id).select('-imageEmbedding -__v -photo.data');
    if (!animal) return res.status(404).json({ message: 'Animal non trovato' });
    res.json(toAnimalResponse(req, animal));
  } catch (err) {
    sendError(res, 500, err.message, 'Errore recupero animal', 'ANIMAL_FETCH_ERROR');
  }
};

/**
 * Handles the get animal photo API request and streams binary image content.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the image response is sent.
 */
exports.getAnimalPhoto = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'ID animale non valido' });
    const animal = await Animal.findById(id).select('+photo.data photo.contentType');
    if (!animal?.photo?.data) return res.status(404).json({ message: 'Foto animale non trovata' });
    res.contentType(animal.photo.contentType || 'image/jpeg');
    res.send(animal.photo.data);
  } catch (err) {
    sendError(res, 500, err.message, 'Errore recupero foto animal', 'ANIMAL_PHOTO_FETCH_ERROR');
  }
};

/**
 * Handles the delete animal API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.deleteAnimal = async (req, res) => {
  try {
    const animalId = req.params.id;

    if (!mongoose.isValidObjectId(animalId)) {
      return res.status(400).json({ message: "ID animale non valido" });
    }

    const animal = await Animal.findById(animalId).select('shelterId');
    if (!animal) {
      return res.status(404).json({ message: "Animal non trovato" });
    }

    const ownerId = animal.shelterId ? String(animal.shelterId) : null;
    if (req.user?.role !== 'admin' && ownerId && ownerId !== String(req.user?.userId)) {
      return res.status(403).json({ message: 'Non autorizzato' });
    }

    const deleted = await Animal.findByIdAndDelete(animalId);
    const Announcement = require('../models/Announcement');
    await Announcement.deleteMany({ animalId });

    res.json({ message: "Animal eliminato", id: deleted._id });
  } catch (err) {
    console.error("Errore in deleteAnimal:", err);
    sendError(res, 500, err.message, "Errore eliminazione animal", 'ANIMAL_DELETE_ERROR');
  }
};

/**
 * Handles the list animals API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.listAnimals = async (req, res) => {
  try {
    const { shelterId } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const skip = (page - 1) * limit;
    const filter = {};
    if (shelterId) {
      if (!mongoose.isValidObjectId(shelterId)) return res.status(400).json({ message: 'ID rifugio non valido' });
      filter.shelterId = shelterId;
    } else if (req.user && req.user.userId) {
      filter.shelterId = req.user.userId;
    } else {
      return res.json({
        meta: {
          totalItems: 0,
          totalPages: 0,
          currentPage: page
        },
        data: []
      });
    }

    const totalItems = await Animal.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit);
    const animals = await Animal.find(filter)
      .select('-imageEmbedding -__v -photo.data')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const Announcement = require('../models/Announcement');
    const out = await Promise.all(animals.map(async (a) => {
      const obj = a.toObject ? a.toObject() : a;
      if ((obj.photo?.data || obj.photo?.contentType) && obj._id) {
        obj.photos = [buildAnimalPhotoUrl(obj._id)];
      }
      delete obj.photo;
      if ((!obj.photos || obj.photos.length === 0) && obj._id) {
        try {
          const ann = await Announcement.findOne({ animalId: obj._id, 'photo.data': { $exists: true } }).sort({ createdAt: -1 }).select('_id');
          if (ann && ann._id) {
            obj.photos = [`/api/v1/announcements/${ann._id}/photo`];
          }
        } catch (e) {
        }
      }
      return obj;
    }));

    res.json({
      meta: {
        totalItems,
        totalPages,
        currentPage: page
      },
      data: out
    });
  } catch (err) {
    sendError(res, 500, err.message, 'Errore recupero animali', 'ANIMALS_LIST_ERROR');
  }
};
