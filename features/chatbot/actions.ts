'use server';

import { after } from 'next/server';

import type { CurrentUser } from '@features/logic/auth/session';
import {
  awardXp,
  deductXp,
  getUser,
  getUserFile,
  saveFeedback,
  upsertUser,
} from '@features/logic/stats';
import type { StatId } from '@features/logic/stats/types';
import { saveStudentFile } from '@features/logic/studentFiles';

import { writeFeedback } from './feedback';
import { failedQuizLoss, generateQuiz, markQuiz } from './quiz';
import {
  createSession,
  findOpenSession,
  readSession,
  requireStudent,
  saveSession,
  toClientSession,
  type ClientSession,
  type Session,
} from './sessions';

/** Starts a session, or returns the one this student already has open. */
export async function startSession(): Promise<ClientSession> {
  const user = await requireStudent();
  const session = (await findOpenSession(user.id)) ?? (await createSession(user.id));
  return toClientSession(session);
}

/** Closes the chat and writes the end-of-session quiz. A session with no messages has no quiz. */
export async function endSession(sessionId: string): Promise<ClientSession> {
  const user = await requireStudent();
  const session = await readSession(user.id, sessionId);
  if (!session || session.status !== 'active') {
    throw new Error(`No active session ${sessionId}.`);
  }

  if (session.messages.length === 0) {
    session.status = 'finished';
  } else {
    session.quiz = await generateQuiz(session);
    session.status = 'quiz';
  }

  await saveSession(session);
  return toClientSession(session);
}

/** Marks the quiz, then awards its XP or takes the penalty, and finishes the session. */
export async function submitQuiz(sessionId: string, answers: number[]): Promise<ClientSession> {
  const user = await requireStudent();
  const session = await readSession(user.id, sessionId);
  if (!session || session.status !== 'quiz') {
    throw new Error(`No quiz waiting for session ${sessionId}.`);
  }

  const { correct, total, passed, xp } = markQuiz(session.quiz, answers);
  const change = {
    userId: user.id,
    subject: session.subject,
    reason: `Session quiz: ${correct}/${total} correct`,
  };
  const quizChanges = passed
    ? (await awardXp({ ...change, xp, respectDailyCap: true })).gains
    : negate(await deductXp({ ...change, xp: failedQuizLoss(session) }));

  session.result = { correct, total, xp: sum(quizChanges) };
  session.status = 'finished';
  await saveSession(session);

  // The student's result is saved, so they don't need to wait for the teacher's copy.
  after(() => updateStudentFile(session, user));

  return toClientSession(session);
}

/** Rewrites the student's feedback from this session, then uploads their stats file. */
async function updateStudentFile(session: Session, user: CurrentUser): Promise<void> {
  try {
    await upsertUser(user.id, user.email);
    const { feedback } = await getUser(user.id);
    await saveFeedback(user.id, await writeFeedback(session, feedback));
  } catch (error) {
    // Still upload: the stats have changed even if the feedback hasn't.
    console.error('Could not update the feedback:', error);
  }

  try {
    await saveStudentFile({
      student_id: user.id,
      student_email: user.email,
      content: await getUserFile(user.id),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Could not upload the student file:', error);
  }
}

function negate(xp: Record<StatId, number>): Record<StatId, number> {
  return Object.fromEntries(Object.entries(xp).map(([stat, value]) => [stat, -value]));
}

function sum(xp: Record<StatId, number>): number {
  return Object.values(xp).reduce((total, value) => total + value, 0);
}
