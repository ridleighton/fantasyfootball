import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_APIKEY, SUPABASE_SECRET } from '$env/static/private';
import { createClient as createAdminClient } from '@supabase/supabase-js';

/** Supabase client for use in server-side load functions and API routes. */
export function serverSupabase(cookies) {
  return createServerClient(SUPABASE_URL, SUPABASE_APIKEY, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookies.set(name, value, { ...options, path: '/' })
        );
      }
    }
  });
}

/** Service-role client — bypasses RLS, use only in admin server routes. */
export function adminSupabase() {
  return createAdminClient(SUPABASE_URL, SUPABASE_SECRET);
}

/** Public-safe credentials to pass to the browser client via layout data. */
export const supabasePublicConfig = { url: SUPABASE_URL, anonKey: SUPABASE_APIKEY };
