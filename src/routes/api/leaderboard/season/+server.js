import { json } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function GET({ url }) {
  const year = parseInt(url.searchParams.get('year') ?? '') || new Date().getFullYear();
  const leagueId = parseInt(url.searchParams.get('leagueId') ?? '') || 1;

  const db = await createClient();
  try {
    const res = await db.query(
      `SELECT u.id as user_id, u.username, u.display_name, u.primary_color,
              COUNT(CASE WHEN p.is_correct = true  THEN 1 END)::int as total_wins,
              COUNT(CASE WHEN p.is_correct = false THEN 1 END)::int as total_losses,
              COUNT(CASE WHEN p.is_correct = true  THEN 1 END)::int as total_points,
              RANK() OVER (ORDER BY COUNT(CASE WHEN p.is_correct = true THEN 1 END) DESC)::int as rank
       FROM league_members lm
       JOIN users u ON lm.user_id = u.id
       LEFT JOIN picks p ON u.id = p.user_id AND p.league_id = lm.league_id
       LEFT JOIN games g ON p.game_id = g.id AND g.season_year = $1
       WHERE lm.league_id = $2
       GROUP BY u.id, u.username, u.display_name, u.primary_color
       ORDER BY total_points DESC, u.display_name`,
      [year, leagueId]
    );
    return json({ data: res.rows });
  } finally {
    await db.end();
  }
}
