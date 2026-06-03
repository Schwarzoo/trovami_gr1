const mongoose = require('mongoose');
const Animal = require('../models/Animal');
const ContactRequest = require('../models/ContactRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { writeAuditLog } = require('../services/auditService');
const {
  buildContactRequestPayload,
  canShelterManageRequest,
  normalizeReplyMessage
} = require('../services/contactRequestService');
const { sendError } = require('../utils/errorResponse');

/**
 * Sends a standardized HTTP 400 response for an invalid MongoDB identifier.
 * @param {Object} res - Express response object.
 * @param {string} label - Human-readable name of the invalid identifier.
 * @returns {import('express').Response} Express response with the validation error body.
 */
function invalidId(res, label) {
  return res.status(400).json({ message: `${label} non valido` });
}

/**
 * Applies the standard population chain to a contact-request query.
 * @param {Object} query - Mongoose query for one or more contact requests.
 * @returns {Object} The same Mongoose query with requester, shelter, and animal references populated.
 */
function populateRequest(query) {
  return query
    .populate('requesterId', 'username email phoneNumber')
    .populate('shelterId', 'username role rifugioData')
    .populate('animalId', 'name species breed photos adoptable');
}

/**
 * Handles the create contact request API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.createContactRequest = async (req, res) => {
  try {
    const animalId = req.body?.animalId;
    if (!mongoose.Types.ObjectId.isValid(animalId)) return invalidId(res, 'ID animale');

    const [requester, animal] = await Promise.all([
      User.findById(req.user.userId).select('username email phoneNumber role'),
      Animal.findById(animalId).populate('shelterId', 'username role rifugioStatus rifugioData')
    ]);
    if (!requester) return res.status(401).json({ message: 'Utente non valido' });
    if (requester.role !== 'user') {
      return res.status(403).json({ message: 'Solo un utente registrato normale puo inviare richieste al rifugio' });
    }
    if (!animal) return res.status(404).json({ message: 'Animale non trovato' });
    if (!animal.shelterId) return res.status(400).json({ message: 'Animale non associato a un rifugio' });
    if (animal.shelterId.role !== 'shelter' || animal.shelterId.rifugioStatus !== 'approved') {
      return res.status(400).json({ message: 'Rifugio non disponibile per richieste' });
    }

    const contactRequest = await ContactRequest.create(buildContactRequestPayload({
      requester,
      animal,
      message: req.body?.message
    }));

    await Notification.create({
      userId: animal.shelterId._id,
      type: 'contact_request',
      contactRequestId: contactRequest._id,
      targetUserId: requester._id,
      message: `Nuova richiesta di adozione per ${animal.name || animal.species || 'un animale'} da ${requester.username}`
    });

    await writeAuditLog({
      actor: requester,
      action: 'inviata richiesta di adozione',
      target: animal.shelterId
    });

    const fullRequest = await populateRequest(ContactRequest.findById(contactRequest._id));
    res.location(`${req.protocol}://${req.get('host')}${req.baseUrl}/${contactRequest._id}`).status(201).json(fullRequest);
  } catch (err) {
    const status = /obbligatorio|troppo lungo/i.test(err.message) ? 400 : 500;
    sendError(res, status, err.message, err.message || 'Errore invio richiesta adozione', 'CONTACT_REQUEST_CREATE_ERROR');
  }
};

/**
 * Handles the get contact requests API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.getContactRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('role rifugioStatus');
    if (!user) return res.status(401).json({ message: 'Utente non valido' });

    const filter = user.role === 'shelter'
      ? { shelterId: user._id, hiddenForShelter: { $ne: true } }
      : { requesterId: user._id, hiddenForRequester: { $ne: true } };

    const list = await populateRequest(ContactRequest.find(filter))
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(list);
  } catch (err) {
    sendError(res, 500, err.message, 'Errore recupero richieste adozione', 'CONTACT_REQUESTS_FETCH_ERROR');
  }
};

/**
 * Handles the clear replied contact requests API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.clearRepliedContactRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('role rifugioStatus');
    if (!user) return res.status(401).json({ message: 'Utente non valido' });

    let filter;
    let update;
    if (user.role === 'shelter') {
      if (user.rifugioStatus !== 'approved') {
        return res.status(403).json({ message: 'Solo un rifugio approvato puo svuotare le richieste risposte' });
      }
      filter = { shelterId: user._id, status: 'replied', hiddenForShelter: { $ne: true } };
      update = { $set: { hiddenForShelter: true } };
    } else if (user.role === 'user') {
      filter = { requesterId: user._id, status: 'replied', hiddenForRequester: { $ne: true } };
      update = { $set: { hiddenForRequester: true } };
    } else {
      return res.status(403).json({ message: 'Permesso negato' });
    }

    const result = await ContactRequest.updateMany(filter, update);

    res.json({ success: true, hidden: result.modifiedCount ?? result.nModified ?? 0 });
  } catch (err) {
    sendError(res, 500, err.message, 'Errore svuotamento richieste risposte', 'CONTACT_REQUESTS_CLEAR_ERROR');
  }
};

/**
 * Handles the clear requester replied contact requests API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.clearRequesterRepliedContactRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('role');
    if (!user) return res.status(401).json({ message: 'Utente non valido' });
    if (user.role !== 'user') {
      return res.status(403).json({ message: 'Solo un utente normale puo eliminare le proprie richieste risposte' });
    }

    const result = await ContactRequest.updateMany(
      { requesterId: user._id, status: 'replied', hiddenForRequester: { $ne: true } },
      { $set: { hiddenForRequester: true } }
    );

    res.json({ success: true, hidden: result.modifiedCount ?? result.nModified ?? 0 });
  } catch (err) {
    sendError(res, 500, err.message, 'Errore eliminazione richieste risposte', 'CONTACT_REQUESTS_DELETE_REPLIED_ERROR');
  }
};

/**
 * Handles the reply to contact request API request and writes the HTTP response.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
exports.replyToContactRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(requestId)) return invalidId(res, 'ID richiesta');

    const [shelter, contactRequest] = await Promise.all([
      User.findById(req.user.userId).select('username role rifugioStatus rifugioData'),
      ContactRequest.findById(requestId).populate('requesterId', 'username')
    ]);
    if (!shelter) return res.status(401).json({ message: 'Utente non valido' });
    if (shelter.role !== 'shelter' || shelter.rifugioStatus !== 'approved') {
      return res.status(403).json({ message: 'Solo un rifugio approvato puo rispondere alle richieste' });
    }
    if (!contactRequest) return res.status(404).json({ message: 'Richiesta non trovata' });
    if (!canShelterManageRequest(contactRequest, shelter._id)) {
      return res.status(403).json({ message: 'Non autorizzato' });
    }

    contactRequest.replyMessage = normalizeReplyMessage(req.body?.replyMessage);
    contactRequest.status = 'replied';
    contactRequest.repliedAt = new Date();
    await contactRequest.save();

    await Notification.create({
      userId: contactRequest.requesterId._id || contactRequest.requesterId,
      type: 'contact_request',
      contactRequestId: contactRequest._id,
      targetUserId: shelter._id,
      message: 'Il rifugio ha risposto alla tua richiesta di adozione'
    });

    await writeAuditLog({
      actor: shelter,
      action: 'risposto richiesta di adozione',
      target: contactRequest.requesterId
    });

    const fullRequest = await populateRequest(ContactRequest.findById(contactRequest._id));
    res.json(fullRequest);
  } catch (err) {
    const status = /obbligatoria|troppo lungo/i.test(err.message) ? 400 : 500;
    sendError(res, status, err.message, err.message || 'Errore risposta richiesta adozione', 'CONTACT_REQUEST_REPLY_ERROR');
  }
};
