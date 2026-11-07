'use server';

import type { AuthError } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { isRole } from './roles';
import { HOME_PATH, LOGIN_PATH } from './routes';

/** State returned to forms that call these actions through useActionState. */
export type FormState = {
  error: string | null;
};

/** Signs in with email and password. On success the session cookies are set and the user is redirected. */
export async function login(_prevState: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Enter your email and password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: loginErrorMessage(error) };
  }

  redirect(HOME_PATH);
}

/**
 * Creates an account with the chosen role, then sends the user to /login.
 *
 * The role is stored in the new user's metadata (`raw_user_meta_data.role`);
 * the `on_auth_user_created` database trigger copies it into the `profiles`
 * table (supabase/migrations/). The app reads roles from `profiles` only
 * (getCurrentUser), never from user metadata, which users can edit.
 */
export async function signup(_prevState: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const role = formData.get('role');

  if (!email || !password) {
    return { error: 'Enter your email and password.' };
  }
  if (!isRole(role)) {
    return { error: 'Choose whether you are a teacher or a student.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role } },
  });

  if (error) {
    return { error: signupErrorMessage(error) };
  }

  // The `signup` query value picks the message shown on /login (see (auth)/login/page.tsx).
  if (data.session) {
    // "Confirm email" is off in Supabase, so signUp also signed the user in.
    // Sign out again so every new user lands on the login page.
    await supabase.auth.signOut({ scope: 'local' });
    redirect(`${LOGIN_PATH}?signup=done`);
  }
  redirect(`${LOGIN_PATH}?signup=confirm`);
}

/**
 * Ends the session on this device (other devices stay signed in) and clears
 * the auth cookies. It doesn't redirect: the caller does a full page load to
 * /login so no client state survives (see components/auth/LogoutButton.tsx).
 */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    // The cookies are cleared either way; log so a revocation failure isn't silent.
    console.error('Supabase sign-out failed:', error);
  }
}

function loginErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Incorrect email or password.';
    case 'email_not_confirmed':
      return 'Confirm your email address before signing in.';
    default:
      return unexpectedError('Sign-in', error);
  }
}

function signupErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists.';
    case 'weak_password':
      return error.message; // Supabase explains which password rule failed.
    case 'email_address_invalid':
      return 'Enter a valid email address.';
    case 'over_email_send_rate_limit':
      return 'Too many sign-up emails were sent recently. Please try again later.';
    case 'signup_disabled':
      return 'Sign-ups are currently turned off.';
    default:
      return unexpectedError('Sign-up', error);
  }
}

// Unexpected: e.g. Supabase unreachable or wrong keys in .env. Details go to the server log only.
function unexpectedError(what: string, error: AuthError): string {
  console.error(`Supabase ${what.toLowerCase()} failed:`, error);
  return `${what} failed. Please try again.`;
}
