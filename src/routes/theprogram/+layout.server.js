import { redirect, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { photoUrl } from '$lib/server/theprogram/show.js';

export async function load({ parent, url }) {
  const { session, profile } = await parent();

  if (!session) {
    const redirectTo = url.pathname + url.search;
    throw redirect(303, `/auth/login?redirect=${encodeURIComponent(redirectTo)}`);
  }

  if (!profile?.is_admin && !profile?.is_commissioner) {
    throw error(403, 'Access denied — The Program is for commissioners and admins only.');
  }

  // Look up the brand logo for the nav
  let logoUrl = null;
  const db = await createClient();
  try {
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
