const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const { attachUser, requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bots');
const paymentRoutes = require('./routes/payments');
const environmentRoutes = require('./routes/environments');
const envRoutes = require('./routes/envs');
const adminRoutes = require('./routes/admin');

const app = express();

// // Дозволені origin'и для CORS
// const allowedOrigins = [
//   'http://localhost:5500',
//   'http://127.0.0.1:5500',
//   // додаси сюди після деплою:
//   // 'https://gp-panel.onrender.com',
//   // 'https://app.genieprompts.net',
// ];

app.use(
  cors({
    origin: [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'https://app.genieprompts.net', // твій фронт, якщо вже є
    ],
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);
app.use('/bots', botRoutes);
app.use('/payments', paymentRoutes);
app.use('/environments', requireAuth, environmentRoutes);
app.use('/envs', requireAuth, envRoutes);
app.use('/admin', adminRoutes);

app.use((err, req, res, next) => {
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'internal server error' });
});

// Головне: порт з ENV (Render його виставляє)
const PORT = process.env.PORT || config.port || 4000;

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
