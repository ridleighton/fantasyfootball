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

export async function GET({ cookies }) {
  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const res = await db.query(`
      SELECT
        td.id,
        td.name,
        td.slug,
        td.api_league_id,
        td.description,
        td.created_at,
        COUNT(tp.id)::int AS player_count
      FROM trivia_databases td
      LEFT JOIN trivia_players tp ON tp.database_id = td.id
      GROUP BY td.id
      ORDER BY td.name ASC
    `);

    return json(res.rows);
  } finally {
    await db.end();
  }
}

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const { name, slug, api_league_id = null, description = '' } = await request.json();
    if (!name || !slug) throw error(400, 'name and slug are required');

    const res = await db.query(
      `INSERT INTO trivia_databases (name, slug, api_league_id, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, api_league_id, description`,
      [name, slug, api_league_id, description]
    );

    return json(res.rows[0], { status: 201 });
  } finally {
    await db.end();
  }
}

export async function DELETE({ url, cookies }) {
  const dbId = url.searchParams.get('id');
  if (!dbId) throw error(400, 'id required');

  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    await db.query('DELETE FROM trivia_databases WHERE id = $1', [dbId]);
    return json({ success: true });
  } finally {
    await db.end();
  }
}
