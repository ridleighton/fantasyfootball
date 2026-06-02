import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

const STATUSES = ['active', 'inactive'];

// Parse the wide roster grid pasted from a spreadsheet. Layout:
//   row 1: school names, one per *pair* of tab-separated columns
//          (col 0 = school A's players, col 1 = school A's positions, ...)
//   row 2: repeated "Player  Pos" header (skipped)
//   rows : player name + position aligned under each school
//   tail : "Total / QB / RB / ..." summary rows (skipped)
// Returns [{ school, player, position }].
function parseRosterGrid(text) {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split('\t');
  const schoolCols = []; // { school, col } — player at col, position at col+1
  for (let c = 0; c < header.length; c += 2) {
    const name = (header[c] ?? '').trim();
    if (name) schoolCols.push({ school: name, col: c });
  }
  if (schoolCols.length === 0) return [];

  const out = [];
  const summaryWords = /^(total|qb|rb|wr|te|ath|ol|dl|db|lb|s|cb|k|p|atedh)$/i;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t');
    const first = (cells[0] ?? '').trim();
    if (/^total$/i.test(first)) break;          // start of summary block
    if (/^player$/i.test(first)) continue;       // repeated header row
    if (summaryWords.test(first) && (cells[1] ?? '').trim() !== '' && !Number.isNaN(Number(cells[1]))) {
      // a position-count summary row like "QB  2  QB  1 ..." — skip
      continue;
    }
    for (const sc of schoolCols) {
      const player = (cells[sc.col] ?? '').trim();
      const position = (cells[sc.col + 1] ?? '').trim();
      if (player && !/^player$/i.test(player)) {
        out.push({ school: sc.school, player, position: position || null });
      }
    }
  }
  return out;
}

// Returns the active week number (or null) without redirecting.
async function activeWeekNumber(db) {
  const res = await db.query(
    `SELECT w.week_number FROM program_active_week aw
       LEFT JOIN program_weeks w ON w.id = aw.week_id WHERE aw.id = 1`
  ).catch(() => ({ rows: [] }));
  return res.rows[0]?.week_number ?? null;
}

// Map of lower(school name) -> conference, from Config.
async function schoolConfMap(db) {
  const res = await db.query(`SELECT name, conference FROM program_schools`).catch(() => ({ rows: [] }));
  return new Map(res.rows.map(r => [r.name.toLowerCase(), r.conference]));
}

// POST — two modes:
//   1) bulk import:  { paste: "<tab-separated grid>" }
//   2) single entry: { school, conference, player, status?, locked?, inactive_reason?, position?, week_added? }
// Both upsert on (school, player). week_added is set once, at creation.
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (!body) throw error(400, 'Body must be JSON.');

  const db = await createClient();
  try {
    // ---- Bulk grid import ----
    if (typeof body.paste === 'string') {
      const parsed = parseRosterGrid(body.paste);
      if (parsed.length === 0) {
        throw error(400, 'No players found in the pasted grid.');
      }
      const confMap = await schoolConfMap(db);
      const wk = await activeWeekNumber(db);
      const unknownSchools = new Set();
      let count = 0;

      await db.query('BEGIN');
      try {
        for (const r of parsed) {
          const conf = confMap.get(r.school.toLowerCase()) ?? null;
          if (conf == null) unknownSchools.add(r.school);
          await db.query(
            `INSERT INTO program_rosters
               (school_name, conference, player_name, position, status, locked, week_added)
             VALUES ($1, $2, $3, $4, 'active', false, $5)
             ON CONFLICT (LOWER(school_name), LOWER(player_name))
             DO UPDATE SET conference = COALESCE(EXCLUDED.conference, program_rosters.conference),
                           position = EXCLUDED.position,
                           updated_at = NOW()`,
            [r.school, conf, r.player, r.position, wk]
          );
          count++;
        }
        await db.query('COMMIT');
      } catch (e) {
        await db.query('ROLLBACK').catch(() => {});
        throw error(500, `Import failed: ${e.message}`);
      }
      return json({ ok: true, imported: count, unknownSchools: [...unknownSchools] });
    }

    // ---- Single entry ----
    const school = String(body.school ?? '').trim();
    const conference = String(body.conference ?? '').trim() || null;
    const player = String(body.player ?? '').trim();
    if (!school || !player) throw error(400, 'school and player are required.');

    const status = STATUSES.includes(body.status) ? body.status : 'active';
    const locked = status === 'active' ? Boolean(body.locked) : false;
    const inactiveReason = status === 'inactive'
      ? (body.inactive_reason ? String(body.inactive_reason).trim() : null)
      : null;
    const position = body.position ? String(body.position).trim() : null;

    let weekAdded = Number.isInteger(body.week_added) ? body.week_added : null;
    if (weekAdded == null) weekAdded = await activeWeekNumber(db);

    const res = await db.query(
      `INSERT INTO program_rosters
         (school_name, conference, player_name, position, status, locked, inactive_reason, week_added)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (LOWER(school_name), LOWER(player_name))
       DO UPDATE SET conference = EXCLUDED.conference,
                     position = EXCLUDED.position,
                     status = EXCLUDED.status,
                     locked = EXCLUDED.locked,
                     inactive_reason = EXCLUDED.inactive_reason,
                     updated_at = NOW()
       RETURNING id, school_name, conference, player_name, position, status,
                 locked, inactive_reason, week_added`,
      [school, conference, player, position, status, locked, inactiveReason, weekAdded]
    );
    return json({ ok: true, row: res.rows[0] });
  } catch (e) {
    if (e.status) throw e;
    throw error(500, `Could not save roster: ${e.message}`);
  } finally {
    await db.end();
  }
}

// DELETE — remove a roster entry by id.
export async function DELETE({ request }) {
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.id)) throw error(400, 'Body must be { id }.');

  const db = await createClient();
  try {
    await db.query(`DELETE FROM program_rosters WHERE id = $1`, [body.id]);
    return json({ ok: true });
  } catch (e) {
    throw error(500, `Could not delete roster entry: ${e.message}`);
  } finally {
    await db.end();
  }
}
