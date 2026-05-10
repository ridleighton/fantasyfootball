import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent }) {
  const { session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const db = await createClient();
  try {
    // Current week
    const now = new Date();
    const weekRes = await db.query(
      `SELECT week_number, season_year, week_type,
              CASE week_type
                WHEN 'regular'     THEN 0 WHEN 'wildcard'   THEN 1
                WHEN 'divisional'  THEN 2 WHEN 'conference'  THEN 3
                WHEN 'superbowl'   THEN 4 ELSE 5
              END as type_order
       FROM games WHERE game_time <= $1
       ORDER BY season_year DESC, type_order DESC, week_number DESC LIMIT 1`,
      [now]
    );
    const currentWeek = weekRes.rows[0] ?? { week_number: 1, season_year: now.getFullYear(), week_type: 'regular' };

    // Leaderboard
    const boardRes = await db.query(
      `SELECT u.id as user_id, u.display_name, u.primary_color,
              COUNT(CASE WHEN p.is_correct = true  THEN 1 END)::int as wins,
              COUNT(CASE WHEN p.is_correct = false THEN 1 END)::int as losses,
              COUNT(CASE WHEN p.is_correct = true  THEN 1 END)::int as points,
              RANK() OVER (ORDER BY COUNT(CASE WHEN p.is_correct = true THEN 1 END) DESC)::int as rank
       FROM league_members lm
       JOIN users u ON lm.user_id = u.id
       LEFT JOIN picks p ON u.id = p.user_id AND p.league_id = lm.league_id
       LEFT JOIN games g ON p.game_id = g.id
         AND g.season_year = $1 AND g.week_number = $2 AND g.week_type = $3
       WHERE lm.league_id = 1
       GROUP BY u.id, u.display_name, u.primary_color
       ORDER BY points DESC, u.display_name`,
      [currentWeek.season_year, currentWeek.week_number, currentWeek.week_type]
    );

    return {
      week: { number: currentWeek.week_number, year: currentWeek.season_year, type: currentWeek.week_type },
      leaderboard: boardRes.rows
    };
  } finally {
    await db.end();
  }
}
