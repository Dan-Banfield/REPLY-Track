import 'server-only';

import { unstable_rethrow } from 'next/navigation';
import { NextResponse } from 'next/server';

import { getCurrentUser, type CurrentUser } from '@features/logic/auth/session';

import { assertValidUserId } from '../store';
import { StatsError } from '../subjects';

/**
 * Run a route handler body: JSON on success, `{ error }` with the StatsError's
 * status on failure. Next's own control-flow errors (the redirect to /login
 * from getCurrentUser(), dynamic-rendering signals) are re-thrown untouched.
 */
export async function handle<T>(fn: () => Promise<T>, status = 200): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn(), { status });
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof StatsError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[stats api]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Parse a JSON object body, or throw a 400. With `optional`, an empty body is `{}`. */
export async function readJson<T extends object>(
  req: Request,
  { optional = false } = {},
): Promise<Partial<T>> {
  const text = await req.text().catch(() => '');
  if (optional && !text.trim()) return {};
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Partial<T>;
  } catch {
    throw new StatsError('Request body must be a JSON object', 400);
  }
}

/** Default display name for a new stats row: the part of the email before "@". */
export function displayNameFor(user: CurrentUser): string {
  return user.email.split('@')[0] || 'Student';
}

/** The logged-in user (redirects to /login if there is no session). */
export const requireUser = getCurrentUser;

/** Teachers may act on anyone; everyone else only on themselves. */
export async function requireTeacherOrSelf(userId: string): Promise<CurrentUser> {
  assertValidUserId(userId);
  const user = await getCurrentUser();
  if (user.role !== 'teacher' && user.id !== userId) {
    throw new StatsError('Forbidden', 403);
  }
  return user;
}

/** Only teachers. */
export async function requireTeacher(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user.role !== 'teacher') throw new StatsError('Teachers only', 403);
  return user;
}
