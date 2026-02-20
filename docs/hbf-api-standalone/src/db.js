const { Pool } = require('pg');

let pool;

function initDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('DATABASE_URL not set — database queries will fail');
    return Promise.resolve();
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
  });

  return pool.query('SELECT 1').then(() => {
    console.log('PostgreSQL connected');
  });
}

async function query(sql, params = []) {
  if (!pool) throw new Error('Database not initialized');
  const result = await pool.query(sql, params);
  return result.rows;
}

function uuidv4() {
  return require('uuid').v4();
}

module.exports = { initDb, query, uuidv4 };
