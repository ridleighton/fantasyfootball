import { redirect, error } from '@sveltejs/kit';

export async function load({ parent, url }) {
  const { session, profile } = await parent();

  if (!session) {
    const redirectTo = url.pathname + url.search;
    throw redirect(303, `/auth/login?redirect=${encodeURIComponent(redirectTo)}`);
  }

  if (!profile?.is_admin && !profile?.is_commissioner) {
    throw error(403, 'Access denied — The Program is for commissioners and admins only.');
  }

  return {};
}
