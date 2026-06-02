import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { syncTable, nullable, normalizeHex, PHOTO_TYPES } from '$lib/server/theprogram/config-sync.js';

// POST { photos: [{ id?, type, school, image_url, primary_color, secondary_color }] }
// — replace the photo table.
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.photos)) {
    throw error(400, 'Body must be { photos: [] }.');
  }
  const db = await createClient();
  try {
    // Safety net: ensure the columns exist (no-op if they already do).
    await db.query(`
      ALTER TABLE program_photos
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7),
        ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7)
    `).catch(() => {});

    await db.query('BEGIN');
    const existing = await db.query(`SELECT id FROM program_photos`);
    await syncTable(db, {
      table: 'program_photos',
      columns: ['type', 'school', 'image_url', 'primary_color', 'secondary_color'],
      existing: existing.rows,
      incoming: body.photos,
      rowToValues: (r) => {
        const type = nullable(r.type);
        const school = nullable(r.school);
        const imageUrl = nullable(r.image_url);
        const primary = normalizeHex(r.primary_color);
        const secondary = normalizeHex(r.secondary_color);
        if (!type && !school && !imageUrl) return null;
        if (!type) throw new Error('Photo type is required.');
        if (!PHOTO_TYPES.includes(type)) throw new Error(`Unknown photo type "${type}".`);
        if (!imageUrl) throw new Error('Image URL is required.');
        return [type, school, imageUrl, primary, secondary];
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
