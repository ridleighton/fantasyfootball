import { redirect, fail } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent }) {
  const { session, profile } = await parent();
  if (!session) throw redirect(303, '/auth/login');
  return { profile };
}

export const actions = {
  update: async ({ request, parent }) => {
    const { session, profile } = await parent();
    if (!session) throw redirect(303, '/auth/login');

    const data = await request.formData();
    const displayName = data.get('displayName')?.toString().trim();
    const primaryColor = data.get('primaryColor')?.toString().trim();
    const secondaryColor = data.get('secondaryColor')?.toString().trim();
    const timezone = data.get('timezone')?.toString().trim();

    if (!displayName) return fail(400, { error: 'Display name is required' });

    const db = await createClient();
    try {
      const result = await db.query(
        `UPDATE users
         SET display_name = $1, primary_color = $2, secondary_color = $3,
             timezone = $4
         WHERE id = $5
         RETURNING id, display_name, primary_color, secondary_color, timezone`,
        [displayName, primaryColor || null, secondaryColor || null, timezone || null, profile.id]
      );

      if (result.rows.length === 0) return fail(404, { error: 'User not found' });

      return { success: true, profile: result.rows[0] };
    } finally {
      await db.end();
    }
  }
};
