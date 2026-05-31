import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

// POST body: { ordered_schools: string[] }
// Replaces all school priority values atomically. Position in the array
// becomes priority 1..N. Schools not previously in program_school_priority
// are inserted.
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.ordered_schools)) {
    throw error(400, 'Body must be { ordered_schools: string[] }.');
  }
  const ordered = body.ordered_schools.map(s => String(s ?? '').trim()).filter(Boolean);
  if (ordered.length === 0) throw error(400, 'ordered_schools is empty.');

  // Dedup case-insensitively while preserving the first occurrence.
  const seen = new Set();
  const unique = [];
  for (const s of ordered) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(s);
  }

  const db = await createClient();
  try {
    await db.query('BEGIN');
    // Park every existing row at a negative position so the unique
    // (priority) index doesn't block the rewrite.
    const existing = await db.query(`SELECT id FROM program_school_priority ORDER BY id`);
    let park = -1;
    for (const r of existing.rows) {
      await db.query(`UPDATE program_school_priority SET priority = $2 WHERE id = $1`, [r.id, park]);
      park -= 1;
    }
    // Upsert each school at its new position.
    for (let i = 0; i < unique.length; i++) {
      const s = unique[i];
      const pri = i + 1;
      await db.query(
        `INSERT INTO program_school_priority (school_name, priority)
         VALUES ($1, $2)
         ON CONFLICT (school_name)
         DO UPDATE SET priority = EXCLUDED.priority, updated_at = NOW()`,
        [s, pri]
      );
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw error(500, `Could not save school priority: ${e.message}`);
  } finally {
    await db.end();
  }
  return json({ ok: true, count: unique.length });
}
