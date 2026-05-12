const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAuthFailure } = require('../services/structuredLog');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      logAuthFailure(req, 'no_token');
      return res.status(401).json({ code: 'NO_TOKEN', message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.sub || decoded.userId || decoded.id;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      logAuthFailure(req, 'user_not_found');
      return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Authentication required' });
    }

    req.user = user;
    next();
  } catch (error) {
    const name = error && error.name;
    logAuthFailure(req, name === 'TokenExpiredError' ? 'token_expired' : 'token_invalid', {
      errorName: name,
    });
    res.status(401).json({ code: 'INVALID_TOKEN', message: 'Authentication required' });
  }
};

module.exports = auth;