import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';
import { env } from '$env/dynamic/private';

async function getAdminUser(cookies, db) {
  const supabase = serverSupabase(cookies);
  const { data } = await supabase.auth.getSession(); const session = data?.session;
  if (!session) return null;
  const res = await db.query(
    'SELECT id, is_admin FROM users WHERE supabase_uid = $1',
    [session.user.id]
  );
  const user = res.rows[0];
  if (!user?.is_admin) return null;
  return user;
}

async function upsertPlayers(db, databaseId, players) {
  let inserted = 0;
  let updated = 0;

  for (const p of players) {
    const { full_name, aliases = [], metadata = {}, api_player_id = null } = p;
    if (!full_name) continue;

    if (api_player_id) {
      const res = await db.query(
        `INSERT INTO trivia_players (database_id, full_name, aliases, metadata, api_player_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (api_player_id, database_id) DO UPDATE
           SET full_name = EXCLUDED.full_name,
               aliases   = EXCLUDED.aliases,
               metadata  = EXCLUDED.metadata
         RETURNING (xmax = 0) AS is_insert`,
        [databaseId, full_name, aliases, metadata, api_player_id]
      );
      if (res.rows[0]?.is_insert) inserted++; else updated++;
    } else {
      await db.query(
        `INSERT INTO trivia_players (database_id, full_name, aliases, metadata)
         VALUES ($1, $2, $3, $4)`,
        [databaseId, full_name, aliases, metadata]
      );
      inserted++;
    }
  }

  return { inserted, updated };
}

// Fetch all players for one season by iterating all teams.
// The /players/statistics endpoint requires (team + season) — there is no league filter.
async function importSeason(leagueId, season, apiKey) {
  const headers = { 'x-apisports-key': apiKey };
  const base = 'https://v1.american-football.api-sports.io';

  // Step 1: all teams for this league + season
  const teamsResp = await fetch(`${base}/teams?league=${leagueId}&season=${season}`, { headers });
  if (!teamsResp.ok) throw error(502, `API returned ${teamsResp.status} fetching teams`);

  const teamsData = await teamsResp.json();
  if (teamsData.errors && Object.keys(teamsData.errors).length > 0) {
    const msg = Object.values(teamsData.errors).join('; ');
    throw error(502, `API error: ${msg}`);
  }

  const teams = teamsData.response ?? [];
  if (teams.length === 0) return new Map();

  // Step 2: player statistics per team — deduplicate across teams by api_player_id
  const players = new Map();

  for (const teamEntry of teams) {
    const teamId = teamEntry.team?.id;
    const teamName = teamEntry.team?.name;
    if (!teamId) continue;

    const statsResp = await fetch(
      `${base}/players/statistics?team=${teamId}&season=${season}`,
      { headers }
    );
    if (!statsResp.ok) continue;

    const statsData = await statsResp.json();
    for (const entry of statsData.response ?? []) {
      const player = entry.player ?? {};
      const playerId = player.id;
      if (!playerId) continue;

      const fullName = [player.firstname, player.lastname].filter(Boolean).join(' ');
      if (!fullName) continue;

      if (!players.has(playerId)) {
        players.set(playerId, {
          full_name: fullName,
          aliases: [],
          api_player_id: playerId,
          metadata: { position: player.position ?? null, teams: [], seasons: [] }
        });
      }

      const rec = players.get(playerId);
      if (teamName && !rec.metadata.teams.includes(teamName)) rec.metadata.teams.push(teamName);
      const seasonStr = String(season);
      if (!rec.metadata.seasons.includes(seasonStr)) rec.metadata.seasons.push(seasonStr);
    }
  }

  return players;
}

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const body = await request.json();
    const { databaseId, importType, season, allSeasons, players } = body;
    if (!databaseId) throw error(400, 'databaseId required');

    let result;

    if (importType === 'api') {
      const dbRes = await db.query(
        'SELECT api_league_id FROM trivia_databases WHERE id = $1',
        [databaseId]
      );
      if (dbRes.rows.length === 0) throw error(404, 'Database not found');
      const leagueId = dbRes.rows[0].api_league_id;
      if (!leagueId) throw error(400, 'Database has no api_league_id configured');

      const apiKey = env.SPORTSIO_APIKEY ?? '';
      if (!apiKey) throw error(500, 'SPORTSIO_APIKEY not configured');

      if (allSeasons) {
        // Import all available seasons (API data starts at 2022)
        const currentYear = new Date().getFullYear();
        // NFL season year = calendar year the season starts; go back to 2022
        const seasons = [];
        for (let y = 2022; y <= currentYear; y++) seasons.push(y);

        const merged = new Map();
        for (const s of seasons) {
          const seasonPlayers = await importSeason(leagueId, s, apiKey);
          for (const [id, rec] of seasonPlayers) {
            if (!merged.has(id)) {
              merged.set(id, rec);
            } else {
              // Merge teams and seasons from later season runs
              const existing = merged.get(id);
              for (const t of rec.metadata.teams) {
                if (!existing.metadata.teams.includes(t)) existing.metadata.teams.push(t);
              }
              for (const sv of rec.metadata.seasons) {
                if (!existing.metadata.seasons.includes(sv)) existing.metadata.seasons.push(sv);
              }
            }
          }
        }
        result = await upsertPlayers(db, databaseId, Array.from(merged.values()));
      } else {
        if (!season) throw error(400, 'season required for api import');
        const seasonPlayers = await importSeason(leagueId, season, apiKey);
        result = await upsertPlayers(db, databaseId, Array.from(seasonPlayers.values()));
      }

    } else if (Array.isArray(players)) {
      result = await upsertPlayers(db, databaseId, players);
    } else {
      throw error(400, 'Either players array or importType=api + season/allSeasons required');
    }

    return json({ success: true, ...result });
  } finally {
    await db.end();
  }
}
