const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Attach req.user when a valid Bearer token is present; never blocks the request.
 * Use for public browse routes that personalize when logged in (eBay search, etc.).
 */
async function optionalUserAuth(req, res, next) {
  req.user = null;
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token || !process.env.JWT_SECRET) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.sub || decoded.userId || decoded.id;
    const user = await User.findById(userId).select('-password');
    if (user) req.user = user;
  } catch {
    /* ignore invalid/expired tokens */
  }
  return next();
}

module.exports = optionalUserAuth;
