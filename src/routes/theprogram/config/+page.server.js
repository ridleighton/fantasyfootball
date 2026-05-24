import { fail } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

const PHOTO_TYPES = ['School Helmet', 'Placeholder Helmet', 'Locked Image', 'Bars'];

function nullable(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function required(v) {
  const s = nullable(v);
  if (!s) throw new Error('required field is empty');
  return s;
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
    const values = rowToValues(row); // throws if invalid
    if (values == null) continue; // skip empty rows

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
    const [confRes, schoolRes, photoRes] = await Promise.all([
      db.query(`SELECT id, name FROM program_conferences ORDER BY name ASC`),
      db.query(`SELECT id, name, conference FROM program_schools ORDER BY conference ASC, name ASC`),
      db.query(`SELECT id, type, school, google_file_id FROM program_photos ORDER BY type ASC, school ASC NULLS LAST`)
    ]);
    return {
      conferences: confRes.rows,
      schools: schoolRes.rows,
      photos: photoRes.rows,
      photoTypes: PHOTO_TYPES
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
        columns: ['type', 'school', 'google_file_id'],
        existing: photoRes.rows,
        incoming: photos,
        rowToValues: (r) => {
          const type = nullable(r.type);
          const school = nullable(r.school);
          const fileId = nullable(r.google_file_id);
          if (!type && !school && !fileId) return null;
          if (!type) throw new Error('Photo type is required.');
          if (!PHOTO_TYPES.includes(type)) throw new Error(`Unknown photo type "${type}".`);
          if (!fileId) throw new Error('Google File ID is required.');
          return [type, school, fileId];
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
