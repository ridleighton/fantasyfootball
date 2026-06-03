import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';
import { computeGossipFlags } from '$lib/server/theprogram/gossip.js';

// POST { eventIndex } — returns the over-subscription advisory cards for the
// commit roll at that global index. Read-only. Tolerant of missing roster
// tables (returns no cards).
export async function POST({ request }) {
  const { weekId } = await requireActiveWeek();
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.eventIndex)) {
    throw error(400, 'Body must be { eventIndex: number }.');
  }
  const db = await createClient();
  try {
    const result = await computeGossipFlags(db, weekId, body.eventIndex);
    return json(result);
  } catch (e) {
    // Advisory only — never break the show if the check fails.
    return json({ schools: [] });
  } finally {
    await db.end();
  }
}
