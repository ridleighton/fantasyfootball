import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { revokeScholarship, getRosterCounts, RosterError } from '$lib/server/theprogram/roster.js';

// POST { roster_id } — move an active player to inactive.
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  const rosterId = Number.parseInt(body?.roster_id, 10);
  if (!Number.isInteger(rosterId)) throw error(400, 'roster_id is required.');
  const reason = body?.reason ? String(body.reason) : null;

  const db = await createClient();
  try {
    await db.query('BEGIN');
    const row = await revokeScholarship(db, rosterId, reason);
    await db.query('COMMIT');
    const counts = await getRosterCounts(db);
    return json({ ok: true, row, active_count: counts.get(row.school_name) ?? 0 });
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    if (e instanceof RosterError && e.code === 'NOT_FOUND') throw error(404, e.message);
    throw error(500, `Could not revoke scholarship: ${e.message}`);
  } finally {
    await db.end();
  }
}
