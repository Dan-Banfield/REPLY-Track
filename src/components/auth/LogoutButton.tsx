'use client';

import { useTransition } from 'react';

import { logout } from '@/lib/auth/actions';
import { LOGIN_PATH } from '@/lib/auth/routes';

/**
 * Signs out, then does a full page load to /login.
 *
 * The full load (instead of a client-side navigation) throws away all client
 * state, including pages Next keeps mounted in the background, so nothing
 * from the previous user's session survives in the browser tab.
 */
export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await logout();
      window.location.assign(LOGIN_PATH);
    });
  }

  return (
    <md-outlined-button disabled={pending} onClick={handleClick}>
      {pending ? 'Logging out…' : 'Log out'}
    </md-outlined-button>
  );
}
