import { json } from '@sveltejs/kit';
import { serverSupabase } from '$lib/server/auth.js';
import { createClient } from '$lib/server/db.js';

export async function GET({ cookies }) {
  const result = { session: null, dbConnected: false, userRow: null, errors: [] };

  // 1. Check Supabase session
  try {
    const supabase = serverSupabase(cookies);
    const { data, error } = await supabase.auth.getSession();
    if (error) result.errors.push({ step: 'supabase_session', message: error.message });
    if (data?.session) {
      result.session = {
        uid: data.session.user.id,
        email: data.session.user.email,
        role: data.session.user.role,
      };
    }
  } catch (e) {
    result.errors.push({ step: 'supabase_session', message: e.message });
  }

  // 2. Check DB connection and user row
  let db;
  try {
    db = await createClient();
    result.dbConnected = true;

    if (result.session) {
      // Check by supabase_uid
      const byUid = await db.query(
        `SELECT id, username, display_name, is_admin, is_commissioner,
                primary_color, secondary_color, supabase_uid
         FROM users WHERE supabase_uid = $1`,
        [result.session.uid]
      );
      result.bySupabaseUid = byUid.rows[0] ?? null;

      // Check by email
      const byEmail = await db.query(
        `SELECT id, username, display_name, is_admin, is_commissioner,
                primary_color, secondary_color, supabase_uid
         FROM users WHERE LOWER(username) = LOWER($1)`,
        [result.session.email]
      );
      result.byEmail = byEmail.rows[0] ?? null;

      // Check what columns exist on users table
      const cols = await db.query(
        `SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_name = 'users'
         ORDER BY ordinal_position`
      );
      result.userTableColumns = cols.rows.map(r => `${r.column_name} (${r.data_type})`);
    }
  } catch (e) {
    result.errors.push({ step: 'db', message: e.message });
  } finally {
    await db?.end();
  }

  return json(result, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
