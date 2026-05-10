#!/usr/bin/env node
/**
 * Run once: adds supabase_uid, is_commissioner, renames espn_game_id -> api_game_id
 */
import pg from 'pg';
const { Client } = pg;

const url = process.env.DATABASE_URL ?? '';
const db = new Client({
  connectionString: url.includes('sslmode') ? url : `${url}?sslmode=require`
});

await db.connect();

try {
  console.log('Running schema migrations...');

  // Add supabase_uid if not exists
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE
  `);
  console.log('  ✓ users.supabase_uid');

  // Add is_commissioner if not exists
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_commissioner BOOLEAN DEFAULT FALSE
  `);
  console.log('  ✓ users.is_commissioner');

  // Rename espn_game_id -> api_game_id (idempotent)
  const colCheck = await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'espn_game_id'
  `);
  if (colCheck.rows.length > 0) {
    await db.query(`ALTER TABLE games RENAME COLUMN espn_game_id TO api_game_id`);
    console.log('  ✓ games.espn_game_id → api_game_id');
  } else {
    // Add api_game_id if neither column exists
    const apiCheck = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'games' AND column_name = 'api_game_id'
    `);
    if (apiCheck.rows.length === 0) {
      await db.query(`ALTER TABLE games ADD COLUMN api_game_id TEXT UNIQUE`);
      console.log('  ✓ games.api_game_id (new)');
    } else {
      console.log('  ✓ games.api_game_id (already exists)');
    }
  }

  console.log('\nSchema migration complete.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await db.end();
}
