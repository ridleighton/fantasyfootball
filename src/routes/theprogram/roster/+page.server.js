import { createClient } from '$lib/server/db.js';
import { resolvePhotos, helmetForSchool, colorsForSchool } from '$lib/server/theprogram/show.js';
import { ACTIVE_LIMIT } from '$lib/server/theprogram/roster.js';

// Cross-week roster page. Not gated on an active week. Tolerates the
// program_roster table not existing yet (db/program-roster.sql unrun).
export async function load() {
  const db = await createClient();
  try {
    const [schoolRes, confRes, rosterRes, weekRes] = await Promise.all([
      db.query(`SELECT name, conference FROM program_schools ORDER BY name ASC`).catch(() => ({ rows: [] })),
      db.query(`SELECT name FROM program_conferences ORDER BY name ASC`).catch(() => ({ rows: [] })),
      db.query(
        `SELECT id, school_name, player_name, conference, status, source,
                week_id, roll_event_id, added_at, revoked_at, revoke_reason
           FROM program_roster
          ORDER BY player_name ASC`
      ).catch(() => ({ rows: [] })),
      db.query(`SELECT id, week_number FROM program_weeks`).catch(() => ({ rows: [] }))
    ]);

    const photos = await resolvePhotos(db, schoolRes.rows.map(r => r.name)).catch(() => ({ schoolHelmets: {} }));
    const helmets = {};
    const colors = {};
    for (const s of schoolRes.rows) {
      helmets[s.name] = helmetForSchool(photos, s.name);
      colors[s.name] = colorsForSchool(photos, s.name);
    }

    const weekMap = {};
    for (const w of weekRes.rows) weekMap[w.id] = w.week_number;

    return {
      schools: schoolRes.rows,
      conferences: confRes.rows.map(r => r.name),
      roster: rosterRes.rows,
      weekMap,
      helmets,
      colors,
      activeLimit: ACTIVE_LIMIT
    };
  } finally {
    await db.end();
  }
}
