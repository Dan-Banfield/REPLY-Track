import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getCurrentUser, type CurrentUser } from '@features/logic/auth/session';
import { DEFAULT_SUBJECT } from '@features/logic/stats';
import type { RankUp, StatId, SubjectId } from '@features/logic/stats/types';

export type MessageAward = {
  gains: Record<StatId, number>;
  rankUps: RankUp[];
  /** The scorer's reason for its rating. Saved so the scoring can be reviewed. */
  reason?: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  /** XP the question before this reply earned. Only on assistant messages. */
  award?: MessageAward;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  stat: StatId;
};

export type QuizResult = {
  correct: number;
  total: number;
  /** XP the quiz changed the student's stats by. Negative if they failed. */
  xp: number;
};

export type Session = {
  id: string;
  userId: string;
  subject: SubjectId;
  /** active: chatting. quiz: waiting for quiz answers. finished: closed. */
  status: 'active' | 'quiz' | 'finished';
  startedAt: string;
  messages: ChatMessage[];
  quiz: QuizQuestion[];
  result: QuizResult | null;
};

/** What the browser may see: the same session without the quiz answers. */
export type ClientSession = Omit<Session, 'quiz'> & {
  quiz: Omit<QuizQuestion, 'answerIndex'>[];
};

export function toClientSession(session: Session): ClientSession {
  return {
    ...session,
    quiz: session.quiz.map(({ question, options, stat }) => ({ question, options, stat })),
  };
}

/** The logged-in student. Throws for teachers, who don't run sessions. */
export async function requireStudent(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user.role !== 'student') {
    throw new Error('Only students can run learning sessions.');
  }
  return user;
}

const SESSIONS_DIR = path.join(process.cwd(), 'data', 'sessions');
const SESSION_ID = /^[0-9a-f-]{36}$/;

function sessionFile(userId: string, sessionId: string): string {
  return path.join(SESSIONS_DIR, userId, `${sessionId}.json`);
}

export async function createSession(userId: string): Promise<Session> {
  const session: Session = {
    id: randomUUID(),
    userId,
    subject: DEFAULT_SUBJECT,
    status: 'active',
    startedAt: new Date().toISOString(),
    messages: [],
    quiz: [],
    result: null,
  };
  await saveSession(session);
  return session;
}

/** Reads one of this user's sessions. `sessionId` comes from the browser, so it is checked first. */
export async function readSession(userId: string, sessionId: string): Promise<Session | null> {
  if (!SESSION_ID.test(sessionId)) return null;
  try {
    return JSON.parse(await fs.readFile(sessionFile(userId, sessionId), 'utf8')) as Session;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function saveSession(session: Session): Promise<void> {
  const file = sessionFile(session.userId, session.id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(session, null, 2), 'utf8');
  await fs.rename(temporary, file);
}

/** The session this student left open (chatting or mid-quiz), if any. */
export async function findOpenSession(userId: string): Promise<Session | null> {
  const files = await fs.readdir(path.join(SESSIONS_DIR, userId)).catch(() => []);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const session = await readSession(userId, file.slice(0, -'.json'.length));
    if (session && session.status !== 'finished') return session;
  }
  return null;
}
