import { serverSupabase, supabasePublicConfig } from '$lib/server/auth.js';
import { createClient } from '$lib/server/db.js';

export async function load({ cookies }) {
  const supabase = serverSupabase(cookies);
  const { data: { session } } = await supabase.auth.getSession();

  let profile = null;
  if (session) {
    const db = await createClient();
    try {
      // Find existing profile
      let result = await db.query(
        `SELECT id, username, display_name, is_admin, is_commissioner,
                primary_color, secondary_color, timezone
         FROM users WHERE supabase_uid = $1`,
        [session.user.id]
      );

      if (result.rows.length === 0) {
        // First login — create a user record from Supabase Auth data
        const email = session.user.email ?? '';
        const displayName = session.user.user_metadata?.display_name
          ?? email.split('@')[0];

        result = await db.query(
          `INSERT INTO users (username, display_name, supabase_uid, is_admin)
           VALUES ($1, $2, $3, false)
           ON CONFLICT (supabase_uid) DO UPDATE SET username = EXCLUDED.username
           RETURNING id, username, display_name, is_admin, is_commissioner,
                     primary_color, secondary_color, timezone`,
          [email, displayName, session.user.id]
        );

        // Add to default league (id = 1)
        if (result.rows.length > 0) {
          await db.query(
            `INSERT INTO league_members (league_id, user_id)
             VALUES (1, $1) ON CONFLICT DO NOTHING`,
            [result.rows[0].id]
          );
        }
      }

      profile = result.rows[0] ?? null;
    } finally {
      await db.end();
    }
  }

  return { session, profile, supabase: supabasePublicConfig };
}
