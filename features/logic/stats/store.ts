/**
 * Persistence: one row per user in the Supabase table public.student_stats
 * (features/logic/migrations/20261107190000_create_student_stats.sql).
 *
 *   data      jsonb  UserProfile, the source of truth
 *   markdown  text   the stats file (see markdown.ts), rewritten on every save
 *   version   int    optimistic-concurrency counter
 *
 * Writes use the service_role client (RLS bypassed; users can't write their
 * own XP). Reads can use either the admin client or the caller's own client,
 * in which case RLS decides what they may see.
 */
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@features/logic/supabase/admin';

import { MAX_ACTIVITY } from './config';
import { normaliseProfile, renderUserMarkdown } from './markdown';
import { StatsError } from './subjects';
import type { UserProfile } from './types';

const TABLE = 'student_stats';
const MAX_ATTEMPTS = 25;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** userId is the Supabase auth user id (a UUID). */
export function assertValidUserId(userId: string): void {
  if (typeof userId !== 'string' || !UUID_RE.test(userId)) {
    throw new StatsError('userId must be a Supabase user id (UUID)', 400);
  }
}

type Row = { data: UserProfile; version: number };

function dbError(action: string, error: { message: string; code?: string }): StatsError {
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return new StatsError(
      `Table public.${TABLE} is missing. Run features/logic/migrations/*.sql in the Supabase SQL Editor.`,
      500,
    );
  }
  console.error(`[stats] ${action} failed:`, error);
  return new StatsError(`Could not ${action}: ${error.message}`, 500);
}

async function readRow(userId: string, db: SupabaseClient): Promise<Row | null> {
  const { data, error } = await db
    .from(TABLE)
    .select('data, version')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw dbError('read stats', error);
  if (!data) return null;
  return { data: normaliseProfile(data.data as UserProfile), version: data.version as number };
}

/**
 * Read one user's profile, or null if they have no stats yet (or RLS hides the
 * row from the given client). Defaults to the admin client.
 */
export async function readUser(userId: string, db?: SupabaseClient): Promise<UserProfile | null> {
  assertValidUserId(userId);
  return (await readRow(userId, db ?? createAdminClient()))?.data ?? null;
}

/** The stored stats file (Markdown) exactly as saved. 404 if the user has no stats. */
export async function readUserFile(userId: string): Promise<string> {
  assertValidUserId(userId);
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .select('markdown')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw dbError('read stats file', error);
  if (!data) throw new StatsError(`No stats found for user "${userId}"`, 404);
  return data.markdown as string;
}

export interface MutateContext {
  /** Call to finish without saving (e.g. nothing changed). */
  skipSave(): void;
}

/**
 * Read-modify-write one user's profile safely under concurrency (serverless-
 * safe): read row + version, apply `mutate`, then write only if the version is
 * unchanged; otherwise re-read and retry. `mutate` may therefore run more than
 * once and must only change the profile it is given.
 *
 * `create` builds the profile when the user has no row yet. It may throw
 * (e.g. a 404 StatsError) to forbid creation.
 */
export async function mutateUser<T>(
  userId: string,
  create: () => UserProfile,
  mutate: (profile: UserProfile, ctx: MutateContext) => T,
): Promise<{ profile: UserProfile; result: T }> {
  assertValidUserId(userId);
  const db = createAdminClient();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const row = await readRow(userId, db);
    const profile = row ? row.data : create();
    let skip = false;
    const result = mutate(profile, { skipSave: () => (skip = true) });
    if (skip) return { profile, result };
    profile.activity = profile.activity.slice(0, MAX_ACTIVITY);

    const payload = {
      data: profile,
      markdown: renderUserMarkdown(profile),
      updated_at: profile.updatedAt,
    };

    if (!row) {
      const { error } = await db.from(TABLE).insert({ user_id: userId, ...payload, version: 1 });
      if (!error) return { profile, result };
      if (error.code === '23503') throw new StatsError(`User "${userId}" not found`, 404);
      if (error.code !== '23505') throw dbError('save stats', error);
      // 23505: another request created the row first. Retry as an update.
    } else {
      const { data, error } = await db
        .from(TABLE)
        .update({ ...payload, version: row.version + 1 })
        .eq('user_id', userId)
        .eq('version', row.version)
        .select('user_id');
      if (error) throw dbError('save stats', error);
      if (data.length > 0) return { profile, result };
      // Version changed underneath us: someone else saved. Retry.
    }
    await new Promise((r) => setTimeout(r, 5 + Math.random() * 20 * (attempt + 1)));
  }
  throw new StatsError('Too many concurrent updates for this user; try again', 409);
}

/** All profiles (admin). Fine for a class; paginate if it grows. */
export async function listProfiles(): Promise<UserProfile[]> {
  const { data, error } = await createAdminClient().from(TABLE).select('data');
  if (error) throw dbError('list stats', error);
  return (data ?? []).map((r) => normaliseProfile(r.data as UserProfile));
}

/** Ids of users whose role is 'student' (admin). */
export async function listStudentIds(): Promise<Set<string>> {
  const { data, error } = await createAdminClient()
    .from('profiles')
    .select('id')
    .eq('role', 'student');
  if (error) throw dbError('list students', error);
  return new Set((data ?? []).map((r) => r.id as string));
}
