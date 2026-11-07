import type { CurrentUser } from '@features/logic/auth/session';

import { PlaceholderCard } from './PlaceholderCard';
import styles from './overview.module.css';

/** Overview content for students. PLACEHOLDER: replace the cards with real content. */
export function StudentOverview({ user }: { user: CurrentUser }) {
  return (
    <>
      <p className={`md-typescale-body-large ${styles.intro}`}>
        Welcome, {user.email}. Here&apos;s an overview of your learning.
      </p>
      <div className={styles.grid}>
        <PlaceholderCard title="My progress">Your progress will appear here.</PlaceholderCard>
        <PlaceholderCard title="Coming up">Upcoming work and deadlines will appear here.</PlaceholderCard>
        <PlaceholderCard title="Recent feedback">
          Feedback from your teachers will appear here.
        </PlaceholderCard>
      </div>
    </>
  );
}
