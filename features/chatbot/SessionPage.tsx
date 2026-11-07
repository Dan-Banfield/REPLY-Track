import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getCurrentUser } from '@features/logic/auth/session';
import { DEFAULT_SUBJECT, getSubject } from '@features/logic/stats';

import styles from './chatbot.module.css';
import { SessionChat } from './SessionChat';
import { findOpenSession, toClientSession } from './sessions';

export const metadata: Metadata = {
  title: 'Study',
};

export default function SessionPage() {
  return (
    // Depends on the logged-in student (request data), so it streams in behind Suspense.
    <Suspense fallback={<div className={styles.screen} />}>
      <StudentSession />
    </Suspense>
  );
}

async function StudentSession() {
  const { id, role } = await getCurrentUser();
  if (role !== 'student') notFound();

  const session = await findOpenSession(id);
  const { stats } = getSubject(session?.subject ?? DEFAULT_SUBJECT);

  return (
    <SessionChat
      initialSession={session && toClientSession(session)}
      statLabels={Object.fromEntries(stats.map((stat) => [stat.id, stat.label]))}
    />
  );
}
