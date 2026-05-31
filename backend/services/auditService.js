const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

const SORT_FIELDS = new Set(['actorName', 'action', 'targetUsername', 'createdAt']);

/**
 * Converts a value to a MongoDB ObjectId when possible.
 * @param {Object|string} value - User document, object containing `_id`, or raw identifier.
 * @returns {mongoose.Types.ObjectId|null} ObjectId instance, or null when the value is missing or invalid.
 */
function toObjectId(value) {
  const raw = value?._id || value;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
}

/**
 * Normalizes a display name and falls back when the value is empty.
 * @param {string} value - Candidate display name.
 * @param {string|null} fallback - Name to use when the candidate is blank.
 * @returns {string|null} Trimmed display name or the fallback value.
 */
function normalizeName(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

/**
 * Builds the audit-log display name for a shelter user.
 * @param {Object} user - User document or plain user object.
 * @returns {string|null} Shelter audit label, or null when the user is not a shelter.
 */
function getRifugioAuditName(user) {
  if (!user || user.role !== 'shelter') return null;
  const rifugioName = normalizeName(
    user.rifugioData?.rifugioName || user.shelterData?.shelterName,
    null
  );
  return rifugioName ? `rifugio ${rifugioName}` : null;
}

/**
 * Builds a normalized audit-log entry from actor, action, and target values.
 * @param {Object} entry - Audit-log source data.
 * @param {Object|string|null} entry.actor - User document or identifier that performed the action.
 * @param {string} entry.action - Audit action label.
 * @param {Object|string|null} entry.target - User document or identifier affected by the action.
 * @returns {Object} Normalized audit-log entry ready for persistence.
 */
function buildAuditEntry({ actor, action, target }) {
  const actorId = toObjectId(actor);
  const targetId = toObjectId(target);
  const actorName = getRifugioAuditName(actor)
    || actor?.username
    || actor?.actorName;
  const targetName = getRifugioAuditName(target)
    || target?.username
    || target?.targetUsername;

  return {
    actorId,
    actorName: normalizeName(actorName, 'anonimo'),
    action: normalizeName(action, 'azione'),
    targetId,
    targetUsername: targetId ? normalizeName(targetName, null) : null
  };
}

/**
 * Converts audit-log sort query parameters into a MongoDB sort object.
 * @param {string} sortBy - Requested audit-log field to sort by.
 * @param {string} sortDir - Requested sort direction, either `asc` or `desc`.
 * @returns {Object} MongoDB sort specification for the audit-log query.
 */
function normalizeSort(sortBy = 'createdAt', sortDir = 'desc') {
  if (!SORT_FIELDS.has(sortBy)) return { createdAt: -1 };
  return { [sortBy]: String(sortDir).toLowerCase() === 'asc' ? 1 : -1 };
}

/**
 * Builds the MongoDB filter, sort, and limit for audit-log listing.
 * @param {Object} query - HTTP query parameters from the admin audit-log endpoint.
 * @returns {{filter: Object, sort: Object, limit: number}} MongoDB query options for listing audit logs.
 */
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

/**
 * Resolves an actor identifier to a user document when needed.
 * @param {Object|string} actor - User document, audit actor object, or identifier to resolve.
 * @returns {Promise<Object|null>} User document or actor-like object, or null when it cannot be resolved.
 */
async function resolveActor(actor) {
  if (!actor) return null;
  if (actor.username || actor.actorName) return actor;
  const actorId = toObjectId(actor);
  if (!actorId) return null;
  return User.findById(actorId).select('username role rifugioData shelterData');
}

/**
 * Writes an audit-log entry and returns the created document when successful.
 * @param {Object} entry - Audit-log source data.
 * @param {Object|string|null} entry.actor - User document or identifier that performed the action.
 * @param {string} entry.action - Audit action label.
 * @param {Object|string|null} entry.target - User document or identifier affected by the action.
 * @returns {Promise<Object|null>} Promise resolving to the created audit log, or null when writing fails.
 */
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
