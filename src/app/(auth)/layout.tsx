import type { ReactNode } from 'react';

import styles from './auth.module.css';

/**
 * Shared layout for the public auth pages (/login, /signup): a centred M3
 * outlined card. The "(auth)" folder is a route group, so it doesn't appear in
 * the URL. Each page renders <AuthHeader>, whose <h1> labels the card.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="auth-title">
        {children}
      </section>
    </main>
  );
}
