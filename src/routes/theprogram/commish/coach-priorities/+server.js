import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { parseCsv } from '$lib/server/theprogram/csv.js';

// POST body — either:
//   { csv: "School,Player,Conference,Priority\n..." }     // upload / paste
//   { rows: [{school, player, conference, priority}] }    // explicit
// Scoped to the active week. Rows are upserted on
// (week_id, school_name, player_name, conference).
//
// DELETE body — { id?: number, school?: string }
//   id     -> delete that single row
//   school -> delete every row this week for that school
export async function POST({ request }) {
  const { weekId } = await requireActiveWeek();
  const body = await request.json().catch(() => null);
  if (!body) throw error(400, 'Body must be JSON with { csv } or { rows }.');

  let rows = [];
  if (typeof body.csv === 'string') {
    const parsed = parseCsv(body.csv);
    rows = parsed.rows.map(r => ({
      school: (r.school ?? r.school_name ?? '').trim(),
      player: (r.player ?? r.player_name ?? '').trim(),
      conference: (r.conference ?? '').trim(),
      priority: Number.parseInt(r.priority ?? '', 10)
    }));
  } else if (Array.isArray(body.rows)) {
    rows = body.rows.map(r => ({
      school: String(r.school ?? '').trim(),
      player: String(r.player ?? '').trim(),
      conference: String(r.conference ?? '').trim(),
      priority: Number.parseInt(r.priority ?? '', 10)
    }));
  } else {
    throw error(400, 'Provide either `csv` (string) or `rows` (array).');
  }

  const valid = rows.filter(
    r => r.school && r.player && r.conference && Number.isInteger(r.priority) && r.priority > 0
  );
  if (valid.length === 0) {
    throw error(400, 'No valid rows. Expected columns: School, Player, Conference, Priority.');
  }

  const db = await createClient();
  try {
    await db.query('BEGIN');
    for (const r of valid) {
      await db.query(
        `INSERT INTO program_coach_priority_lists
           (week_id, school_name, player_name, conference, priority)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (week_id, school_name, player_name, conference)
         DO UPDATE SET priority = EXCLUDED.priority,
                       submitted_at = NOW()`,
        [weekId, r.school, r.player, r.conference, r.priority]
      );
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw error(500, `Could not save coach priorities: ${e.message}`);
  } finally {
    await db.end();
  }
  return json({ ok: true, inserted: valid.length, skipped: rows.length - valid.length });
}

export async function DELETE({ request }) {
  const { weekId } = await requireActiveWeek();
  const body = await request.json().catch(() => null);
  if (!body || (!Number.isInteger(body.id) && !body.school)) {
    throw error(400, 'Body must be { id } or { school }.');
  }

  const db = await createClient();
  try {
    if (Number.isInteger(body.id)) {
      await db.query(
        `DELETE FROM program_coach_priority_lists WHERE id = $1 AND week_id = $2`,
        [body.id, weekId]
      );
    } else {
      await db.query(
        `DELETE FROM program_coach_priority_lists
           WHERE week_id = $1 AND LOWER(school_name) = LOWER($2)`,
        [weekId, String(body.school).trim()]
      );
    }
  } catch (e) {
    throw error(500, `Could not delete coach priority: ${e.message}`);
  } finally {
    await db.end();
  }
  return json({ ok: true });
}
