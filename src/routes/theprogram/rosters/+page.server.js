import { createClient } from '$lib/server/db.js';

const FALLBACK_CONFERENCES = ['C1', 'C2', 'C3', 'C4', 'C5'];

// Standing school rosters, grouped for the per-conference subtabs. Not
// week-scoped. Tolerates the program_rosters table not existing yet
// (db/program-rosters.sql hasn't been run) so the page still loads.
export async function load() {
  const db = await createClient();
  try {
    const [confRes, schoolRes, rosterRes] = await Promise.all([
      db.query(`SELECT name FROM program_conferences ORDER BY name ASC`)
        .catch(() => ({ rows: [] })),
      db.query(`SELECT name, conference FROM program_schools ORDER BY conference ASC, name ASC`)
        .catch(() => ({ rows: [] })),
      db.query(
        `SELECT id, school_name, conference, player_name, position, status, locked,
                inactive_reason, week_added
           FROM program_rosters
          ORDER BY school_name ASC, player_name ASC`
      ).catch(() => ({ rows: [] }))
    ]);

    const conferences = confRes.rows.length
      ? confRes.rows.map(r => r.name)
      : FALLBACK_CONFERENCES;

    return {
      conferences,
      schools: schoolRes.rows, // [{ name, conference }]
      rosters: rosterRes.rows
    };
  } finally {
    await db.end();
  }
}
