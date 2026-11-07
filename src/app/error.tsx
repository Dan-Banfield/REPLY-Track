'use client'; // Error boundaries must be Client Components.

import { useEffect, type CSSProperties } from 'react';

import { LogoutButton } from '@/components/auth/LogoutButton';

/**
 * Error page for every route below the root layout (including the dashboard
 * layout). It always offers "Log out", so a signed-in user is never stuck:
 * e.g. if their profile row is missing, every dashboard visit fails and
 * /login would redirect them straight back.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main style={styles.main}>
      <h1 className="md-typescale-headline-medium" style={styles.text}>
        Something went wrong
      </h1>
      <p className="md-typescale-body-large" style={styles.supporting}>
        This page couldn&apos;t be loaded. Try again, or log out and sign in again.
      </p>
      <div style={styles.actions}>
        <md-filled-button onClick={() => retry()}>Try again</md-filled-button>
        <LogoutButton />
      </div>
    </main>
  );
}

// Inline styles on purpose: Next preloads an error boundary's CSS file on every
// page, and the browser then warns that it was "preloaded but not used".
const styles = {
  main: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    maxWidth: 640,
    margin: '0 auto',
    padding: '48px 24px',
  },
  text: { margin: 0 },
  supporting: { margin: 0, color: 'var(--md-sys-color-on-surface-variant)' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
} satisfies Record<string, CSSProperties>;
