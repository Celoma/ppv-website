const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

// Support pour Prisma Postgres (DATABASE_URL) ou configuration individuelle
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;

let pool;

if (databaseUrl) {
  // Utiliser l'URL de connexion complète (Prisma Postgres)
  pool = new Pool({
    connectionString: databaseUrl
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

module.exports = { pool };