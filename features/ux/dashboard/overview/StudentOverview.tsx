import type { CurrentUser } from '@features/logic/auth/session';
import { getFeedback, getHexagon } from '@features/logic/stats';

import { Feedback } from './Feedback';
import { Hexagon } from './Hexagon';
import { PlaceholderCard } from './PlaceholderCard';
import styles from './overview.module.css';

/** Overview content for students: real stats, then PLACEHOLDER cards to replace with real content. */
export async function StudentOverview({ user }: { user: CurrentUser }) {
  const [hexagon, feedback] = await Promise.all([getHexagon(user.id), getFeedback(user.id)]);

  return (
    <>
      <p className={`md-typescale-body-large ${styles.intro}`}>
        Welcome, {user.email}. Here&apos;s an overview of your learning.
      </p>
      <div className={styles.grid}>
        <Hexagon hexagon={hexagon} />
        <Feedback feedback={feedback} emptyText="Finish a study session to get your first feedback." />
        <PlaceholderCard title="Coming up">Upcoming work and deadlines will appear here.</PlaceholderCard>
      </div>
    </>
  );
}
