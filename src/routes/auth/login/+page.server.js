import { supabasePublicConfig } from '$lib/server/auth.js';

export function load() {
  return { supabase: supabasePublicConfig };
}
