import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function GET({ url }) {
  const week = parseInt(url.searchParams.get('week') ?? '');
  const year = parseInt(url.searchParams.get('year') ?? '') || new Date().getFullYear();
  const weekType = url.searchParams.get('weekType') || url.searchParams.get('week_type') || null;

  if (!week) throw error(400, 'week parameter required');

  const db = await createClient();
  try {
    const cond = weekType
      ? 'g.season_year = $1 AND g.week_number = $2 AND g.week_type = $3'
      : 'g.season_year = $1 AND g.week_number = $2';
    const params = weekType ? [year, week, weekType] : [year, week];

    const [gamesRes, picksRes] = await Promise.all([
      db.query(
        `SELECT id, home_team, home_team_abbr, home_team_logo, home_score,
                away_team, away_team_abbr, away_team_logo, away_score,
                game_time, game_status, winner
         FROM games WHERE ${cond.replace('g.', '')} ORDER BY game_time`,
        params
      ),
      db.query(
        `SELECT p.user_id, p.game_id, p.predicted_winner, p.is_correct,
                u.display_name, u.primary_color
         FROM picks p
         JOIN games g ON p.game_id = g.id
         JOIN users u ON p.user_id = u.id
         WHERE ${cond} AND p.league_id = 1
         ORDER BY u.display_name`,
        params
      )
    ]);

    const games = gamesRes.rows;

    const userMap = {};
    for (const row of picksRes.rows) {
      if (!userMap[row.user_id]) {
        userMap[row.user_id] = {
          userId: row.user_id,
          displayName: row.display_name,
          primaryColor: row.primary_color,
          picks: {}
        };
      }
      userMap[row.user_id].picks[row.game_id] = {
        predictedWinner: row.predicted_winner,
        isCorrect: row.is_correct
      };
    }

    const users = Object.values(userMap).map(u => ({
      ...u,
      correct: Object.values(u.picks).filter(p => p.isCorrect === true).length,
      total: Object.values(u.picks).length
    })).sort((a, b) => b.correct - a.correct || a.displayName.localeCompare(b.displayName));

    return json({ games, users });
  } finally {
    await db.end();
  }
}
