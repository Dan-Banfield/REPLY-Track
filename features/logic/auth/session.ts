import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createClient } from '@features/logic/supabase/server';

import { isRole, type Role } from './roles';
import { LOGIN_PATH } from './routes';

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
};

/**
 * The logged-in user, verified on the server, with their role. Redirects to
 * /login when there is no valid session. Use it in every protected Server
 * Component, Server Action and Route Handler; don't rely on the proxy alone.
 *
 * The role comes from the `profiles` table (protected by RLS), never from user
 * metadata, which users can edit themselves. See
 * features/logic/migrations/20261107000000_create_profiles.sql.
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
  const { sub: id, email = '' } = data.claims;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the profile for user ${id}: ${error.message}`);
  }
  if (!profile || !isRole(profile.role)) {
    // Usually means the profiles SQL hasn't been run in this Supabase project.
    throw new Error(
      `No valid profile found for user ${id}. Run features/logic/migrations/*.sql in the Supabase SQL Editor (see features/logic/logic.md, "Roles").`,
    );
  }

  return { id, email, role: profile.role };
});
