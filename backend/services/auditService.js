const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

const SORT_FIELDS = new Set(['actorName', 'action', 'targetUsername', 'createdAt']);

function toObjectId(value) {
  const raw = value?._id || value;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
}

function normalizeName(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function buildAuditEntry({ actor, action, target }) {
  const actorId = toObjectId(actor);
  const targetId = toObjectId(target);

  return {
    actorId,
    actorName: normalizeName(actor?.username || actor?.actorName, 'anonimo'),
    action: normalizeName(action, 'azione'),
    targetId,
    targetUsername: targetId ? normalizeName(target?.username || target?.targetUsername, null) : null
  };
}

function normalizeSort(sortBy = 'createdAt', sortDir = 'desc') {
  if (!SORT_FIELDS.has(sortBy)) return { createdAt: -1 };
  return { [sortBy]: String(sortDir).toLowerCase() === 'asc' ? 1 : -1 };
}

function buildAuditQuery(query = {}) {
  const search = String(query.search || '').trim();
  const filter = {};
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ actorName: regex }, { targetUsername: regex }];
  }

  const requestedLimit = Number.parseInt(query.limit, 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 500)
    : 200;

  return {
    filter,
    sort: normalizeSort(query.sortBy, query.sortDir),
    limit
  };
}

async function resolveActor(actor) {
  if (!actor) return null;
  if (actor.username || actor.actorName) return actor;
  const actorId = toObjectId(actor);
  if (!actorId) return null;
  return User.findById(actorId).select('username');
}

async function writeAuditLog({ actor, action, target }) {
  try {
    const resolvedActor = await resolveActor(actor);
    return await AuditLog.create(buildAuditEntry({ actor: resolvedActor, action, target }));
  } catch (err) {
    console.warn('Errore scrittura audit log:', err.message);
    return null;
  }
}

module.exports = {
  buildAuditEntry,
  buildAuditQuery,
  normalizeSort,
  writeAuditLog
};
