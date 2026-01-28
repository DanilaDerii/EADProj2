
const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing in .env');
}

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = { db };
