const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const knex = require('../db/knex'); // у тебе може бути інший шлях
const config = require('../config/env');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';

router.post('/register', async (req, res, next) => {
  try {
    const { full_name, fullName, phone, email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const existing = await knex('users')
      .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
      .first();
    if (existing) {
      return res.status(400).json({ error: 'email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const fullNameValue = full_name || fullName || email;

    const [user] = await knex('users')
      .insert({
        full_name: fullNameValue,
        phone: phone || null,
        email,
        password_hash: hash,
        role: 'user',
      })
      .returning(['id', 'email', 'full_name', 'role']);

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        email: user.email,
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.cookie('gp_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    // важливо: порівнюємо в lowercase
    const user = await knex('users')
      .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
      .first();

    if (!user) {
      return res.status(400).json({ error: 'invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(400).json({ error: 'invalid credentials' });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        email: user.email,
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.cookie('gp_token', token, {
      httpOnly: true,
      secure: isProd,                // на Render буде true (https)
      sameSite: isProd ? 'none' : 'lax', // для кросдомену обовʼязково 'none'
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

router.post('/logout', requireAuth, (req, res) => {
  res.clearCookie('gp_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
  return res.sendStatus(204);
});

module.exports = router;
