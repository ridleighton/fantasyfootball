import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

async function getUserId(cookies, db) {
  const supabase = serverSupabase(cookies);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const res = await db.query('SELECT id FROM users WHERE supabase_uid = $1', [session.user.id]);
  return res.rows[0]?.id ?? null;
}

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    const userId = await getUserId(cookies, db);
    if (!userId) throw error(401, 'Unauthorized');

    const { picks } = await request.json();
    if (!Array.isArray(picks) || picks.length === 0) throw error(400, 'picks array required');

    const submitted = [];
    const skipped = [];

    for (const pick of picks) {
      const { gameId, predictedWinner, leagueId } = pick;
      if (!gameId || !predictedWinner || !leagueId) { skipped.push({ gameId, reason: 'missing_data' }); continue; }

      const gameRes = await db.query('SELECT game_status FROM games WHERE id = $1', [gameId]);
      if (gameRes.rows.length === 0) { skipped.push({ gameId, reason: 'not_found' }); continue; }

      const status = gameRes.rows[0].game_status;
      if (!['scheduled', 'pre', 'status_scheduled'].includes(status)) {
        skipped.push({ gameId, reason: 'game_started', status }); continue;
      }

      const upsert = await db.query(
        `INSERT INTO picks (user_id, game_id, league_id, predicted_winner, picked_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, game_id, league_id)
         DO UPDATE SET predicted_winner = $4, picked_at = NOW()
         RETURNING id`,
        [userId, gameId, leagueId, predictedWinner]
      );
      submitted.push(upsert.rows[0].id);
    }

    return json({ submitted: submitted.length, skipped, message: `${submitted.length} pick(s) saved` });
  } finally {
    await db.end();
  }
}
