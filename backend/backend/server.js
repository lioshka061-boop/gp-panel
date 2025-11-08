/**
 * Сервер авторизації (Express + SQLite).
 *
 * Маршрути:
 *   POST /api/register  {login, password}
 *   POST /api/login     {login, password}
 *   POST /api/logout    (Authorization: Bearer <token>)
 *   GET  /api/me        (Authorization: Bearer <token>)
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { initDb } = require('./initDb');
const {
  findUserByLogin,
  findUserByToken,
  createUser,
  setUserOnlineStatus,
  setUserSessionToken
} = require('./db');
const { verifyAuth } = require('./authMiddleware');

const PORT = process.env.PORT || 3000;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 години

const app = express();

app.use(cors());
app.use(express.json());

// Реєстрація
app.post('/api/register', async (req, res) => {
  try {
    const { login, password } = req.body || {};

    if (!login || !password) {
      return res.status(400).json({ error: 'login and password required' });
    }

    const existing = await findUserByLogin(login);
    if (existing) {
      return res.status(409).json({ error: 'login already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await createUser(login, passwordHash);

    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/register error:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Логін: останній логін виграє, старі токени відвалюються
app.post('/api/login', async (req, res) => {
  try {
    const { login, password } = req.body || {};

    if (!login || !password) {
      return res.status(400).json({ error: 'invalid credentials' });
    }

    const user = await findUserByLogin(login);
    if (!user) {
      return res.status(400).json({ error: 'invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'invalid credentials' });
    }

    const now = Date.now();
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = now + SESSION_TTL_MS;

    // записуємо новий токен і час закінчення
    await setUserSessionToken(user.id, token, expiresAt);
    await setUserOnlineStatus(user.id, true);

    // тут БЕЗ перевірки "user already online" — просто нова сесія
    res.json({ token, expires: expiresAt });
  } catch (error) {
    console.error('POST /api/login error:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Логаут
app.post('/api/logout', async (req, res) => {
  try {
    const header = req.headers['authorization'] || '';
    const [, token] = header.split(' ');

    if (!token) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const user = await findUserByToken(token.trim());
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    await setUserOnlineStatus(user.id, false);
    await setUserSessionToken(user.id, null, null);

    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/logout error:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Поточний юзер
app.get('/api/me', verifyAuth, async (req, res) => {
  const { id, login, is_online } = req.user;
  res.json({
    id,
    login,
    is_online: Number(is_online)
  });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Auth backend is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialise database:', error);
    process.exit(1);
  });
