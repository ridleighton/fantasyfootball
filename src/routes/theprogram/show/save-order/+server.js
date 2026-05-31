import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import {
  saveOverrideOrder,
  resetBlockToImport,
  lockedConferences
} from '$lib/server/theprogram/priority.js';

// POST body — apply a commissioner drag-drop override to one block:
//   {
//     conference: 'C1',
//     roll_type:  'commit',                  // 'commit' | 'steal' | 'auto-commit'
//     ordered_players: ['Player A', 'Player B', ...]
//   }
//
// OR — reset one block to the import sequence:
//   {
//     conference: 'C1',
//     roll_type:  'commit',
//     reset: true
//   }
//
// Either operation is rejected if the conference is locked (the first
// roll in that conference has already executed).
export async function POST({ request }) {
  const { weekId } = await requireActiveWeek();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.conference !== 'string' || typeof body.roll_type !== 'string') {
    throw error(400, 'Body must include `conference` and `roll_type`.');
  }
  const conference = body.conference.trim();
  const rollType = body.roll_type.trim().toLowerCase();
  if (!['commit', 'steal', 'auto-commit'].includes(rollType)) {
    throw error(400, 'roll_type must be one of: commit, steal, auto-commit.');
  }

  const db = await createClient();
  try {
    const locked = await lockedConferences(db, weekId);
    if (locked.has(conference)) {
      throw error(409, `Conference "${conference}" is locked — a roll has already executed.`);
    }

    if (body.reset === true) {
      await resetBlockToImport(db, weekId, conference, rollType);
      return json({ ok: true, reset: true });
    }
    if (!Array.isArray(body.ordered_players)) {
      throw error(400, 'Provide either `ordered_players` or `reset: true`.');
    }
    const ordered = body.ordered_players.map(p => String(p ?? '').trim()).filter(Boolean);
    await saveOverrideOrder(db, weekId, conference, rollType, ordered);
    return json({ ok: true });
  } catch (e) {
    if (e.status) throw e;
    throw error(500, `Could not save order: ${e.message}`);
  } finally {
    await db.end();
  }
}
