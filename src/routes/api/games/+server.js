import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function GET({ url }) {
  const week = parseInt(url.searchParams.get('week') ?? '');
  const year = parseInt(url.searchParams.get('year') ?? '') || new Date().getFullYear();
  const weekType = url.searchParams.get('weekType') || url.searchParams.get('week_type') || null;

  if (!week) throw error(400, 'week parameter required');

  const db = await createClient();
  try {
    const params = weekType ? [year, week, weekType] : [year, week];
    const cond = weekType
      ? 'WHERE season_year = $1 AND week_number = $2 AND week_type = $3'
      : 'WHERE season_year = $1 AND week_number = $2';

    const res = await db.query(
      `SELECT id, season_year, week_number, week_type,
              home_team, home_team_abbr, home_team_logo, home_score,
              away_team, away_team_abbr, away_team_logo, away_score,
              game_time, game_status, winner
       FROM games ${cond} ORDER BY game_time`,
      params
    );
    return json({ data: res.rows });
  } finally {
    await db.end();
  }
}
