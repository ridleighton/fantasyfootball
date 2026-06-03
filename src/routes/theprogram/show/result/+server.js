import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { loadEventsForWeek, executeRoll } from '$lib/server/theprogram/show.js';
import {
  getRosterCounts,
  addPlayerToRoster,
  transferPlayer,
  RosterError
} from '$lib/server/theprogram/roster.js';

// Outcomes that add the recruit to the winning school's active roster.
const ADD_OUTCOMES = new Set([
  'commit', 'commit_solo', 'auto_commit_solo_winner', 'auto_commit_contested'
]);

export async function POST({ request }) {
  const { weekId } = await requireActiveWeek();
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.eventIndex)) {
    throw error(400, 'Body must be { eventIndex: number }');
  }
  const eventIndex = body.eventIndex;

  const db = await createClient();
  try {
    const { events } = await loadEventsForWeek(db, weekId);
    const ev = events[eventIndex];
    if (!ev) throw error(404, 'Event not found at that index.');

    // Idempotent: if the group already has a result, return what's saved.
    const existing = ev.rows.find(r => r.result)?.result ?? null;
    if (existing) {
      return json({ outcome: 'already_rolled', winner: existing, savedResult: existing });
    }

    // Capacity context for the draw (case-insensitive lookup).
    const rcRaw = await getRosterCounts(db).catch(() => new Map());
    const rosterCounts = new Map([...rcRaw].map(([k, v]) => [k.toLowerCase(), v]));

    const result = executeRoll(ev, rosterCounts);
    const ids = ev.rows.map(r => r.id);
    const rollEventId = ev.rows[0]?.id ?? null;
    let valueToSave = result.winner;
    if (!valueToSave && result.outcome === 'steal_failed_locked') valueToSave = 'LOCKED';

    // Roster mutation + outcome write happen in one transaction. A capacity
    // conflict at insert time rolls everything back and leaves the event
    // unrolled and re-runnable.
    await db.query('BEGIN');
    try {
      if (result.winner && ADD_OUTCOMES.has(result.outcome)) {
        await addPlayerToRoster(db, {
          schoolName: result.winner,
          playerName: ev.player,
          conference: ev.conference,
          source: 'show',
          weekId,
          rollEventId,
          silentDuplicate: true
        });
      } else if (result.outcome === 'steal_succeeded' && result.winner) {
        await transferPlayer(db, {
          playerName: ev.player,
          conference: ev.conference,
          fromSchool: result.display?.committedSchool ?? null,
          toSchool: result.winner,
          weekId,
          rollEventId
        });
      }

      if (valueToSave && ids.length > 0) {
        await db.query(
          `UPDATE program_roll_events SET result = $1, updated_at = NOW()
            WHERE id = ANY($2::int[])`,
          [valueToSave, ids]
        );
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK').catch(() => {});
      if (e instanceof RosterError && e.code === 'CAPACITY_FULL') {
        return json({ capacity_conflict: true, school: result.winner });
      }
      throw e;
    }

    // Post-insert active count for the winner (for the "Roster: X/15" line).
    let rosterActiveCount = null;
    if (result.winner) {
      const after = await getRosterCounts(db).catch(() => new Map());
      rosterActiveCount = after.get(result.winner) ?? null;
    }

    return json({ outcome: result.outcome, winner: result.winner, roster_active_count: rosterActiveCount });
  } finally {
    await db.end();
  }
}
