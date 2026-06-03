import { fail } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { getRosterCounts, ACTIVE_LIMIT } from '$lib/server/theprogram/roster.js';

const TYPES = ['Auto-Commit', 'Steal', 'Commit'];

function normalizeBool(v) {
  if (v === true || v === false) return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === '' || s === 'null') return null;
  if (s === 'true' || s === 'yes' || s === 'y' || s === '1') return true;
  if (s === 'false' || s === 'no' || s === 'n' || s === '0') return false;
  return null;
}

function nullable(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export async function load() {
  const { weekId, weekNumber } = await requireActiveWeek();
  const db = await createClient();
  try {
    const [rowsRes, confRes, coachRes, schoolsRes, schoolPriRes, allSchoolsRes] = await Promise.all([
      db.query(
        `SELECT id, conference, type, player, school, locked, in_original_roll,
                odds, result, committed_school
           FROM program_roll_events
          WHERE week_id = $1
          ORDER BY id ASC`,
        [weekId]
      ),
      db.query(`SELECT name FROM program_conferences ORDER BY name ASC`),
      // program_coach_priority_lists is added by db/program-priority.sql;
      // tolerate its absence so the page still loads if the SQL hasn't
      // been run yet.
      db.query(
        `SELECT id, school_name, player_name, conference, priority, submitted_at
           FROM program_coach_priority_lists
          WHERE week_id = $1
          ORDER BY school_name, priority`,
        [weekId]
      ).catch(() => ({ rows: [] })),
      db.query(`SELECT name FROM program_schools ORDER BY name ASC`).catch(() => ({ rows: [] })),
      // Standing school priority (drag list). Position = priority.
      db.query(
        `SELECT id, school_name, priority FROM program_school_priority
          ORDER BY priority ASC`
      ).catch(() => ({ rows: [] })),
      // Union of every school name we've ever seen — drives the School
      // Priority drag list even when program_schools is sparse.
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

    // Active-roster counts for the read-only Capacity column (lowercased keys).
    const rcRaw = await getRosterCounts(db).catch(() => new Map());
    const rosterCounts = {};
    for (const [k, v] of rcRaw) rosterCounts[k.toLowerCase()] = v;

    return {
      weekId,
      weekNumber,
      rows: rowsRes.rows,
      conferences: confRes.rows.map(r => r.name),
      types: TYPES,
      coachPriorities: coachRes.rows,
      schools: schoolsRes.rows.map(r => r.name),
      schoolPriority: schoolPriRes.rows,
      schoolsForPriority: allSchoolsRes.rows.map(r => r.name),
      rosterCounts,
      activeLimit: ACTIVE_LIMIT
    };
  } finally {
    await db.end();
  }
}

export const actions = {
  default: async ({ request }) => {
    const { weekId } = await requireActiveWeek();
    const form = await request.formData();
    const payload = form.get('rows');
    if (!payload) return fail(400, { message: 'Missing rows payload.' });

    let rows;
    try {
      rows = JSON.parse(payload.toString());
      if (!Array.isArray(rows)) throw new Error('rows must be an array');
    } catch (e) {
      return fail(400, { message: `Invalid payload: ${e.message}` });
    }

    const db = await createClient();
    try {
      await db.query('BEGIN');

      const existingRes = await db.query(
        `SELECT id FROM program_roll_events WHERE week_id = $1`,
        [weekId]
      );
      const existingIds = new Set(existingRes.rows.map(r => Number(r.id)));
      const keptIds = new Set();

      for (const r of rows) {
        const conference = nullable(r.conference);
        const type = nullable(r.type);
        const player = nullable(r.player);
        const school = nullable(r.school);
        const locked = normalizeBool(r.locked);
        const inOriginal = normalizeBool(r.in_original_roll);
        const odds = nullable(r.odds);
        const result = nullable(r.result);
        const committed = nullable(r.committed_school);

        // Skip entirely empty rows
        if (!conference && !type && !player && !school && !odds && !result && !committed) continue;

        const idNum = Number.parseInt(r.id, 10);
        if (Number.isInteger(idNum) && existingIds.has(idNum)) {
          keptIds.add(idNum);
          await db.query(
            `UPDATE program_roll_events
                SET conference = $1, type = $2, player = $3, school = $4,
                    locked = $5, in_original_roll = $6, odds = $7,
                    result = $8, committed_school = $9, updated_at = NOW()
              WHERE id = $10 AND week_id = $11`,
            [conference, type, player, school, locked, inOriginal, odds, result, committed, idNum, weekId]
          );
        } else {
          await db.query(
            `INSERT INTO program_roll_events
               (week_id, conference, type, player, school, locked, in_original_roll, odds, result, committed_school)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [weekId, conference, type, player, school, locked, inOriginal, odds, result, committed]
          );
        }
      }

      // Delete rows the client removed
      const toDelete = [...existingIds].filter(id => !keptIds.has(id));
      if (toDelete.length > 0) {
        await db.query(
          `DELETE FROM program_roll_events WHERE week_id = $1 AND id = ANY($2::int[])`,
          [weekId, toDelete]
        );
      }

      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK').catch(() => {});
      return fail(500, { message: `Save failed: ${e.message}` });
    } finally {
      await db.end();
    }

    return { success: true, savedAt: new Date().toISOString() };
  }
};
