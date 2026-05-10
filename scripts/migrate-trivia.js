#!/usr/bin/env node
/**
 * Run once: creates trivia tables and seed data.
 */
const { Client } = require('pg');

const url = process.env.DATABASE_URL ?? '';
const db = new Client({
  connectionString: url.includes('sslmode') ? url : `${url}?sslmode=require`
});

async function main() {
  await db.connect();
  try {
    console.log('Running trivia schema migrations...');

    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'dark'`);
    console.log('  ✓ users.theme_preference');

    await db.query(`
      CREATE TABLE IF NOT EXISTS trivia_databases (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        api_league_id INTEGER,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ trivia_databases');

    await db.query(`
      CREATE TABLE IF NOT EXISTS trivia_players (
        id SERIAL PRIMARY KEY,
        database_id INTEGER REFERENCES trivia_databases(id) ON DELETE CASCADE,
        full_name VARCHAR(150) NOT NULL,
        aliases TEXT[],
        metadata JSONB,
        api_player_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(api_player_id, database_id)
      )
    `);
    console.log('  ✓ trivia_players');

    await db.query(`
      CREATE TABLE IF NOT EXISTS trivia_games (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        prompt TEXT NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        time_limit_seconds INTEGER DEFAULT 180,
        published BOOLEAN DEFAULT FALSE,
        database_ids INTEGER[],
        hint_fields TEXT[],
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ trivia_games');

    await db.query(`
      CREATE TABLE IF NOT EXISTS trivia_game_answers (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES trivia_games(id) ON DELETE CASCADE,
        player_id INTEGER REFERENCES trivia_players(id) ON DELETE CASCADE,
        hint_data JSONB,
        sort_order INTEGER DEFAULT 0,
        UNIQUE(game_id, player_id)
      )
    `);
    console.log('  ✓ trivia_game_answers');

    await db.query(`CREATE INDEX IF NOT EXISTS idx_trivia_players_database ON trivia_players(database_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_trivia_players_name ON trivia_players(full_name)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_trivia_answers_game ON trivia_game_answers(game_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_trivia_games_slug ON trivia_games(slug)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_trivia_games_published ON trivia_games(published)`);
    console.log('  ✓ indexes');

    await db.query(`
      INSERT INTO trivia_databases (name, slug, api_league_id, description) VALUES
        ('NFL', 'nfl', 1, 'National Football League'),
        ('NCAA Football', 'ncaa-football', 2, 'NCAA Division I Football (FBS)')
      ON CONFLICT (slug) DO NOTHING
    `);
    console.log('  ✓ seed data');

    console.log('\nTrivia migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
