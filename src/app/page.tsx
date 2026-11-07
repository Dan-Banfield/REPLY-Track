import { Suspense } from 'react';

import { createClient } from '@/lib/supabase/server';

import styles from './page.module.css';

// TEMPORARY page for checking the setup. Step 3 replaces it with a redirect
// (to /login or the dashboard, depending on the session).
export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className="md-typescale-headline-medium">REPLY Track</h1>
      <p className="md-typescale-body-large">
        Temporary page for checking the setup. It is replaced in a later step.
      </p>
      <Suspense fallback={null}>
        <SessionStatus />
      </Suspense>
      <div className={styles.actions}>
        <md-filled-button href="/login">Go to sign in</md-filled-button>
      </div>
    </main>
  );
}

// Reads the session cookie on the server, so it must sit inside <Suspense>.
async function SessionStatus() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims.email;

  return (
    <p className="md-typescale-title-medium">
      {email ? `Signed in as ${email}` : 'Not signed in.'}
    </p>
  );
}
