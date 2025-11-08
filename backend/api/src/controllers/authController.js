const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const knex = require('../db/knex');
const config = require('../config/env');
const { setAuthCookie, clearAuthCookie } = require('../middleware/auth');

function createToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function serializeUser(user) {
  if (!user) return null;
  const { id, full_name, email, role } = user;
  return { id, full_name, email, role };
}

async function register(req, res) {
  const { full_name, phone, email, password } = req.body || {};
  if (!full_name || !phone || !email || !password) {
    return res.status(400).json({ error: 'full_name, phone, email, password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  const existing = await knex('users').where({ email }).first();
  if (existing) {
    return res.status(409).json({ error: 'email already registered' });
  }
  const password_hash = await bcrypt.hash(password, 10);
  const [user] = await knex('users')
    .insert({ full_name, phone, email, password_hash, role: 'user' })
    .returning(['id', 'full_name', 'email', 'role']);
  const token = createToken(user.id);
  setAuthCookie(res, token);
  return res.status(201).json({ user });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const user = await knex('users').where({ email }).first();
  if (!user) return res.status(400).json({ error: 'invalid credentials' });
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) return res.status(400).json({ error: 'invalid credentials' });
  const token = createToken(user.id);
  setAuthCookie(res, token);
  return res.json({ user: serializeUser(user) });
}

function me(req, res) {
  return res.json({ user: serializeUser(req.user) });
}

function logout(req, res) {
  clearAuthCookie(res);
  return res.json({ success: true });
}

module.exports = { register, login, me, logout };
