/**
 * Normalizes and validates a contact-request message.
 * @param {Object} value - Value to normalize or format.
 * @param {string} emptyMessage - empty message used by the function.
 * @returns {Object|string|Array<Object>|null} The result produced by the function.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
function normalizeMessage(value, emptyMessage) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(emptyMessage);
  if (text.length > 1000) throw new Error('Messaggio troppo lungo: massimo 1000 caratteri');
  return text;
}

/**
 * Normalizes the initial contact-request message.
 * @param {Object} value - Value to normalize or format.
 * @returns {Object|string|Array<Object>|null} The result produced by the function.
 */
function normalizeContactMessage(value) {
  return normalizeMessage(value, 'Messaggio obbligatorio');
}

/**
 * Normalizes the shelter reply message.
 * @param {Object} value - Value to normalize or format.
 * @returns {Object|string|Array<Object>|null} The result produced by the function.
 */
function normalizeReplyMessage(value) {
  return normalizeMessage(value, 'Risposta obbligatoria');
}

/**
 * Extracts the MongoDB identifier from a document-like value.
 * @param {Object} value - Value to normalize or format.
 * @returns {void|Object|string|Array<Object>|null} The result produced by the function.
 */
function asId(value) {
  return value?._id || value;
}

/**
 * Builds the payload used to create a contact request.
 * @param {Object} payload - Contact-request source data.
 * @param {Object} payload.requester - User document that is sending the request.
 * @param {Object} payload.animal - Animal document that belongs to the shelter.
 * @param {string} payload.message - Request message submitted by the user.
 * @returns {Object} Contact-request creation payload.
 */
function buildContactRequestPayload({ requester, animal, message }) {
  return {
    requesterId: asId(requester),
    shelterId: asId(animal?.shelterId),
    animalId: asId(animal),
    message: normalizeContactMessage(message)
  };
}

/**
 * Compares two MongoDB identifier-like values as strings.
 * @param {Object} a - a used by the function.
 * @param {Object} b - b used by the function.
 * @returns {boolean} The result produced by the function.
 */
function sameId(a, b) {
  return String(asId(a) || '') === String(asId(b) || '');
}

/**
 * Checks whether a shelter can manage a contact request.
 * @param {Object} contactRequest - contact request used by the function.
 * @param {string} shelterId - shelter id used by the function.
 * @returns {boolean} The result produced by the function.
 */
function canShelterManageRequest(contactRequest, shelterId) {
  return sameId(contactRequest?.shelterId, shelterId);
}

module.exports = {
  normalizeContactMessage,
  normalizeReplyMessage,
  buildContactRequestPayload,
  canShelterManageRequest
};
