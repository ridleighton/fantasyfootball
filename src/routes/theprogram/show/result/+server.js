import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { groupEvents, executeRoll } from '$lib/server/theprogram/show.js';

export async function POST({ request }) {
  const { weekId } = await requireActiveWeek();
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.eventIndex)) {
    throw error(400, 'Body must be { eventIndex: number }');
  }
  const eventIndex = body.eventIndex;

  const db = await createClient();
  try {
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
    const conferenceOrder = orderRes.rows.map(r => r.conference);
    const events = groupEvents(rowsRes.rows, conferenceOrder);
    const ev = events[eventIndex];
    if (!ev) throw error(404, 'Event not found at that index.');

    // Idempotent: if all rows in the group already have a result, return what's saved.
    const existing = ev.rows.find(r => r.result)?.result ?? null;
    if (existing) {
      return json({
        outcome: 'already_rolled',
        winner: existing,
        savedResult: existing
      });
    }

    const result = executeRoll(ev);

    // Persist result to every row in the group (skip writing if no winner was determined,
    // except for steal_failed_locked where we still want to record the outcome).
    const ids = ev.rows.map(r => r.id);
    let valueToSave = result.winner;
    if (!valueToSave && result.outcome === 'steal_failed_locked') valueToSave = 'LOCKED';
    if (valueToSave && ids.length > 0) {
      await db.query(
        `UPDATE program_roll_events
            SET result = $1, updated_at = NOW()
          WHERE id = ANY($2::int[])`,
        [valueToSave, ids]
      );
    }

    return json({
      outcome: result.outcome,
      winner: result.winner,
      cameLate: !!result.cameLate
    });
  } finally {
    await db.end();
  }
}
