import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

async function getUserId(cookies, db) {
  try {
    const supabase = serverSupabase(cookies);
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) return null;
    const res = await db.query('SELECT id FROM users WHERE supabase_uid = $1', [session.user.id]);
    return res.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET({ cookies }) {
  const db = await createClient();
  try {
    const userId = await getUserId(cookies, db);
    if (!userId) throw error(401, 'Unauthorized');

    const res = await db.query(
      `SELECT id, username, display_name, timezone, primary_color, secondary_color, is_admin, is_commissioner, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    if (res.rows.length === 0) throw error(404, 'Not found');
    return json({ data: res.rows[0] });
  } finally {
    await db.end();
  }
}

export async function PUT({ request, cookies }) {
  const db = await createClient();
  try {
    const userId = await getUserId(cookies, db);
    if (!userId) throw error(401, 'Unauthorized');

    const body = await request.json();
    const { displayName, primaryColor, secondaryColor, timezone, themePreference } = body;

    const updates = [];
    const values = [];
    let i = 1;
    if (displayName !== undefined)      { updates.push(`display_name = $${i++}`);       values.push(displayName); }
    if (primaryColor !== undefined)     { updates.push(`primary_color = $${i++}`);      values.push(primaryColor); }
    if (secondaryColor !== undefined)   { updates.push(`secondary_color = $${i++}`);    values.push(secondaryColor); }
    if (timezone !== undefined)         { updates.push(`timezone = $${i++}`);           values.push(timezone); }
    if (themePreference !== undefined)  { updates.push(`theme_preference = $${i++}`);   values.push(themePreference); }

    if (updates.length === 0) throw error(400, 'No fields to update');

    values.push(userId);

    const res = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, username, display_name, primary_color, secondary_color, timezone`,
      values
    );
    if (res.rows.length === 0) throw error(404, 'Not found');
    return json({ data: res.rows[0] });
  } finally {
    await db.end();
  }
}
