import 'server-only';

import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client with the service_role (secret) key. It BYPASSES Row Level
 * Security, so only use it in server code that has already checked who the
 * caller is (e.g. with getCurrentUser()), and only for what users must not do
 * themselves: writing stats (features/logic/stats/store.ts) and uploading
 * student files (features/logic/studentFiles.ts). Reads that a user is allowed
 * to make should use ./server.ts, so that Row Level Security applies.
 * The `server-only` import makes the build fail if a Client Component imports it.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).',
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
