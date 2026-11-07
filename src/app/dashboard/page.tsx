import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ROLE_LABELS } from '@/lib/auth/roles';
import { getCurrentUser } from '@/lib/auth/session';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Overview',
};

// PLACEHOLDER content. Step 6 replaces it with role-specific Overview content.
export default function OverviewPage() {
  return (
    <div className={styles.page}>
      <h1 className="md-typescale-headline-medium">Overview</h1>
      {/* Reads the session, so it streams in behind Suspense. */}
      <Suspense fallback={<p className="md-typescale-body-large">Loading…</p>}>
        <SignedInAs />
      </Suspense>
    </div>
  );
}

async function SignedInAs() {
  const user = await getCurrentUser();
  return (
    <p className="md-typescale-body-large">
      Signed in as {user.email} ({ROLE_LABELS[user.role]})
    </p>
  );
}
