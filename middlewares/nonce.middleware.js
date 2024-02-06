// middleware/nonceMiddleware.js
const crypto = require('crypto');

function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}
function nonceMiddleware(req, res, next) {
    req.nonce = generateNonce();
    next();
  }

module.exports = nonceMiddleware;