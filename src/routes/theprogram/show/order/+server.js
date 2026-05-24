import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { requireActiveWeek } from '$lib/server/theprogram/active-week.js';

const VALID = ['C1', 'C2', 'C3', 'C4', 'C5'];

export async function POST({ request }) {
  const { weekId } = await requireActiveWeek();
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.order)) {
    throw error(400, 'Body must be { order: [conference, ...] }');
  }
  const order = body.order.map(s => String(s).trim());

  if (order.length !== VALID.length) {
    throw error(400, `Order must contain all ${VALID.length} conferences.`);
  }
  const set = new Set(order);
  if (set.size !== order.length) throw error(400, 'Duplicate conferences in order.');
  for (const c of order) {
    if (!VALID.includes(c)) throw error(400, `Unknown conference "${c}".`);
  }

  const db = await createClient();
  try {
    await db.query('BEGIN');
    await db.query(`DELETE FROM program_conference_order WHERE week_id = $1`, [weekId]);
    for (let i = 0; i < order.length; i++) {
      await db.query(
        `INSERT INTO program_conference_order (week_id, conference, position) VALUES ($1, $2, $3)`,
        [weekId, order[i], i + 1]
      );
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw error(500, `Could not save order: ${e.message}`);
  } finally {
    await db.end();
  }

  return json({ ok: true });
}
