/**
 * Normalizes and validates a contact-request message.
 * @param {*} value - Raw message submitted by a requester or shelter.
 * @param {string} emptyMessage - Validation message to throw when the text is blank.
 * @returns {string} Trimmed message text.
 * @throws {Error} When the message is empty or longer than 1000 characters.
 */
function normalizeMessage(value, emptyMessage) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(emptyMessage);
  if (text.length > 1000) throw new Error('Messaggio troppo lungo: massimo 1000 caratteri');
  return text;
}

/**
 * Normalizes the initial contact-request message.
 * @param {*} value - Raw adoption request message entered by the user.
 * @returns {string} Validated adoption request message.
 */
function normalizeContactMessage(value) {
  return normalizeMessage(value, 'Messaggio obbligatorio');
}

/**
 * Normalizes the shelter reply message.
 * @param {*} value - Raw reply text entered by the shelter.
 * @returns {string} Validated shelter reply message.
 */
function normalizeReplyMessage(value) {
  return normalizeMessage(value, 'Risposta obbligatoria');
}

/**
 * Extracts the MongoDB identifier from a document-like value.
 * @param {Object|string} value - Mongoose document, object containing `_id`, or raw identifier.
 * @returns {Object|string|undefined} Extracted `_id` value or the original identifier.
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
 * @param {Object|string} a - First document or identifier to compare.
 * @param {Object|string} b - Second document or identifier to compare.
 * @returns {boolean} True when both values resolve to the same identifier.
 */
function sameId(a, b) {
  return String(asId(a) || '') === String(asId(b) || '');
}

/**
 * Checks whether a shelter can manage a contact request.
 * @param {Object} contactRequest - Contact-request document containing the owning shelter id.
 * @param {string} shelterId - Authenticated shelter identifier to check.
 * @returns {boolean} True when the request belongs to the shelter.
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
