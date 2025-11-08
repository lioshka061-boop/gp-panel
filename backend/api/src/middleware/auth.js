const jwt = require('jsonwebtoken');
const config = require('../config/env');
const knex = require('../db/knex');

const COOKIE_NAME = config.cookieName;

async function attachUser(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      req.user = null;
      return next();
    }
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await knex('users').where({ id: payload.sub }).first();
    req.user = user || null;
    return next();
  } catch (error) {
    req.user = null;
    return next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  return next();
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
  });
}

function getTokenFromRequest(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  return token || null;
}

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin,
  setAuthCookie,
  clearAuthCookie,
};
