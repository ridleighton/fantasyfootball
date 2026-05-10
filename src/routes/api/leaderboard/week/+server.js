import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function GET({ url }) {
  const week = parseInt(url.searchParams.get('week') ?? '');
  const year = parseInt(url.searchParams.get('year') ?? '') || new Date().getFullYear();
  const leagueId = parseInt(url.searchParams.get('leagueId') ?? '') || 1;
  const weekType = url.searchParams.get('weekType') || null;

  if (!week) throw error(400, 'week required');

  const db = await createClient();
  try {
    const hasType = !!weekType;
    const params = hasType ? [year, week, leagueId, weekType] : [year, week, leagueId];
    const typeJoin = hasType
      ? 'AND g.season_year = $1 AND g.week_number = $2 AND g.week_type = $4'
      : 'AND g.season_year = $1 AND g.week_number = $2';

    const res = await db.query(
      `SELECT u.id as user_id, u.username, u.display_name, u.primary_color,
              COUNT(CASE WHEN p.is_correct = true  THEN 1 END)::int as wins,
              COUNT(CASE WHEN p.is_correct = false THEN 1 END)::int as losses,
              COUNT(CASE WHEN p.is_correct = true  THEN 1 END)::int as points,
              RANK() OVER (ORDER BY COUNT(CASE WHEN p.is_correct = true THEN 1 END) DESC)::int as rank
       FROM league_members lm
       JOIN users u ON lm.user_id = u.id
       LEFT JOIN picks p ON u.id = p.user_id AND p.league_id = lm.league_id
       LEFT JOIN games g ON p.game_id = g.id ${typeJoin}
       WHERE lm.league_id = $3
       GROUP BY u.id, u.username, u.display_name, u.primary_color
       ORDER BY points DESC, u.display_name`,
      params
    );

    return json({ data: res.rows });
  } finally {
    await db.end();
  }
}
