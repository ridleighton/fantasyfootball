import { redirect, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { createClient } from '$lib/server/db.js';
import { photoUrl } from '$lib/server/theprogram/show.js';

export async function load({ parent, url }) {
  const { session, profile } = await parent();

  // Dev-only auth bypass for local design review. `dev` is the SvelteKit
  // build flag — true under `npm run dev`, false in every production
  // build, so this branch is dead code in the deployed bundle.
  // Remove this block before shipping if you want the gate active in dev too.
  if (!dev) {
    if (!session) {
      const redirectTo = url.pathname + url.search;
      throw redirect(303, `/auth/login?redirect=${encodeURIComponent(redirectTo)}`);
    }

    if (!profile?.is_admin && !profile?.is_commissioner) {
      throw error(403, 'Access denied — The Program is for commissioners and admins only.');
    }
  }

  // Look up the brand logo for the nav. Also ensures the newer columns on
  // program_photos exist — runs once per request and is a no-op if they're
  // already there. Without this safety net, hitting /theprogram/show on a
  // DB that hasn't had the image_url / primary_color / secondary_color
  // migration applied throws "column does not exist".
  let logoUrl = null;
  const db = await createClient();
  try {
    await db.query(`
      ALTER TABLE program_photos
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7),
        ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7)
    `).catch(() => {});

    const res = await db.query(
      `SELECT image_url, google_file_id FROM program_photos
        WHERE type = 'Logo' ORDER BY id ASC LIMIT 1`
    );
    if (res.rows.length > 0) logoUrl = photoUrl(res.rows[0], 'w400');
  } catch {
    // If the photos table isn't there yet, just fall back to text branding.
  } finally {
    await db.end();
  }

  return { tpLogoUrl: logoUrl };
}
