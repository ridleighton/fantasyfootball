import { createClient } from '$lib/server/db.js';

export async function load() {
  const db = await createClient();
  try {
    const res = await db.query(`
      SELECT
        td.id,
        td.name,
        td.slug,
        td.api_league_id,
        td.description,
        td.created_at,
        COUNT(tp.id)::int AS player_count
      FROM trivia_databases td
      LEFT JOIN trivia_players tp ON tp.database_id = td.id
      GROUP BY td.id
      ORDER BY td.name ASC
    `);

    return { databases: res.rows };
  } finally {
    await db.end();
  }
}
