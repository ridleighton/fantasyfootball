import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

async function getAdminUser(cookies, db) {
  const supabase = serverSupabase(cookies);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const res = await db.query(
    'SELECT id, is_admin FROM users WHERE supabase_uid = $1',
    [session.user.id]
  );
  const user = res.rows[0];
  if (!user?.is_admin) return null;
  return user;
}

export async function GET({ url, cookies }) {
  const q = url.searchParams.get('q') ?? '';
  const dbsParam = url.searchParams.get('dbs') ?? '';

  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    if (q.length < 2) return json([]);

    const dbIds = dbsParam
      ? dbsParam.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n))
      : [];

    let query;
    let params;

    if (dbIds.length > 0) {
      query = `
        SELECT tp.id, tp.full_name, tp.aliases, tp.database_id, td.name AS database_name
        FROM trivia_players tp
        JOIN trivia_databases td ON td.id = tp.database_id
        WHERE tp.full_name ILIKE $1
          AND tp.database_id = ANY($2)
        ORDER BY tp.full_name ASC
        LIMIT 20
      `;
      params = [`%${q}%`, dbIds];
    } else {
      query = `
        SELECT tp.id, tp.full_name, tp.aliases, tp.database_id, td.name AS database_name
        FROM trivia_players tp
        JOIN trivia_databases td ON td.id = tp.database_id
        WHERE tp.full_name ILIKE $1
        ORDER BY tp.full_name ASC
        LIMIT 20
      `;
      params = [`%${q}%`];
    }

    const res = await db.query(query, params);
    return json(res.rows);
  } finally {
    await db.end();
  }
}
