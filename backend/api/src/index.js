const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bots');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);
app.use('/bots', botRoutes);
app.use('/payments', paymentRoutes);
app.use('/admin', adminRoutes);

app.use((err, req, res, next) => {
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'internal server error' });
});

app.listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});
