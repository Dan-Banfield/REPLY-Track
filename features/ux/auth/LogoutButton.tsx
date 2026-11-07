'use client';

import { useTransition } from 'react';

import { logout } from '@features/logic/auth/actions';
import { LOGIN_PATH } from '@features/logic/auth/routes';

/**
 * Logout behaviour for any control: signs out, then does a full page load to
 * /login.
 *
 * The full load (instead of a client-side navigation) throws away all client
 * state, including pages Next keeps mounted in the background, so nothing
 * from the previous user's session survives in the browser tab.
 */
export function useLogout() {
  const [pending, startTransition] = useTransition();

  function logOut() {
    startTransition(async () => {
      await logout();
      window.location.assign(LOGIN_PATH);
    });
  }

  return { pending, logOut };
}

/** Standalone M3 outlined "Log out" button (used on the error page). */
export function LogoutButton() {
  const { pending, logOut } = useLogout();

  return (
    <md-outlined-button disabled={pending} onClick={logOut}>
      {pending ? 'Logging out…' : 'Log out'}
    </md-outlined-button>
  );
}
