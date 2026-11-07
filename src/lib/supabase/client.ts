import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for Client Components (code that runs in the browser).
 * It shares the same cookie-based session as the server client.
 *
 * Prefer server code (Server Components / Server Actions) for auth and data;
 * use this only for browser-only features such as realtime subscriptions.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
