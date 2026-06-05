const {
  normalizeContactMessage,
  normalizeReplyMessage,
  buildContactRequestPayload,
  canShelterManageRequest
} = require('../services/contactRequestService');

describe('contactRequestService', () => {
  describe('normalizeContactMessage', () => {
    test('returns trimmed message when valid', () => {
      expect(normalizeContactMessage('  voglio adottare  ')).toBe('voglio adottare');
    });

    test('throws on empty message', () => {
      expect(() => normalizeContactMessage('')).toThrow('Messaggio obbligatorio');
    });

    test('throws on whitespace-only message', () => {
      expect(() => normalizeContactMessage('   ')).toThrow('Messaggio obbligatorio');
    });

    test('throws on null message', () => {
      expect(() => normalizeContactMessage(null)).toThrow('Messaggio obbligatorio');
    });

    test('throws on undefined message', () => {
      expect(() => normalizeContactMessage(undefined)).toThrow('Messaggio obbligatorio');
    });

    test('throws on message longer than 1000 characters', () => {
      const longMessage = 'a'.repeat(1001);
      expect(() => normalizeContactMessage(longMessage)).toThrow('massimo 1000 caratteri');
    });

    test('accepts message of exactly 1000 characters', () => {
      const maxMessage = 'a'.repeat(1000);
      expect(normalizeContactMessage(maxMessage)).toBe(maxMessage);
    });
  });

  describe('normalizeReplyMessage', () => {
    test('returns trimmed reply when valid', () => {
      expect(normalizeReplyMessage('  grazie per la richiesta  ')).toBe('grazie per la richiesta');
    });

    test('throws on empty reply', () => {
      expect(() => normalizeReplyMessage('')).toThrow('Risposta obbligatoria');
    });

    test('throws on null reply', () => {
      expect(() => normalizeReplyMessage(null)).toThrow('Risposta obbligatoria');
    });

    test('throws on reply longer than 1000 characters', () => {
      const longReply = 'b'.repeat(1001);
      expect(() => normalizeReplyMessage(longReply)).toThrow('massimo 1000 caratteri');
    });
  });

  describe('buildContactRequestPayload', () => {
    test('extracts IDs from documents', () => {
      const payload = buildContactRequestPayload({
        requester: { _id: 'user1', username: 'mario' },
        animal: { _id: 'animal1', shelterId: { _id: 'shelter1' } },
        message: 'Voglio info'
      });

      expect(payload.requesterId).toBe('user1');
      expect(payload.shelterId).toBe('shelter1');
      expect(payload.animalId).toBe('animal1');
      expect(payload.message).toBe('Voglio info');
    });

    test('handles raw ID values', () => {
      const payload = buildContactRequestPayload({
        requester: { _id: 'user1' },
        animal: { _id: 'animal1', shelterId: 'shelter1' },
        message: 'test'
      });

      expect(payload.requesterId).toBe('user1');
      expect(payload.shelterId).toBe('shelter1');
      expect(payload.animalId).toBe('animal1');
    });

    test('throws when message is empty', () => {
      expect(() => buildContactRequestPayload({
        requester: { _id: 'user1' },
        animal: { _id: 'animal1', shelterId: 'shelter1' },
        message: ''
      })).toThrow('Messaggio obbligatorio');
    });
  });

  describe('canShelterManageRequest', () => {
    test('returns true when shelter owns the request', () => {
      const result = canShelterManageRequest(
        { shelterId: { _id: 'shelter1' } },
        'shelter1'
      );

      expect(result).toBe(true);
    });

    test('returns false when shelter does not own the request', () => {
      const result = canShelterManageRequest(
        { shelterId: { _id: 'shelter2' } },
        'shelter1'
      );

      expect(result).toBe(false);
    });

    test('returns false for null contact request', () => {
      expect(canShelterManageRequest(null, 'shelter1')).toBe(false);
    });

    test('returns false for undefined contact request', () => {
      expect(canShelterManageRequest(undefined, 'shelter1')).toBe(false);
    });
  });
});
