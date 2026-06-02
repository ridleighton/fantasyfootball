import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { syncTable, nullable } from '$lib/server/theprogram/config-sync.js';

// POST { schools: [{ id?, name, conference }] } — replace the schools list.
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.schools)) {
    throw error(400, 'Body must be { schools: [] }.');
  }
  const db = await createClient();
  try {
    await db.query('BEGIN');
    const existing = await db.query(`SELECT id FROM program_schools`);
    await syncTable(db, {
      table: 'program_schools',
      columns: ['name', 'conference'],
      existing: existing.rows,
      incoming: body.schools,
      rowToValues: (r) => {
        const name = nullable(r.name);
        const conference = nullable(r.conference);
        if (!name && !conference) return null;
        if (!name || !conference) {
          throw new Error('Each school needs both a name and a conference.');
        }
        return [name, conference];
      }
    });
    await db.query('COMMIT');
    return json({ ok: true });
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw error(400, e.message);
  } finally {
    await db.end();
  }
}
