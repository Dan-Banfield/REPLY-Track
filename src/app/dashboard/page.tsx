import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LogoutButton } from '@/components/auth/LogoutButton';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { getCurrentUser } from '@/lib/auth/session';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Dashboard',
};

// TEMPORARY placeholder. Step 5 adds the dashboard layout with navigation
// (and moves the logout button there); step 6 adds the Overview content.
export default function DashboardPage() {
  return (
    <main className={styles.main}>
      <h1 className="md-typescale-headline-medium">Dashboard</h1>
      {/* Reads the session, so it streams in behind Suspense. */}
      <Suspense fallback={<p className="md-typescale-body-large">Loading…</p>}>
        <SignedInAs />
      </Suspense>
      <div className={styles.actions}>
        <LogoutButton />
      </div>
    </main>
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
