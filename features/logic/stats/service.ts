/**
 * High-level stats operations. Server code (route handlers, Server Actions,
 * the chatbot) should call these rather than touching the store.
 *
 * These functions do NOT check who is calling: the caller must authenticate
 * first (getCurrentUser()) and pass the right userId. The HTTP handlers in
 * ./api/ show how.
 */
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { classifyQuestion } from './classifier';
import { DEPTH_MULTIPLIER, MAX_DIRECT_AWARD } from './config';
import {
  applyGains,
  buildHexagon,
  capToDailyLimit,
  computeQuestionGains,
  emptySubjectState,
  removeXp,
} from './engine';
import { parseUserMarkdown } from './markdown';
import {
  assertValidUserId,
  listProfiles,
  listStudentIds,
  mutateUser,
  readUser,
  readUserFile,
} from './store';
import { DEFAULT_SUBJECT, getSubject, isStatOf, listSubjects, StatsError } from './subjects';
import type {
  AwardResult,
  Classification,
  HexagonView,
  QuestionDepth,
  QuestionQuality,
  StatId,
  StatWeights,
  StudentFeedback,
  SubjectId,
  SubjectState,
  UserProfile,
} from './types';

// ---------- helpers ----------

function newProfile(userId: string, displayName?: string): UserProfile {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    userId,
    displayName: displayName?.trim() || userId,
    createdAt: now,
    updatedAt: now,
    subjects: {},
    activity: [],
  };
}

function subjectState(profile: UserProfile, subjectId: SubjectId): SubjectState {
  const def = getSubject(subjectId);
  return (profile.subjects[subjectId] ??= emptySubjectState(def));
}

function isDepth(x: unknown): x is QuestionDepth {
  return typeof x === 'string' && x in DEPTH_MULTIPLIER;
}

function sum(gains: Record<string, number>): number {
  return Object.values(gains).reduce((a, b) => a + b, 0);
}

function notFound(userId: string): never {
  throw new StatsError(`No stats found for user "${userId}"`, 404);
}

// ---------- users ----------

/**
 * A user's profile, or throw 404 if they have no stats yet.
 * Pass the caller's Supabase client to have RLS enforce access; defaults to admin.
 */
export async function getUser(userId: string, db?: SupabaseClient): Promise<UserProfile> {
  return (await readUser(userId, db)) ?? notFound(userId);
}

/** Create the user's stats if missing; optionally update display name. Idempotent. */
export async function upsertUser(userId: string, displayName?: string): Promise<UserProfile> {
  let created = false; // set by `create`, consumed by `mutate` in the same attempt
  const { profile } = await mutateUser(
    userId,
    () => {
      created = true;
      return newProfile(userId, displayName);
    },
    (p, ctx) => {
      const isNew = created;
      created = false;
      if (!isNew && displayName?.trim() && p.displayName !== displayName.trim()) {
        p.displayName = displayName.trim();
        p.updatedAt = new Date().toISOString();
      } else if (!isNew) {
        ctx.skipSave();
      }
    },
  );
  return profile;
}

/** Hexagon for one subject. Users with no stats get an all-zero hexagon (not a 404). */
export async function getHexagon(
  userId: string,
  subjectId: SubjectId = DEFAULT_SUBJECT,
  db?: SupabaseClient,
): Promise<HexagonView> {
  const def = getSubject(subjectId);
  const profile = await readUser(userId, db);
  return buildHexagon(def, profile?.subjects[subjectId] ?? emptySubjectState(def));
}

/** Every subject's hexagon for a profile (including subjects not started). */
export function hexagonsFor(profile: UserProfile | null): HexagonView[] {
  return listSubjects().map((def) =>
    buildHexagon(def, profile?.subjects[def.id] ?? emptySubjectState(def)),
  );
}

/** Every subject's hexagon for a user (zeros if they have no stats yet). */
export async function getAllHexagons(userId: string, db?: SupabaseClient): Promise<HexagonView[]> {
  return hexagonsFor(await readUser(userId, db));
}

/** A user's whole stats file (Markdown), e.g. for uploading to student_files. 404 if none. */
export async function getUserFile(userId: string): Promise<string> {
  return readUserFile(userId);
}

/** The user's running feedback, if a session has produced any yet. */
export async function getFeedback(userId: string, db?: SupabaseClient): Promise<StudentFeedback | null> {
  return (await readUser(userId, db))?.feedback ?? null;
}

/** The feedback stored in the text of a stats file. */
export function feedbackFromFile(md: string): StudentFeedback | null {
  return parseUserMarkdown(md).feedback ?? null;
}

/** The hexagon stored in the text of a stats file. */
export function hexagonFromFile(md: string, subjectId: SubjectId = DEFAULT_SUBJECT): HexagonView {
  const def = getSubject(subjectId);
  return buildHexagon(def, parseUserMarkdown(md).subjects[subjectId] ?? emptySubjectState(def));
}

/** Replace the user's running feedback. 404 if they have no stats yet. */
export async function saveFeedback(
  userId: string,
  feedback: Omit<StudentFeedback, 'updatedAt'>,
): Promise<void> {
  await mutateUser(
    userId,
    () => notFound(userId),
    (p) => {
      p.updatedAt = new Date().toISOString();
      p.feedback = { ...feedback, updatedAt: p.updatedAt };
    },
  );
}

// ---------- classification ----------

export interface ProvidedClassification {
  weights: StatWeights;
  depth?: QuestionDepth;
  quality?: QuestionQuality;
  isAnswer?: boolean;
}

/**
 * Resolve the classification for a question: use the caller's (e.g. the LLM's)
 * if given and valid, otherwise fall back to the keyword classifier.
 */
export function resolveClassification(
  subjectId: SubjectId,
  question: string,
  provided?: ProvidedClassification,
): Classification {
  const def = getSubject(subjectId);
  const fallback = classifyQuestion(def, question);
  // A rating of "none" is a decision, so don't let the keywords overrule it.
  if (provided?.quality === 'none') {
    return { weights: {}, depth: fallback.depth, quality: 'none', source: 'provided' };
  }
  if (provided && provided.weights && typeof provided.weights === 'object') {
    const valid = Object.entries(provided.weights).filter(
      ([id, w]) => isStatOf(def, id) && typeof w === 'number' && w > 0,
    );
    if (valid.length > 0) {
      return {
        weights: Object.fromEntries(valid),
        depth: isDepth(provided.depth) ? provided.depth : fallback.depth,
        quality: provided.quality,
        isAnswer: provided.isAnswer,
        source: 'provided',
      };
    }
  }
  return fallback;
}

// ---------- awarding ----------

export interface RecordQuestionInput {
  /** Supabase auth user id of the student who asked. */
  userId: string;
  question: string;
  subject?: SubjectId;
  /** Optional: the chatbot's own classification. Strongly recommended. */
  classification?: ProvidedClassification;
  /** Used only when the user's stats row is first created. */
  displayName?: string;
}

/**
 * THE main entry point: a user asked the chatbot a question → award XP.
 * Creates the stats row on first use. Safe under concurrent calls.
 */
export async function recordQuestion(input: RecordQuestionInput): Promise<AwardResult> {
  const { userId, question } = input;
  const subjectId = input.subject ?? DEFAULT_SUBJECT;
  assertValidUserId(userId);
  if (typeof question !== 'string' || !question.trim()) {
    throw new StatsError('question is required', 400);
  }
  const def = getSubject(subjectId);
  const classification = resolveClassification(subjectId, question, input.classification);

  const { profile, result } = await mutateUser(
    userId,
    () => newProfile(userId, input.displayName),
    (p) => {
      const state = subjectState(p, subjectId);
      const now = new Date();
      const { gains, notes, hash } = computeQuestionGains(def, state, question, classification, now);
      const earned = Object.keys(gains).length > 0;
      const rankUps = applyGains(state, gains, {
        hash: classification.isAnswer ? undefined : hash,
        countsAsQuestion: earned,
        trackDaily: true,
        now,
      });
      p.updatedAt = now.toISOString();
      p.activity.unshift({
        at: p.updatedAt,
        subject: subjectId,
        question: question.trim().slice(0, 200),
        depth: classification.depth,
        gains,
        rankUps,
      });
      return { gains, notes, rankUps };
    },
  );

  return {
    userId,
    subject: subjectId,
    classification,
    gains: result.gains,
    totalGain: sum(result.gains),
    rankUps: result.rankUps,
    notes: result.notes,
    hexagon: buildHexagon(def, profile.subjects[subjectId]),
  };
}

export interface DirectAwardInput {
  userId: string;
  subject?: SubjectId;
  /** statId -> XP to add. Clamped to MAX_DIRECT_AWARD each. */
  xp: Partial<Record<StatId, number>>;
  /** Shown in the activity log, e.g. "Completed quiz: Graph basics". */
  reason: string;
  /** Count this against the daily cap instead of bypassing it. */
  respectDailyCap?: boolean;
}

/**
 * Award XP directly (quizzes, streak bonuses, teacher tools). Skips the
 * classifier and duplicate check, and the daily cap unless `respectDailyCap`
 * is set, but is clamped per stat per call.
 */
export async function awardXp(input: DirectAwardInput): Promise<AwardResult> {
  const subjectId = input.subject ?? DEFAULT_SUBJECT;
  assertValidUserId(input.userId);
  const def = getSubject(subjectId);
  if (typeof input.reason !== 'string' || !input.reason.trim()) {
    throw new StatsError('reason is required', 400);
  }

  const clamped: Record<StatId, number> = {};
  for (const [stat, v] of Object.entries(input.xp ?? {})) {
    if (!isStatOf(def, stat)) throw new StatsError(`Unknown stat "${stat}" for ${subjectId}`, 400);
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n > 0) clamped[stat] = Math.min(n, MAX_DIRECT_AWARD);
  }
  if (Object.keys(clamped).length === 0) {
    throw new StatsError('xp must contain at least one positive value', 400);
  }

  const capped = input.respectDailyCap ?? false;
  const { profile, result } = await mutateUser(
    input.userId,
    () => newProfile(input.userId),
    (p) => {
      const state = subjectState(p, subjectId);
      const now = new Date();
      const { gains, notes } = capped
        ? capToDailyLimit(state, clamped, now)
        : { gains: { ...clamped }, notes: [] as string[] };
      const rankUps = applyGains(state, gains, { countsAsQuestion: false, trackDaily: capped, now });
      p.updatedAt = now.toISOString();
      p.activity.unshift({
        at: p.updatedAt,
        subject: subjectId,
        question: `[award] ${input.reason.trim().slice(0, 190)}`,
        depth: 'apply',
        gains,
        rankUps,
      });
      return { gains, notes, rankUps };
    },
  );

  return {
    userId: input.userId,
    subject: subjectId,
    classification: { weights: {}, depth: 'apply', source: 'provided' },
    gains: result.gains,
    totalGain: sum(result.gains),
    rankUps: result.rankUps,
    notes: result.notes,
    hexagon: buildHexagon(def, profile.subjects[subjectId]),
  };
}

/**
 * Take XP away, e.g. for a failed quiz. Returns what was removed from each stat,
 * which can be less than asked for because a stat can't go below 0. The daily
 * cap isn't given back, so a student can't lose XP and earn it again the same day.
 */
export async function deductXp(input: DirectAwardInput): Promise<Record<StatId, number>> {
  const subjectId = input.subject ?? DEFAULT_SUBJECT;
  assertValidUserId(input.userId);
  getSubject(subjectId);

  const { result } = await mutateUser(
    input.userId,
    () => newProfile(input.userId),
    (p, ctx) => {
      const removed = removeXp(subjectState(p, subjectId), input.xp as Record<StatId, number>);
      if (Object.keys(removed).length === 0) {
        ctx.skipSave();
        return removed;
      }
      p.updatedAt = new Date().toISOString();
      p.activity.unshift({
        at: p.updatedAt,
        subject: subjectId,
        question: `[penalty] ${input.reason.trim().slice(0, 190)}`,
        depth: 'apply',
        gains: Object.fromEntries(Object.entries(removed).map(([stat, xp]) => [stat, -xp])),
        rankUps: [],
      });
      return removed;
    },
  );
  return result;
}

/** Wipe a user's progress in one subject (keeps the row). 404 if they have no stats. */
export async function resetSubject(
  userId: string,
  subjectId: SubjectId = DEFAULT_SUBJECT,
): Promise<HexagonView> {
  const def = getSubject(subjectId);
  const { profile } = await mutateUser(
    userId,
    () => notFound(userId),
    (p) => {
      p.subjects[subjectId] = emptySubjectState(def);
      p.activity = p.activity.filter((a) => a.subject !== subjectId);
      p.updatedAt = new Date().toISOString();
    },
  );
  return buildHexagon(def, profile.subjects[subjectId]);
}

// ---------- leaderboard ----------

export interface LeaderboardEntry {
  position: number;
  userId: string;
  displayName: string;
  score: number; // XP in the chosen stat, or total subject XP
  rank: number; // stat rank, or overall subject rank
  rankTitle?: string;
}

/**
 * Rank students (role = 'student') by total subject XP, or by one stat if
 * `stat` is given. Reads every stats row with the admin client — fine for a
 * class; add a SQL view/RPC if it grows.
 */
export async function getLeaderboard(opts: {
  subject?: SubjectId;
  stat?: StatId;
  limit?: number;
}): Promise<LeaderboardEntry[]> {
  const subjectId = opts.subject ?? DEFAULT_SUBJECT;
  const def = getSubject(subjectId);
  if (opts.stat && !isStatOf(def, opts.stat)) {
    throw new StatsError(`Unknown stat "${opts.stat}" for ${subjectId}`, 400);
  }
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 10) || 10, 1), 100);

  const [profiles, students] = await Promise.all([listProfiles(), listStudentIds()]);

  const rows = profiles
    .filter((p) => students.has(p.userId))
    .map((p) => {
      const hex = buildHexagon(def, p.subjects[subjectId] ?? emptySubjectState(def));
      if (opts.stat) {
        const axis = hex.axes.find((a) => a.id === opts.stat)!;
        return {
          userId: p.userId,
          displayName: p.displayName,
          score: axis.xp,
          rank: axis.rank,
          rankTitle: axis.rankTitle,
        };
      }
      return { userId: p.userId, displayName: p.displayName, score: hex.totalXp, rank: hex.overallRank };
    });

  rows.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));
  return rows.slice(0, limit).map((r, i) => ({ position: i + 1, ...r }));
}
