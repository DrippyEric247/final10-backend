const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const [, token] = hdr.split(' ');
  if (!token) return res.status(401).json({ message: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id }; // Token structure is { id: ... }
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Token invalid' });
  }
};










































