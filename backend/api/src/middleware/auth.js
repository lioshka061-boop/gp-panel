const jwt = require('jsonwebtoken');
const config = require('../config/env');

function attachUser(req, res, next) {
  const authHeader = req.headers.authorization;

  const tokenFromHeader =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

  const token = req.cookies.gp_token || tokenFromHeader;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
  } catch (err) {
    console.error('JWT verify error:', err.message);
    req.user = null;
  }

  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  return next();
}

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin,
};
