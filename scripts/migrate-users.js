#!/usr/bin/env node
/**
 * Creates Supabase Auth accounts for existing users and backfills supabase_uid.
 *
 * Usage:
 *   DATABASE_URL=... PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-users.js
 *
 * Each existing user gets a Supabase account. A temporary password is set.
 * Users will need to reset their password via the Supabase dashboard or a
 * password-reset email flow.
 */
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
const { Client } = pg;

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const rawUrl = process.env.DATABASE_URL ?? '';
const db = new Client({
  connectionString: rawUrl.includes('sslmode') ? rawUrl : `${rawUrl}?sslmode=require`
});

await db.connect();

try {
  const { rows: users } = await db.query(
    `SELECT id, username, display_name, is_admin FROM users WHERE supabase_uid IS NULL ORDER BY id`
  );

  console.log(`Found ${users.length} users without Supabase accounts.\n`);

  for (const user of users) {
    // Derive email from username (assumes username is email or adjust as needed)
    const email = user.username.includes('@') ? user.username : `${user.username}@placeholder.local`;
    const tempPassword = Math.random().toString(36).slice(2, 12) + 'A1!';

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { display_name: user.display_name }
    });

    if (error) {
      console.error(`  ✗ ${user.display_name} (${email}): ${error.message}`);
      continue;
    }

    await db.query('UPDATE users SET supabase_uid = $1 WHERE id = $2', [data.user.id, user.id]);
    console.log(`  ✓ ${user.display_name} → ${data.user.id}`);
    console.log(`    email: ${email}  temp password: ${tempPassword}`);
  }

  console.log('\nUser migration complete.');
  console.log('Send password-reset emails or share temp passwords securely.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await db.end();
}
