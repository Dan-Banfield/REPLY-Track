import type { CurrentUser } from '@features/logic/auth/session';

import { PlaceholderCard } from './PlaceholderCard';
import styles from './overview.module.css';

/** Overview content for teachers. PLACEHOLDER: replace the cards with real content. */
export function TeacherOverview({ user }: { user: CurrentUser }) {
  return (
    <>
      <p className={`md-typescale-body-large ${styles.intro}`}>
        Welcome, {user.email}. Here&apos;s what&apos;s happening in your classes.
      </p>
      <div className={styles.grid}>
        <PlaceholderCard title="My classes">Your classes will appear here.</PlaceholderCard>
        <PlaceholderCard title="Student progress">
          A summary of how your students are doing will appear here.
        </PlaceholderCard>
        <PlaceholderCard title="Recent activity">
          The latest activity from your students will appear here.
        </PlaceholderCard>
      </div>
    </>
  );
}
