const { Pool } = require('pg');

// Render (и большинство внешних Postgres-провайдеров) требуют SSL,
// но не дают полноценный сертификат — поэтому rejectUnauthorized: false.
// Для локальной разработки с localhost SSL отключаем полностью.
const isLocal = (process.env.DATABASE_URL || '').includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS levels (
      id SERIAL PRIMARY KEY,
      position INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      author TEXT NOT NULL,
      level_id TEXT,
      difficulty TEXT NOT NULL DEFAULT 'Unrated',
      stars INTEGER,
      image_url TEXT,
      verifier TEXT,
      video_url TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      level_id INTEGER REFERENCES levels(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      video_url TEXT NOT NULL,
      progress INTEGER DEFAULT 100,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

module.exports = { pool, initDb };
