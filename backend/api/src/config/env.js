const path = require('path');
const dotenvPath = process.env.ENV_PATH
  ? path.resolve(process.env.ENV_PATH)
  : path.resolve(__dirname, '../../.env');

require('dotenv').config({ path: dotenvPath });

const required = ['JWT_SECRET'];
required.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[env] Missing ${key} in environment variables.`);
  }
});

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.AUTH_COOKIE_NAME || 'gp_token',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  wayforpay: {
    merchantAccount: process.env.WFP_MERCHANT_ACCOUNT,
    secretKey: process.env.WFP_SECRET_KEY,
    domain: process.env.WFP_DOMAIN,
    apiUrl: process.env.WFP_API_URL,
    serviceUrl: process.env.WFP_SERVICE_URL,
    returnUrl: process.env.FRONTEND_RETURN_URL,
  },
};
