import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

async function getUser(cookies, db) {
  const supabase = serverSupabase(cookies);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const res = await db.query('SELECT id FROM users WHERE supabase_uid = $1', [session.user.id]);
  return res.rows[0] ?? null;
}

export async function GET({ cookies }) {
  const db = await createClient();
  try {
    const user = await getUser(cookies, db);
    if (!user) throw error(401, 'Unauthorized');

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
      GROUP BY tg.id, tg.title, tg.prompt, tg.slug, tg.time_limit_seconds
      ORDER BY tg.created_at DESC
    `);

    return json(res.rows);
  } finally {
    await db.end();
  }
}
