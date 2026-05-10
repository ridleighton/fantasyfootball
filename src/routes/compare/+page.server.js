import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent }) {
  const { session, profile } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const db = await createClient();
  try {
    const now = new Date();

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

    // Available weeks for selector
    const weeksRes = await db.query(
      `SELECT season_year, week_number, week_type,
              CASE week_type
                WHEN 'regular'    THEN 0 WHEN 'wildcard'   THEN 1
                WHEN 'divisional' THEN 2 WHEN 'conference' THEN 3
                WHEN 'superbowl'  THEN 4 ELSE 5
              END as type_order
       FROM games
       GROUP BY season_year, week_number, week_type
       ORDER BY season_year DESC, type_order DESC, week_number DESC`
    );

    const compareData = await loadCompareData(db, profile.id, currentWeek);

    return {
      week: {
        number: currentWeek.week_number,
        year: currentWeek.season_year,
        type: currentWeek.week_type
      },
      availableWeeks: weeksRes.rows,
      userId: profile.id,
      ...compareData
    };
  } finally {
    await db.end();
  }
}

async function loadCompareData(db, userId, week) {
  const { week_number, season_year, week_type } = week;

  const [gamesRes, allPicksRes] = await Promise.all([
    db.query(
      `SELECT id, home_team, home_team_abbr, home_team_logo, home_score,
              away_team, away_team_abbr, away_team_logo, away_score,
              game_time, game_status, winner
       FROM games
       WHERE season_year = $1 AND week_number = $2 AND week_type = $3
       ORDER BY game_time`,
      [season_year, week_number, week_type]
    ),
    db.query(
      `SELECT p.user_id, p.game_id, p.predicted_winner, p.is_correct,
              u.display_name, u.primary_color
       FROM picks p
       JOIN games g ON p.game_id = g.id
       JOIN users u ON p.user_id = u.id
       WHERE g.season_year = $1 AND g.week_number = $2 AND g.week_type = $3
         AND p.league_id = 1
       ORDER BY u.display_name`,
      [season_year, week_number, week_type]
    )
  ]);

  const games = gamesRes.rows;

  // Group picks by user
  const userMap = {};
  for (const row of allPicksRes.rows) {
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

  const users = Object.values(userMap).sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Score each user
  for (const u of users) {
    u.correct = Object.values(u.picks).filter(p => p.isCorrect === true).length;
    u.total = Object.values(u.picks).length;
  }

  users.sort((a, b) => b.correct - a.correct || a.displayName.localeCompare(b.displayName));

  return { games, users };
}
