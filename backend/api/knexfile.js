require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const shared = {
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

const buildConnection = () => {
  if (process.env.DATABASE_URL) {
    return {
      connection: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'gp_panel',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
};

module.exports = {
  development: {
    client: 'pg',
    ...shared,
    connection: buildConnection(),
  },
  production: {
    client: 'pg',
    ...shared,
    connection: buildConnection(),
  },
};
