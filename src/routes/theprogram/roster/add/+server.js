import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { addPlayerToRoster, RosterError } from '$lib/server/theprogram/roster.js';

// POST { school_name, player_name, conference } — manual add.
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  const schoolName = String(body?.school_name ?? '').trim();
  const playerName = String(body?.player_name ?? '').trim();
  const conference = String(body?.conference ?? '').trim();
  if (!schoolName || !playerName || !conference) {
    throw error(400, 'school_name, player_name, and conference are required.');
  }
  if (playerName.length > 100) throw error(400, 'Player name too long (max 100).');

  const db = await createClient();
  try {
    // school_name must match a configured school.
    const sc = await db.query(
      `SELECT 1 FROM program_schools WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [schoolName]
    );
    if (sc.rows.length === 0) throw error(400, `Unknown school "${schoolName}".`);

    await db.query('BEGIN');
    const row = await addPlayerToRoster(db, {
      schoolName, playerName, conference, source: 'manual'
    });
    await db.query('COMMIT');
    return json({ ok: true, row });
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    if (e instanceof RosterError) {
      const msg = e.code === 'CAPACITY_FULL'
        ? `${schoolName} is at capacity (15/15). Revoke a scholarship before adding a new player.`
        : e.message;
      throw error(409, msg);
    }
    if (e.status) throw e;
    throw error(500, `Could not add player: ${e.message}`);
  } finally {
    await db.end();
  }
}
