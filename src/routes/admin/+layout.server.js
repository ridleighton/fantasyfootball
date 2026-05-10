import { redirect, error } from '@sveltejs/kit';

export async function load({ parent }) {
  const { session, profile } = await parent();
  if (!session) throw redirect(303, '/auth/login');
  if (!profile?.is_admin && !profile?.is_commissioner) throw error(403, 'Forbidden');
  return {};
}
