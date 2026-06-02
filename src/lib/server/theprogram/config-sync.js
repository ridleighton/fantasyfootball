// Shared helpers for the Config section save endpoints. Each endpoint
// replaces one table's rows: upsert incoming rows (by id), delete the
// existing rows that are no longer present.

export const PHOTO_TYPES = ['School Helmet', 'Placeholder Helmet', 'Locked Image', 'Bars', 'Logo'];

export function nullable(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function normalizeHex(v) {
  const s = nullable(v);
  if (!s) return null;
  const m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return '#' + h.toLowerCase();
}

// Sync one table to `incoming`. `existing` is the current [{id}] rows.
// rowToValues maps an incoming row to the column value array (or null to
// skip an empty row, or throw to reject the whole batch).
export async function syncTable(db, opts) {
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
    await db.query(`DELETE FROM ${table} WHERE id = ANY($1::int[])`, [toDelete]);
  }
}
