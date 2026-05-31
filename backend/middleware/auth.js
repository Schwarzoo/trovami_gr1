const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Validates the JWT bearer token, checks the stored session, and attaches the authenticated user to the request.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware callback.
 * @returns {Promise<void>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token mancante' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user || user.sessionToken !== token) {
      return res.status(401).json({ message: 'Sessione non valida o scaduta' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account bloccato' });
    }

    req.user = { userId: decoded.userId, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token non valido', error: err.message });
  }
};

/**
 * Creates an Express middleware that allows access only to users with one of the required roles.
 * @param {...string} roles - Roles allowed to access the protected route.
 * @returns {Function} Express middleware that validates the authenticated user's role.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Permesso negato' });
    }
    next();
  };
};

module.exports = { authMiddleware, requireRole };
