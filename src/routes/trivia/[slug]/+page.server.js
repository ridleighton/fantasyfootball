import { redirect, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent, params }) {
  const { session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const { slug } = params;
  const db = await createClient();
  try {
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

    return {
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
    };
  } finally {
    await db.end();
  }
}
