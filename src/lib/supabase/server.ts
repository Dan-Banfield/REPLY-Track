import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client for server code: Server Components, Server Actions and
 * Route Handlers. Create a new client per request (don't share one globally).
 *
 * The session lives in cookies. Server Actions and Route Handlers can write
 * them (e.g. after sign-in); Server Components can only read them.
 *
 * With Cache Components on, calling this reads `cookies()`, so a Server
 * Component that uses it must render inside <Suspense> (see features/logic.md).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: refreshed tokens are written by the proxy instead.
          }
        },
      },
    },
  );
}
