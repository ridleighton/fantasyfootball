import { serverSupabase, supabasePublicConfig } from '$lib/server/auth.js';

export async function load({ url, cookies }) {
  const code = url.searchParams.get('code');
  let linkError = null;

  if (code) {
    try {
      const supabase = serverSupabase(cookies);
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('Code exchange error:', error.message);
        linkError = 'This reset link has expired or already been used. Please request a new one.';
      }
    } catch (e) {
      console.error('Code exchange exception:', e);
      linkError = 'This reset link has expired or already been used. Please request a new one.';
    }
  } else {
    linkError = 'Invalid reset link. Please request a new one.';
  }

  return { supabase: supabasePublicConfig, linkError };
}
