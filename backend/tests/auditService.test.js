const mongoose = require('mongoose');

jest.mock('../models/AuditLog', () => ({ create: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));

const AuditLog = require('../models/AuditLog');
const { buildAuditEntry, normalizeSort } = require('../services/auditService');

beforeEach(() => { jest.clearAllMocks(); });

test('buildAuditEntry normalizes actor name', () => {
  const entry = buildAuditEntry({ actor: { _id: new mongoose.Types.ObjectId(), username: 'admin1' }, action: 'bloccato', target: { _id: new mongoose.Types.ObjectId(), username: 'user1' } });
  expect(entry.actorName).toBe('admin1');
  expect(entry.targetUsername).toBe('user1');
});

test('buildAuditEntry falls back to anonimo', () => {
  const entry = buildAuditEntry({ actor: null, action: '', target: null });
  expect(entry.actorName).toBe('anonimo');
});

test('normalizeSort defaults to createdAt:-1', () => {
  expect(normalizeSort()).toEqual({ createdAt: -1 });
});

test('normalizeSort accepts valid field', () => {
  expect(normalizeSort('actorName', 'asc')).toEqual({ actorName: 1 });
});
