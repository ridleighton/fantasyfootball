import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent }) {
  await parent(); // admin guard from layout

  const db = await createClient();
  try {
    const res = await db.query(
      `SELECT u.id, u.username, u.display_name, u.primary_color,
              u.is_admin, u.is_commissioner, u.created_at,
              u.supabase_uid IS NOT NULL as has_supabase_account
       FROM users u
       ORDER BY u.display_name`
    );
    return { users: res.rows };
  } finally {
    await db.end();
  }
}
