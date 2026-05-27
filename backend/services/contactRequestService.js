function normalizeMessage(value, emptyMessage) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(emptyMessage);
  if (text.length > 1000) throw new Error('Messaggio troppo lungo: massimo 1000 caratteri');
  return text;
}

function normalizeContactMessage(value) {
  return normalizeMessage(value, 'Messaggio obbligatorio');
}

function normalizeReplyMessage(value) {
  return normalizeMessage(value, 'Risposta obbligatoria');
}

function asId(value) {
  return value?._id || value;
}

function buildContactRequestPayload({ requester, animal, message }) {
  return {
    requesterId: asId(requester),
    shelterId: asId(animal?.shelterId),
    animalId: asId(animal),
    message: normalizeContactMessage(message)
  };
}

function sameId(a, b) {
  return String(asId(a) || '') === String(asId(b) || '');
}

function canShelterManageRequest(contactRequest, shelterId) {
  return sameId(contactRequest?.shelterId, shelterId);
}

module.exports = {
  normalizeContactMessage,
  normalizeReplyMessage,
  buildContactRequestPayload,
  canShelterManageRequest
};
