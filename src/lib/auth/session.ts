import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import { LOGIN_PATH } from './routes';

export type CurrentUser = {
  id: string;
  email: string;
};

/**
 * The logged-in user, verified on the server. Redirects to /login when there
 * is no valid session. Use it in every protected Server Component, Server
 * Action and Route Handler; don't rely on the proxy alone.
 *
 * It reads cookies, so in Server Components call it inside <Suspense>.
 * Wrapped in React `cache`, so several calls in one request cost one check.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect(LOGIN_PATH);
  }

  return { id: data.claims.sub, email: data.claims.email ?? '' };
});
