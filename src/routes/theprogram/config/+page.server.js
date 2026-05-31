import { fail } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

const PHOTO_TYPES = ['School Helmet', 'Placeholder Helmet', 'Locked Image', 'Bars', 'Logo'];

function nullable(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normalizeHex(v) {
  const s = nullable(v);
  if (!s) return null;
  const m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return '#' + h.toLowerCase();
}

async function syncTable(db, opts) {
  const { table, columns, existing, incoming, rowToValues } = opts;
  const existingIds = new Set(existing.map(r => Number(r.id)));
  const keptIds = new Set();

  const cols = columns.join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const setClause = columns.map((c, i) => `${c} = $${i + 1}`).join(', ');

  for (const row of incoming) {
    const idNum = Number.parseInt(row.id, 10);
    const values = rowToValues(row);
    if (values == null) continue;

    if (Number.isInteger(idNum) && existingIds.has(idNum)) {
      keptIds.add(idNum);
      await db.query(
        `UPDATE ${table} SET ${setClause}, updated_at = NOW() WHERE id = $${columns.length + 1}`,
        [...values, idNum]
      );
    } else {
      await db.query(
        `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
        values
      );
    }
  }

  const toDelete = [...existingIds].filter(id => !keptIds.has(id));
  if (toDelete.length > 0) {
    await db.query(
      `DELETE FROM ${table} WHERE id = ANY($1::int[])`,
      [toDelete]
    );
  }
}

export async function load() {
  const db = await createClient();
  try {
    // Safety net: make sure the new columns exist (no-op if they already do).
    await db.query(`
      ALTER TABLE program_photos
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7),
        ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7)
    `).catch(() => {});

    const [confRes, schoolRes, photoRes, rankingsRes, schoolPriRes] = await Promise.all([
      db.query(`SELECT id, name FROM program_conferences ORDER BY name ASC`),
      db.query(`SELECT id, name, conference FROM program_schools ORDER BY conference ASC, name ASC`),
      db.query(
        `SELECT id, type, school, image_url, google_file_id,
                primary_color, secondary_color
           FROM program_photos
          ORDER BY type ASC, school ASC NULLS LAST`
      ),
      db.query(
        `SELECT id, player_name, tier, rank, updated_at
           FROM program_player_rankings
          ORDER BY tier ASC, rank ASC, player_name ASC`
      ).catch(() => ({ rows: [] })),
      db.query(
        `SELECT id, school_name, priority FROM program_school_priority
          ORDER BY priority ASC`
      ).catch(() => ({ rows: [] }))
    ]);
    return {
      conferences: confRes.rows,
      schools: schoolRes.rows,
      photos: photoRes.rows,
      photoTypes: PHOTO_TYPES,
      playerRankings: rankingsRes.rows,
      schoolPriority: schoolPriRes.rows
    };
  } finally {
    await db.end();
  }
}

export const actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const payload = form.get('payload');
    if (!payload) return fail(400, { message: 'Missing payload.' });

    let parsed;
    try {
      parsed = JSON.parse(payload.toString());
    } catch (e) {
      return fail(400, { message: `Invalid payload: ${e.message}` });
    }
    const { conferences = [], schools = [], photos = [] } = parsed;

    const db = await createClient();
    try {
      await db.query('BEGIN');

      const [confRes, schoolRes, photoRes] = await Promise.all([
        db.query(`SELECT id FROM program_conferences`),
        db.query(`SELECT id FROM program_schools`),
        db.query(`SELECT id FROM program_photos`)
      ]);

      await syncTable(db, {
        table: 'program_conferences',
        columns: ['name'],
        existing: confRes.rows,
        incoming: conferences,
        rowToValues: (r) => {
          const name = nullable(r.name);
          if (!name) return null;
          return [name];
        }
      });

      await syncTable(db, {
        table: 'program_schools',
        columns: ['name', 'conference'],
        existing: schoolRes.rows,
        incoming: schools,
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

      await syncTable(db, {
        table: 'program_photos',
        columns: ['type', 'school', 'image_url', 'primary_color', 'secondary_color'],
        existing: photoRes.rows,
        incoming: photos,
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
    } catch (e) {
      await db.query('ROLLBACK').catch(() => {});
      return fail(400, { message: e.message });
    } finally {
      await db.end();
    }

    return { success: true, savedAt: new Date().toISOString() };
  }
};
