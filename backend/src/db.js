const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

// Support pour Prisma Postgres (DATABASE_URL) ou configuration individuelle
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
const isLocalDatabaseUrl = /localhost|127\.0\.0\.1|\bdb\b/i.test(databaseUrl || '');
const shouldUseSsl = Boolean(databaseUrl) && !isLocalDatabaseUrl;

let pool;

if (databaseUrl) {
  // Utiliser l'URL de connexion complète (Prisma Postgres)
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false
  });
} else {
  // Utiliser la configuration individuelle (Docker local)
  pool = new Pool({
    host: process.env.DB_HOST || 'db',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'db'
  });
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)');
}

const ready = ensureSchema();

module.exports = { pool, ready };