import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function requireActiveWeek() {
  const db = await createClient();
  try {
    const res = await db.query(
      `SELECT aw.week_id, w.week_number
         FROM program_active_week aw
         LEFT JOIN program_weeks w ON w.id = aw.week_id
        WHERE aw.id = 1`
    );
    const row = res.rows[0];
    if (!row?.week_id) throw redirect(303, '/theprogram/');
    return { weekId: row.week_id, weekNumber: row.week_number };
  } finally {
    await db.end();
  }
}
