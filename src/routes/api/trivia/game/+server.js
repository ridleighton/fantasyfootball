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

export async function GET({ url, cookies }) {
  const slug = url.searchParams.get('slug');
  if (!slug) throw error(400, 'slug required');

  const db = await createClient();
  try {
    const user = await getUser(cookies, db);
    if (!user) throw error(401, 'Unauthorized');

    const gameRes = await db.query(
      `SELECT id, title, prompt, slug, time_limit_seconds
       FROM trivia_games
       WHERE slug = $1 AND published = true`,
      [slug]
    );
    if (gameRes.rows.length === 0) throw error(404, 'Game not found');
    const game = gameRes.rows[0];

    const slotsRes = await db.query(
      `SELECT tga.id, tga.hint_data, tga.sort_order
       FROM trivia_game_answers tga
       WHERE tga.game_id = $1
       ORDER BY tga.sort_order ASC, tga.id ASC`,
      [game.id]
    );

    return json({
      game: {
        id: game.id,
        title: game.title,
        prompt: game.prompt,
        slug: game.slug,
        time_limit_seconds: game.time_limit_seconds,
        total: slotsRes.rows.length
      },
      slots: slotsRes.rows.map(r => ({
        id: r.id,
        hintData: r.hint_data ?? {},
        sort_order: r.sort_order
      }))
    });
  } finally {
    await db.end();
  }
}
