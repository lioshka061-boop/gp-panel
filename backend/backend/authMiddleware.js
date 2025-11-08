const { findUserByToken } = require('./db');

async function verifyAuth(req, res, next) {
  try {
    const header = req.headers['authorization'] || '';
    const [, token] = header.split(' ');

    if (!token) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const user = await findUserByToken(token.trim());
    if (!user || Number(user.is_online) !== 1) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    req.user = {
      id: user.id,
      login: user.login,
      is_online: Number(user.is_online),
      session_token: user.session_token
    };
    next();
  } catch (error) {
    console.error('verifyAuth error:', error);
    res.status(500).json({ error: 'internal server error' });
  }
}

module.exports = {
  verifyAuth
};
