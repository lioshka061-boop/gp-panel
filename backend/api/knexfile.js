require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const shared = {
  client: 'pg',
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    directory: './src/db/migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
};

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'gp_panel',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

module.exports = {
  development: {
    ...shared,
    connection,
  },
  production: {
    ...shared,
    connection,
  },
};
