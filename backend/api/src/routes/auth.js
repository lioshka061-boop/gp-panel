const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const knex = require('../db/knex'); // у тебе може бути інший шлях
const config = require('../config/env');

const router = express.Router();

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

    const isProd = process.env.NODE_ENV === 'production';

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

module.exports = router;
