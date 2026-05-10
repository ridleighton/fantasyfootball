import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

async function getUser(cookies, db) {
  const supabase = serverSupabase(cookies);
  const { data } = await supabase.auth.getSession(); const session = data?.session;
  if (!session) return null;
  const res = await db.query('SELECT id FROM users WHERE supabase_uid = $1', [session.user.id]);
  return res.rows[0] ?? null;
}

function normalize(str) {
  return (str ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    const user = await getUser(cookies, db);
    if (!user) throw error(401, 'Unauthorized');

    const body = await request.json();
    const { gameId, guess, foundIds = [] } = body;

    if (!gameId || typeof guess !== 'string') throw error(400, 'gameId and guess required');

    const normalizedGuess = normalize(guess);
    if (!normalizedGuess) return json({ matched: false });

    // Fetch all answers with player info for this game
    const res = await db.query(
      `SELECT tga.id AS slot_id, tp.id AS player_id, tp.full_name, tp.aliases
       FROM trivia_game_answers tga
       JOIN trivia_players tp ON tp.id = tga.player_id
       WHERE tga.game_id = $1`,
      [gameId]
    );

    for (const row of res.rows) {
      // Skip already found slots
      if (foundIds.includes(row.slot_id)) continue;

      const normalizedName = normalize(row.full_name);
      const normalizedAliases = (row.aliases ?? []).map(a => normalize(a));

      // Exact match on full name
      if (normalizedGuess === normalizedName) {
        return json({
          matched: true,
          playerId: row.player_id,
          playerName: row.full_name,
          slotId: row.slot_id
        });
      }

      // Exact match on any alias
      if (normalizedAliases.includes(normalizedGuess)) {
        return json({
          matched: true,
          playerId: row.player_id,
          playerName: row.full_name,
          slotId: row.slot_id
        });
      }

      // Partial match: guess starts the name or alias (min 3 chars)
      if (normalizedGuess.length >= 3) {
        if (normalizedName.startsWith(normalizedGuess)) {
          return json({
            matched: true,
            playerId: row.player_id,
            playerName: row.full_name,
            slotId: row.slot_id
          });
        }
        for (const alias of normalizedAliases) {
          if (alias.startsWith(normalizedGuess)) {
            return json({
              matched: true,
              playerId: row.player_id,
              playerName: row.full_name,
              slotId: row.slot_id
            });
          }
        }
      }
    }

    return json({ matched: false });
  } finally {
    await db.end();
  }
}
