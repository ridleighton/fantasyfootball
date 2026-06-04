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
    // No eligible schools because every candidate is at capacity: mark the
    // event complete with a sentinel result so it counts as resolved and
    // reads "recruit not committed — roster full" everywhere.
    if (!valueToSave && result.outcome === 'no_eligible_capacity') valueToSave = 'ROSTER FULL';
    // Any other winnerless outcome — no school cleared the threshold cut, no
    // schools in the roll at all, etc. — still resolves the recruit: they
    // stay uncommitted. Save a sentinel so the roll counts as complete and
    // the conference can advance rather than stalling on an unrolled event.
    if (!valueToSave) valueToSave = 'UNCOMMITTED';

    // Roster mutation + outcome write happen in one transaction. The roster
    // step runs inside a SAVEPOINT so it can't break the roll: a CAPACITY_FULL
    // rolls the whole thing back (event stays unrolled), while any other
    // roster problem — most importantly the program_roster table not having
    // been created yet — is rolled back to the savepoint and the roll is
    // still recorded.
    await db.query('BEGIN');
    try {
      const wantsRoster =
        (result.winner && ADD_OUTCOMES.has(result.outcome)) ||
        (result.outcome === 'steal_succeeded' && result.winner);

      if (wantsRoster) {
        await db.query('SAVEPOINT roster_op');
        try {
          if (ADD_OUTCOMES.has(result.outcome)) {
            await addPlayerToRoster(db, {
              schoolName: result.winner,
              playerName: ev.player,
              conference: ev.conference,
              source: 'show',
              weekId,
              rollEventId,
              silentDuplicate: true
            });
          } else {
            await transferPlayer(db, {
              playerName: ev.player,
              conference: ev.conference,
              fromSchool: result.display?.committedSchool ?? null,
              toSchool: result.winner,
              weekId,
              rollEventId
            });
          }
        } catch (e) {
          await db.query('ROLLBACK TO SAVEPOINT roster_op').catch(() => {});
          if (e instanceof RosterError && e.code === 'CAPACITY_FULL') {
            // Capacity conflict: do NOT record the roll — leave it re-runnable.
            await db.query('ROLLBACK').catch(() => {});
            return json({ capacity_conflict: true, school: result.winner });
          }
          // Roster not set up (or other roster issue): skip population, but
          // still record the roll below.
        }
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
