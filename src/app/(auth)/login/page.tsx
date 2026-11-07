import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthHeader } from '../AuthHeader';
import styles from '../auth.module.css';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
};

/** Messages for /login?signup=…, set by the signup action after an account is created. */
const SIGNUP_NOTICES: Record<string, string> = {
  confirm: 'Account created. Check your email to confirm your address, then sign in.',
  done: 'Account created. You can now sign in.',
};

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <>
      <AuthHeader title="Sign in" />
      {/* Reading searchParams is request-time data, so it streams in behind Suspense. */}
      <Suspense fallback={null}>
        <SignupNotice searchParams={searchParams} />
      </Suspense>
      <LoginForm />
      <p className={`md-typescale-body-medium ${styles.switch}`}>
        Don&apos;t have an account?
        <md-text-button href="/signup">Sign up</md-text-button>
      </p>
    </>
  );
}

async function SignupNotice({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const { signup } = await searchParams;
  const message = typeof signup === 'string' ? SIGNUP_NOTICES[signup] : undefined;
  if (!message) return null;

  return (
    <p role="status" className={`md-typescale-body-medium ${styles.notice}`}>
      {message}
    </p>
  );
}
