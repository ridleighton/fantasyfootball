import { json } from '@sveltejs/kit';
import { serverSupabase } from '$lib/server/auth.js';
import { createClient } from '$lib/server/db.js';

export async function GET({ cookies }) {
  const result = {
    session: null,
    dbConnected: false,
    userTableColumns: [],
    allUsers: [],
    bySupabaseUid: null,
    byEmail: null,
    alterTableResult: null,
    errors: []
  };

  // 1. Check Supabase session
  try {
    const supabase = serverSupabase(cookies);
    const { data, error } = await supabase.auth.getSession();
    if (error) result.errors.push({ step: 'supabase_session', message: error.message });
    if (data?.session) {
      result.session = {
        uid: data.session.user.id,
        email: data.session.user.email,
      };
    }
  } catch (e) {
    result.errors.push({ step: 'supabase_session', message: e.message });
  }

  let db;
  try {
    db = await createClient();
    result.dbConnected = true;

    // Get column list
    const cols = await db.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'users' ORDER BY ordinal_position`
    );
    result.userTableColumns = cols.rows.map(r => `${r.column_name} (${r.data_type})`);
    const availableCols = new Set(cols.rows.map(r => r.column_name));

    // List all users (safe fields only — no password hashes)
    const users = await db.query(
      `SELECT id, username, display_name, is_admin FROM users ORDER BY id`
    );
    result.allUsers = users.rows;

    // Try to add supabase_uid column and report what happens
    try {
      await db.query(`ALTER TABLE users ADD COLUMN supabase_uid UUID`);
      result.alterTableResult = 'added supabase_uid column successfully';
    } catch (e) {
      if (e.message.includes('already exists')) {
        result.alterTableResult = 'supabase_uid column already exists';
      } else {
        result.alterTableResult = `ALTER TABLE failed: ${e.message}`;
      }
    }

    // Re-check columns after alter attempt
    const cols2 = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`
    );
    const availableCols2 = new Set(cols2.rows.map(r => r.column_name));

    if (result.session) {
      const safeCols = ['id', 'username', 'display_name', 'is_admin',
        ...(availableCols2.has('supabase_uid') ? ['supabase_uid'] : []),
        ...(availableCols2.has('is_commissioner') ? ['is_commissioner'] : []),
        ...(availableCols2.has('primary_color') ? ['primary_color'] : []),
      ].join(', ');

      if (availableCols2.has('supabase_uid')) {
        const byUid = await db.query(
          `SELECT ${safeCols} FROM users WHERE supabase_uid = $1`,
          [result.session.uid]
        ).catch(e => { result.errors.push({ step: 'byUid', message: e.message }); return { rows: [] }; });
        result.bySupabaseUid = byUid.rows[0] ?? null;
      }

      const byEmail = await db.query(
        `SELECT ${safeCols} FROM users WHERE LOWER(username) = LOWER($1)`,
        [result.session.email]
      ).catch(e => { result.errors.push({ step: 'byEmail', message: e.message }); return { rows: [] }; });
      result.byEmail = byEmail.rows[0] ?? null;
    }
  } catch (e) {
    result.errors.push({ step: 'db', message: e.message });
  } finally {
    await db?.end();
  }

  return json(result, { headers: { 'Cache-Control': 'no-store' } });
}
