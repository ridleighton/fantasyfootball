import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { syncTable, nullable } from '$lib/server/theprogram/config-sync.js';

// POST { conferences: [{ id?, name }] } — replace the conference list.
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.conferences)) {
    throw error(400, 'Body must be { conferences: [] }.');
  }
  const db = await createClient();
  try {
    await db.query('BEGIN');
    const existing = await db.query(`SELECT id FROM program_conferences`);
    await syncTable(db, {
      table: 'program_conferences',
      columns: ['name'],
      existing: existing.rows,
      incoming: body.conferences,
      rowToValues: (r) => {
        const name = nullable(r.name);
        return name ? [name] : null;
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
