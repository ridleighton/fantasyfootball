import { redirect, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

export async function load({ cookies, parent }) {
  const { session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const supabase = serverSupabase(cookies);
  const { data: { session: sess } } = await supabase.auth.getSession();
  if (!sess) throw redirect(303, '/auth/login');

  const db = await createClient();
  try {
    const res = await db.query(
      'SELECT id, is_admin FROM users WHERE supabase_uid = $1',
      [sess.user.id]
    );
    const user = res.rows[0];
    if (!user?.is_admin) throw redirect(303, '/trivia');
    return {};
  } finally {
    await db.end();
  }
}
