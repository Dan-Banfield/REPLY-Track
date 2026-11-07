import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getCurrentUser } from '@features/logic/auth/session';
import { feedbackFromFile, hexagonFromFile, userFileDetails } from '@features/logic/stats';
import { listStudentFiles, type StudentFile } from '@features/logic/studentFiles';
import { Feedback } from '@features/ux/dashboard/overview/Feedback';
import { Hexagon } from '@features/ux/dashboard/overview/Hexagon';
import { Markdown } from '@features/ux/markdown/Markdown';

import styles from './students.module.css';

export const metadata: Metadata = {
  title: 'Students',
};

export default function StudentsPage() {
  return (
    <div className={styles.page}>
      <h1 className="md-typescale-headline-medium">Students</h1>
      {/* Depends on the logged-in teacher (request data), so it streams in behind Suspense. */}
      <Suspense fallback={<p className="md-typescale-body-large">Loading…</p>}>
        <StudentList />
      </Suspense>
    </div>
  );
}

async function StudentList() {
  const { role } = await getCurrentUser();
  if (role !== 'teacher') notFound();

  const files = await listStudentFiles();
  if (files.length === 0) {
    return (
      <p className="md-typescale-body-large">
        Students appear here when they finish their first session.
      </p>
    );
  }

  return (
    <div className={styles.grid}>
      {files.map((file) => (
        <Student key={file.student_id} file={file} />
      ))}
    </div>
  );
}

/** One student: their hexagon and feedback, with the rest of their file folded away. */
function Student({ file }: { file: StudentFile }) {
  return (
    <section className={styles.student}>
      <Hexagon hexagon={hexagonFromFile(file.content)} title={file.student_email} />
      <Feedback
        feedback={feedbackFromFile(file.content)}
        emptyText="No feedback yet. It appears after their next finished session."
      />
      <details className={styles.details}>
        <summary className="md-typescale-label-large">Stats and recent activity</summary>
        <Markdown>{userFileDetails(file.content)}</Markdown>
      </details>
    </section>
  );
}
