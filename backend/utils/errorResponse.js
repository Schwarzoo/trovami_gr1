/**
 * Sends a standardized API error response.
 * @param {Object} res - Express response object.
 * @param {number} statusCode - HTTP status code.
 * @param {string} developerMessage - Technical message for logs/debugging.
 * @param {string} userMessage - Message safe to show to users.
 * @param {string} errorCode - Stable application error code.
 * @returns {import('express').Response} Express response with standardized error body.
 */
function sendError(res, statusCode, developerMessage, userMessage, errorCode) {
  return res.status(statusCode).json({
    developerMessage,
    userMessage,
    errorCode
  });
}

module.exports = { sendError };
