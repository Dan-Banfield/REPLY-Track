import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client with the service_role (secret) key. It BYPASSES Row Level
 * Security, so only use it in server code that has already checked who the
 * caller is (e.g. with getCurrentUser()). The `server-only` import makes the
 * build fail if a Client Component ever imports this file.
 *
 * Used by the stats store (features/logic/stats/store.ts) for writes, because
 * users must not be able to write their own XP.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).',
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
