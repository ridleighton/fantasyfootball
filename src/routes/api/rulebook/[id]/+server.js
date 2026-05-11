import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

async function getUser(cookies, db) {
  try {
    const supabase = serverSupabase(cookies);
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) return null;
    const res = await db.query(
      'SELECT id, is_admin, is_commissioner FROM users WHERE supabase_uid = $1',
      [session.user.id]
    );
    return res.rows[0] ?? null;
  } catch { return null; }
}

export async function PUT({ params, request, cookies }) {
  const db = await createClient();
  try {
    const user = await getUser(cookies, db);
    if (!user) throw error(401, 'Unauthorized');
    if (!user.is_admin && !user.is_commissioner) throw error(403, 'Forbidden');

    const { section_title, entries } = await request.json();

    const result = await db.query(
      `UPDATE rulebook_sections
       SET section_title = $1, entries = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id`,
      [section_title, JSON.stringify(entries), params.id]
    );

    if (result.rows.length === 0) throw error(404, 'Not found');
    return json(result.rows[0]);
  } catch (e) {
    if (e.status) throw e;
    console.error('[PUT /api/rulebook/:id]', e.message);
    throw error(500, e.message);
  } finally {
    await db.end();
  }
}
