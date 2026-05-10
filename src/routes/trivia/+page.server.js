import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent }) {
  const { session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const db = await createClient();
  try {
    const res = await db.query(`
      SELECT
        tg.id,
        tg.title,
        tg.prompt,
        tg.slug,
        tg.time_limit_seconds,
        COUNT(tga.id)::int AS answer_count,
        ARRAY_AGG(DISTINCT td.name) FILTER (WHERE td.name IS NOT NULL) AS databases
      FROM trivia_games tg
      LEFT JOIN trivia_game_answers tga ON tga.game_id = tg.id
      LEFT JOIN trivia_databases td ON td.id = ANY(tg.database_ids)
      WHERE tg.published = true
      GROUP BY tg.id
      ORDER BY tg.created_at DESC
    `);

    return { games: res.rows };
  } finally {
    await db.end();
  }
}
