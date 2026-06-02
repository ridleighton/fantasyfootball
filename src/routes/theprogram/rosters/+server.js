import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

const STATUSES = ['active', 'inactive'];

// POST — create or update a single roster entry.
//   { school: string, conference: string, player: string,
//     status?: 'active'|'inactive', locked?: boolean, inactive_reason?: string }
// Upserts on (school, player). locked only applies when active;
// inactive_reason only applies when inactive — the other is cleared.
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (!body) throw error(400, 'Body must be JSON.');

  const school = String(body.school ?? '').trim();
  const conference = String(body.conference ?? '').trim();
  const player = String(body.player ?? '').trim();
  if (!school || !player) throw error(400, 'school and player are required.');

  const status = STATUSES.includes(body.status) ? body.status : 'active';
  const locked = status === 'active' ? Boolean(body.locked) : false;
  const inactiveReason = status === 'inactive'
    ? (body.inactive_reason ? String(body.inactive_reason).trim() : null)
    : null;

  const db = await createClient();
  try {
    // "Week added" is captured once at creation from the active week (or an
    // explicit override). It is NOT overwritten on later status edits.
    let weekAdded = Number.isInteger(body.week_added) ? body.week_added : null;
    if (weekAdded == null) {
      const aw = await db.query(
        `SELECT w.week_number
           FROM program_active_week aw
           LEFT JOIN program_weeks w ON w.id = aw.week_id
          WHERE aw.id = 1`
      ).catch(() => ({ rows: [] }));
      weekAdded = aw.rows[0]?.week_number ?? null;
    }

    const res = await db.query(
      `INSERT INTO program_rosters
         (school_name, conference, player_name, status, locked, inactive_reason, week_added)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (LOWER(school_name), LOWER(player_name))
       DO UPDATE SET conference = EXCLUDED.conference,
                     status = EXCLUDED.status,
                     locked = EXCLUDED.locked,
                     inactive_reason = EXCLUDED.inactive_reason,
                     updated_at = NOW()
       RETURNING id, school_name, conference, player_name, status, locked,
                 inactive_reason, week_added`,
      [school, conference, player, status, locked, inactiveReason, weekAdded]
    );
    return json({ ok: true, row: res.rows[0] });
  } catch (e) {
    throw error(500, `Could not save roster entry: ${e.message}`);
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
