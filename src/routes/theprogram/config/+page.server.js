import { createClient } from '$lib/server/db.js';
import { PHOTO_TYPES } from '$lib/server/theprogram/config-sync.js';

// Each Config section now saves independently via its own endpoint:
//   POST /theprogram/config/conferences | schools | photos
//   POST/PUT/DELETE /theprogram/config/player-rankings
//   POST /theprogram/config/school-priority

export async function load() {
  const db = await createClient();
  try {
    // Safety net: make sure the new columns exist (no-op if they already do).
    await db.query(`
      ALTER TABLE program_photos
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7),
        ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7)
    `).catch(() => {});

    const [confRes, schoolRes, photoRes, rankingsRes, schoolPriRes, allSchoolsRes] = await Promise.all([
      db.query(`SELECT id, name FROM program_conferences ORDER BY name ASC`),
      db.query(`SELECT id, name, conference FROM program_schools ORDER BY conference ASC, name ASC`),
      db.query(
        `SELECT id, type, school, image_url, google_file_id,
                primary_color, secondary_color
           FROM program_photos
          ORDER BY type ASC, school ASC NULLS LAST`
      ),
      db.query(
        `SELECT id, player_name, tier, rank, updated_at
           FROM program_player_rankings
          ORDER BY tier ASC, rank ASC, player_name ASC`
      ).catch(() => ({ rows: [] })),
      db.query(
        `SELECT id, school_name, priority FROM program_school_priority
          ORDER BY priority ASC`
      ).catch(() => ({ rows: [] })),
      // Union of every school name we've ever seen — drives the School
      // Priority drag list so it works even when program_schools is
      // empty (older shows ran straight off program_photos + odds strings).
      db.query(`
        SELECT DISTINCT school AS name FROM (
          SELECT name AS school FROM program_schools
          UNION
          SELECT school FROM program_photos
            WHERE school IS NOT NULL AND TRIM(school) <> ''
          UNION
          SELECT school FROM program_roll_events
            WHERE school IS NOT NULL AND TRIM(school) <> ''
          UNION
          SELECT committed_school FROM program_roll_events
            WHERE committed_school IS NOT NULL AND TRIM(committed_school) <> ''
        ) u
        ORDER BY school ASC
      `).catch(() => ({ rows: [] }))
    ]);
    return {
      conferences: confRes.rows,
      schools: schoolRes.rows,
      photos: photoRes.rows,
      photoTypes: PHOTO_TYPES,
      playerRankings: rankingsRes.rows,
      schoolPriority: schoolPriRes.rows,
      schoolsForPriority: allSchoolsRes.rows.map(r => r.name)
    };
  } finally {
    await db.end();
  }
}
