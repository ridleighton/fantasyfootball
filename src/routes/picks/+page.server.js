import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent }) {
  const { session, profile } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const db = await createClient();
  try {
    const now = new Date();

    // Current week (same logic as home page)
    const weekRes = await db.query(
      `SELECT week_number, season_year, week_type,
              CASE week_type
                WHEN 'regular'    THEN 0 WHEN 'wildcard'   THEN 1
                WHEN 'divisional' THEN 2 WHEN 'conference' THEN 3
                WHEN 'superbowl'  THEN 4 ELSE 5
              END as type_order
       FROM games WHERE game_time <= $1
       ORDER BY season_year DESC, type_order DESC, week_number DESC LIMIT 1`,
      [now]
    );
    const currentWeek = weekRes.rows[0] ?? {
      week_number: 1,
      season_year: now.getFullYear(),
      week_type: 'regular'
    };

    // All games for this week
    const gamesRes = await db.query(
      `SELECT id, season_year, week_number, week_type,
              home_team, home_team_abbr, home_team_logo, home_score,
              away_team, away_team_abbr, away_team_logo, away_score,
              game_time, game_status, winner
       FROM games
       WHERE season_year = $1 AND week_number = $2 AND week_type = $3
       ORDER BY game_time`,
      [currentWeek.season_year, currentWeek.week_number, currentWeek.week_type]
    );

    // User's picks for this week
    const picksRes = await db.query(
      `SELECT p.game_id, p.predicted_winner, p.is_correct
       FROM picks p
       JOIN games g ON p.game_id = g.id
       WHERE p.user_id = $1 AND p.league_id = 1
         AND g.season_year = $2 AND g.week_number = $3 AND g.week_type = $4`,
      [profile.id, currentWeek.season_year, currentWeek.week_number, currentWeek.week_type]
    );

    const pickMap = {};
    for (const p of picksRes.rows) {
      pickMap[p.game_id] = { predictedWinner: p.predicted_winner, isCorrect: p.is_correct };
    }

    return {
      week: {
        number: currentWeek.week_number,
        year: currentWeek.season_year,
        type: currentWeek.week_type
      },
      games: gamesRes.rows,
      picks: pickMap
    };
  } finally {
    await db.end();
  }
}
