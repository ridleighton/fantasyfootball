import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

const WEEK_TYPE_ORDER = { regular: 0, wildcard: 1, divisional: 2, conference: 3, superbowl: 4 };
const ESPN_STATUS_MAP = {
  STATUS_SCHEDULED: 'scheduled', STATUS_IN_PROGRESS: 'in_progress',
  STATUS_FINAL: 'final', STATUS_HALFTIME: 'in_progress',
  STATUS_END_PERIOD: 'in_progress', STATUS_DELAYED: 'scheduled',
  STATUS_POSTPONED: 'scheduled', STATUS_CANCELED: 'final',
  STATUS_SUSPENDED: 'in_progress'
};

async function requireAdmin(cookies, db) {
  const supabase = serverSupabase(cookies);
  const { data } = await supabase.auth.getSession(); const session = data?.session;
  if (!session) throw error(401, 'Unauthorized');
  const res = await db.query('SELECT is_admin, is_commissioner FROM users WHERE supabase_uid = $1', [session.user.id]);
  const u = res.rows[0];
  if (!u?.is_admin && !u?.is_commissioner) throw error(403, 'Forbidden');
}

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    await requireAdmin(cookies, db);

    const { week, year, weekType = 'regular' } = await request.json();
    const currentYear = year || new Date().getFullYear();

    let seasonType = weekType === 'regular' ? 2 : 3;
    const playoffWeekMap = { wildcard: 1, divisional: 2, conference: 3, superbowl: 4 };
    const espnWeek = weekType === 'regular' ? (week || 1) : (playoffWeekMap[weekType] || 1);

    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${currentYear}&seasontype=${seasonType}&week=${espnWeek}`;
    const espnRes = await fetch(espnUrl);
    if (!espnRes.ok) throw error(502, 'Failed to fetch from ESPN');

    const espnData = await espnRes.json();
    const events = espnData.events ?? [];

    let synced = 0;
    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors?.find(c => c.homeAway === 'home');
      const away = comp.competitors?.find(c => c.homeAway === 'away');
      if (!home || !away) continue;

      const statusType = comp.status?.type?.name ?? 'STATUS_SCHEDULED';
      const gameStatus = ESPN_STATUS_MAP[statusType] ?? 'scheduled';
      const homeScore = home.score ? parseInt(home.score) : null;
      const awayScore = away.score ? parseInt(away.score) : null;

      let winner = null;
      if (gameStatus === 'final') {
        if (homeScore > awayScore) winner = 'home';
        else if (awayScore > homeScore) winner = 'away';
      }

      const weekNumber = weekType === 'regular' ? (week || 1) : (playoffWeekMap[weekType] || 1);

      await db.query(
        `INSERT INTO games (api_game_id, season_year, week_number, week_type,
           home_team, home_team_abbr, home_team_logo, home_score,
           away_team, away_team_abbr, away_team_logo, away_score,
           game_time, game_status, winner)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (api_game_id) DO UPDATE SET
           home_score = EXCLUDED.home_score,
           away_score = EXCLUDED.away_score,
           game_status = EXCLUDED.game_status,
           winner = EXCLUDED.winner`,
        [
          event.id, currentYear, weekNumber, weekType,
          home.team?.displayName, home.team?.abbreviation, home.team?.logo, homeScore,
          away.team?.displayName, away.team?.abbreviation, away.team?.logo, awayScore,
          new Date(event.date), gameStatus, winner
        ]
      );

      // Update pick correctness for finished games
      if (winner) {
        await db.query(
          `UPDATE picks SET is_correct = (predicted_winner = $1)
           WHERE game_id = (SELECT id FROM games WHERE api_game_id = $2)`,
          [winner, event.id]
        );
      }

      synced++;
    }

    return json({ synced, message: `Synced ${synced} games` });
  } finally {
    await db.end();
  }
}
