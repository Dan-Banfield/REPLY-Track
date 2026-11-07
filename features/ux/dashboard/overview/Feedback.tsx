import type { StudentFeedback } from '@features/logic/stats/types';

import styles from './overview.module.css';

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

/** M3 filled card showing a student's running feedback. */
export function Feedback({
  feedback,
  emptyText,
}: {
  feedback: StudentFeedback | null;
  emptyText: string;
}) {
  return (
    <section className={`${styles.card} ${styles.wide}`}>
      <h2 className="md-typescale-title-medium">Recent feedback</h2>
      {feedback ? (
        <>
          <p className="md-typescale-body-small">
            Updated {DATE_FORMAT.format(new Date(feedback.updatedAt))}
          </p>
          <p className={`md-typescale-body-medium ${styles.summary}`}>{feedback.summary}</p>
          <Points title="Doing well" points={feedback.strengths} />
          <Points title="To work on" points={feedback.workOn} />
        </>
      ) : (
        <p className="md-typescale-body-medium">{emptyText}</p>
      )}
    </section>
  );
}

function Points({ title, points }: { title: string; points: string[] }) {
  if (points.length === 0) return null;

  return (
    <>
      <h3 className="md-typescale-title-small">{title}</h3>
      <ul className={`md-typescale-body-medium ${styles.points}`}>
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </>
  );
}
