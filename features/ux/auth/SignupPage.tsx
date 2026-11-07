import type { Metadata } from 'next';

import { AuthHeader } from './AuthHeader';
import styles from './auth.module.css';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = {
  title: 'Sign up',
};

export default function SignupPage() {
  return (
    <>
      <AuthHeader title="Create an account" />
      <SignupForm />
      <p className={`md-typescale-body-medium ${styles.switch}`}>
        Already have an account?
        <md-text-button href="/login">Sign in</md-text-button>
      </p>
    </>
  );
}
