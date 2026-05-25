import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { groupEvents, buildOddsString } from '$lib/server/theprogram/show.js';

// POST body: { eventIndex, schools: [{ school, percent? }] }
// - For Commit: percent is required (raw percentages). The endpoint writes a
//   single canonical odds string to every surviving row in the event group.
// - For Steal / Auto-Commit: percent is ignored (equal weights are computed
//   at display time); the school list is the source of truth for who remains.
// Schools omitted from the payload are removed (rows deleted).
export async function POST({ request }) {
  const { weekId } = await requireActiveWeek();
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.eventIndex) || !Array.isArray(body.schools)) {
    throw error(400, 'Body must be { eventIndex: number, schools: [{ school, percent? }] }');
  }

  const incoming = body.schools
    .map(s => ({
      school: String(s.school ?? '').trim(),
      percent: s.percent == null ? null : Number(s.percent)
    }))
    .filter(s => s.school);

  if (incoming.length === 0) {
    throw error(400, 'Cannot remove every school. Use the Commish view to delete the event.');
  }

  const db = await createClient();
  try {
    await db.query('BEGIN');

    const [rowsRes, orderRes] = await Promise.all([
      db.query(
        `SELECT id, conference, type, player, school, locked, in_original_roll,
                odds, result, committed_school
           FROM program_roll_events
          WHERE week_id = $1
          ORDER BY id ASC`,
        [weekId]
      ),
      db.query(
        `SELECT conference FROM program_conference_order
          WHERE week_id = $1 ORDER BY position ASC`,
        [weekId]
      )
    ]);
    const events = groupEvents(rowsRes.rows, orderRes.rows.map(r => r.conference));
    const ev = events[body.eventIndex];
    if (!ev) throw error(404, 'Event not found.');

    if (ev.type === 'Commit') {
      // For commits, the odds string is the canonical source of truth for the
      // school list — the per-row `school` column may not even be populated,
      // and many imports put a single row with the full multi-school odds
      // string. Deleting rows whose school column doesn't match the editor
      // payload destroys the event. Instead: keep every row, just rewrite
      // the odds string everywhere. Removed schools simply no longer appear
      // in the new string, so the parser drops them on next render.
      for (const s of incoming) {
        if (s.percent == null || Number.isNaN(s.percent) || s.percent < 0) {
          throw error(400, `Percent for "${s.school}" is invalid.`);
        }
      }
      const oddsString = buildOddsString(incoming);
      const allIds = ev.rows.map(r => r.id);
      if (allIds.length > 0) {
        await db.query(
          `UPDATE program_roll_events
              SET odds = $1, updated_at = NOW()
            WHERE id = ANY($2::int[])`,
          [oddsString, allIds]
        );
      }
    } else {
      // Steal / Auto-Commit: schools come from per-row school columns, so
      // removing a school means deleting that row.
      const keptLower = new Set(incoming.map(s => s.school.toLowerCase()));
      const idsToDelete = ev.rows
        .filter(r => !keptLower.has((r.school ?? '').trim().toLowerCase()))
        .map(r => r.id);
      if (idsToDelete.length > 0) {
        await db.query(
          `DELETE FROM program_roll_events WHERE id = ANY($1::int[])`,
          [idsToDelete]
        );
      }
    }

    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    if (e.status) throw e;
    throw error(500, `Could not save edits: ${e.message}`);
  } finally {
    await db.end();
  }

  return json({ ok: true });
}
