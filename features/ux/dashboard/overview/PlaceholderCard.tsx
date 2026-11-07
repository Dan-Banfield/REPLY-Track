import type { ReactNode } from 'react';

import styles from './overview.module.css';

/**
 * M3 filled card with a title and body text, used for the placeholder
 * sections of the Overview page. (Material Web's card is still in labs/,
 * so this is a plain element styled with tokens.)
 */
export function PlaceholderCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.card}>
      <h2 className="md-typescale-title-medium">{title}</h2>
      <p className="md-typescale-body-medium">{children}</p>
    </section>
  );
}
