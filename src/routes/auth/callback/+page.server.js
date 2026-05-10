import { redirect } from '@sveltejs/kit';
import { serverSupabase } from '$lib/server/auth.js';

export async function load({ url, cookies }) {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = serverSupabase(cookies);
    await supabase.auth.exchangeCodeForSession(code);
  }

  throw redirect(303, next);
}
