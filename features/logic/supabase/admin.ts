import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client with the secret key, which bypasses Row Level Security. Use
 * it only in server code, and only for writes users must not be able to make
 * themselves, such as uploading student files. Reads should use ./server.ts, so that
 * Row Level Security applies.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
