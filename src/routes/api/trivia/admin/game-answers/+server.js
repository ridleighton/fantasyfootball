import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

async function getAdminUser(cookies, db) {
  const supabase = serverSupabase(cookies);
  const { data } = await supabase.auth.getSession(); const session = data?.session;
  if (!session) return null;
  const res = await db.query(
    'SELECT id, is_admin FROM users WHERE supabase_uid = $1',
    [session.user.id]
  );
  const user = res.rows[0];
  if (!user?.is_admin) return null;
  return user;
}

export async function GET({ url, cookies }) {
  const gameId = url.searchParams.get('gameId');
  if (!gameId) throw error(400, 'gameId required');

  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const res = await db.query(
      `SELECT tga.id, tga.game_id, tga.player_id, tga.hint_data, tga.sort_order,
              tp.full_name, tp.aliases
       FROM trivia_game_answers tga
       JOIN trivia_players tp ON tp.id = tga.player_id
       WHERE tga.game_id = $1
       ORDER BY tga.sort_order ASC, tga.id ASC`,
      [gameId]
    );

    return json(res.rows);
  } finally {
    await db.end();
  }
}

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const { gameId, playerId, hintData = {}, sortOrder = 0 } = await request.json();
    if (!gameId || !playerId) throw error(400, 'gameId and playerId required');

    const res = await db.query(
      `INSERT INTO trivia_game_answers (game_id, player_id, hint_data, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id, player_id) DO UPDATE
         SET hint_data = EXCLUDED.hint_data, sort_order = EXCLUDED.sort_order
       RETURNING id, game_id, player_id, hint_data, sort_order`,
      [gameId, playerId, hintData, sortOrder]
    );

    return json(res.rows[0], { status: 201 });
  } finally {
    await db.end();
  }
}

export async function DELETE({ url, cookies }) {
  const id = url.searchParams.get('id');
  if (!id) throw error(400, 'id required');

  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    await db.query('DELETE FROM trivia_game_answers WHERE id = $1', [id]);
    return json({ success: true });
  } finally {
    await db.end();
  }
}
