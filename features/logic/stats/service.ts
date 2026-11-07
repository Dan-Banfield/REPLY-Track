/**
 * High-level operations. Route handlers (and any server code: server actions,
 * the chatbot route, etc.) should call these rather than touching the store.
 */
import { classifyQuestion } from "./classifier";
import { DEPTH_MULTIPLIER, MAX_DIRECT_AWARD } from "./config";
import {
  applyGains,
  buildHexagon,
  capToDailyLimit,
  computeQuestionGains,
  emptySubjectState,
  removeXp,
} from "./engine";
import {
  assertValidUserId,
  listUserIds,
  parseUserMarkdown,
  readUser,
  readUserFile,
  withUserLock,
  writeUser,
} from "./store";
import { DEFAULT_SUBJECT, getSubject, isStatOf, listSubjects, StatsError } from "./subjects";
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
} from "./types";

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
  return typeof x === "string" && x in DEPTH_MULTIPLIER;
}

// ---------- users ----------

/** Get a user, or throw 404. */
export async function getUser(userId: string): Promise<UserProfile> {
  assertValidUserId(userId);
  const profile = await readUser(userId);
  if (!profile) throw new StatsError(`User "${userId}" not found`, 404);
  return profile;
}

/** Create the user if missing; optionally update display name. Idempotent. */
export async function upsertUser(userId: string, displayName?: string): Promise<UserProfile> {
  assertValidUserId(userId);
  return withUserLock(userId, async () => {
    let profile = await readUser(userId);
    if (!profile) {
      profile = newProfile(userId, displayName);
    } else if (displayName?.trim()) {
      profile.displayName = displayName.trim();
    } else {
      return profile;
    }
    profile.updatedAt = new Date().toISOString();
    await writeUser(profile);
    return profile;
  });
}

/** Hexagon for one subject. Unknown users get an all-zero hexagon (not a 404) for easy rendering. */
export async function getHexagon(userId: string, subjectId: SubjectId = DEFAULT_SUBJECT): Promise<HexagonView> {
  assertValidUserId(userId);
  const def = getSubject(subjectId);
  const profile = await readUser(userId);
  const state = profile?.subjects[subjectId] ?? emptySubjectState(def);
  return buildHexagon(def, state);
}

/** Every subject's hexagon for a user (including subjects they haven't started). */
export async function getAllHexagons(userId: string): Promise<HexagonView[]> {
  assertValidUserId(userId);
  const profile = await readUser(userId);
  return listSubjects().map((def) =>
    buildHexagon(def, profile?.subjects[def.id] ?? emptySubjectState(def)),
  );
}

/** A user's whole stats file, for uploading. */
export async function getUserFile(userId: string): Promise<string> {
  assertValidUserId(userId);
  return readUserFile(userId);
}

/** The user's running feedback, if a session has produced any yet. */
export async function getFeedback(userId: string): Promise<StudentFeedback | null> {
  assertValidUserId(userId);
  return (await readUser(userId))?.feedback ?? null;
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

/** Replace the user's running feedback. */
export async function saveFeedback(
  userId: string,
  feedback: Omit<StudentFeedback, "updatedAt">,
): Promise<void> {
  assertValidUserId(userId);
  return withUserLock(userId, async () => {
    const profile = await getUser(userId);
    profile.updatedAt = new Date().toISOString();
    profile.feedback = { ...feedback, updatedAt: profile.updatedAt };
    await writeUser(profile);
  });
}

// ---------- classification ----------

export interface ProvidedClassification {
  weights: StatWeights;
  depth?: QuestionDepth;
  quality?: QuestionQuality;
  isAnswer?: boolean;
}

/**
 * Resolve the classification for a question: use the caller's (e.g. LLM's) if
 * given and valid, otherwise fall back to the keyword classifier.
 */
export function resolveClassification(
  subjectId: SubjectId,
  question: string,
  provided?: ProvidedClassification,
): Classification {
  const def = getSubject(subjectId);
  const fallback = classifyQuestion(def, question);
  // A rating of "none" is a decision, so don't let the keywords overrule it.
  if (provided?.quality === "none") {
    return { weights: {}, depth: fallback.depth, quality: "none", source: "provided" };
  }
  if (provided && provided.weights && typeof provided.weights === "object") {
    const valid = Object.entries(provided.weights).filter(
      ([id, w]) => isStatOf(def, id) && typeof w === "number" && w > 0,
    );
    if (valid.length > 0) {
      return {
        weights: Object.fromEntries(valid),
        depth: isDepth(provided.depth) ? provided.depth : fallback.depth,
        quality: provided.quality,
        isAnswer: provided.isAnswer,
        source: "provided",
      };
    }
  }
  return fallback;
}

// ---------- awarding ----------

export interface RecordQuestionInput {
  userId: string;
  question: string;
  subject?: SubjectId;
  /** Optional: the chatbot's own classification. Strongly recommended. */
  classification?: ProvidedClassification;
  /** Used only if the user doesn't exist yet. */
  displayName?: string;
}

/**
 * THE main entry point: a user asked the chatbot a question → award XP.
 * Auto-creates the user. Safe under concurrent calls for the same user.
 */
export async function recordQuestion(input: RecordQuestionInput): Promise<AwardResult> {
  const { userId, question } = input;
  const subjectId = input.subject ?? DEFAULT_SUBJECT;
  assertValidUserId(userId);
  if (typeof question !== "string" || !question.trim()) {
    throw new StatsError("question is required", 400);
  }
  const def = getSubject(subjectId);
  const classification = resolveClassification(subjectId, question, input.classification);

  return withUserLock(userId, async () => {
    const profile = (await readUser(userId)) ?? newProfile(userId, input.displayName);
    const state = subjectState(profile, subjectId);
    const now = new Date();

    const { gains, notes, hash } = computeQuestionGains(def, state, question, classification, now);
    const earned = Object.keys(gains).length > 0;
    const rankUps = applyGains(state, gains, {
      hash: classification.isAnswer ? undefined : hash,
      countsAsQuestion: earned,
      trackDaily: true,
      now,
    });

    profile.updatedAt = now.toISOString();
    profile.activity.unshift({
      at: profile.updatedAt,
      subject: subjectId,
      question: question.trim().slice(0, 200),
      depth: classification.depth,
      gains,
      rankUps,
    });
    await writeUser(profile);

    return {
      userId,
      subject: subjectId,
      classification,
      gains,
      totalGain: Object.values(gains).reduce((a, b) => a + b, 0),
      rankUps,
      notes,
      hexagon: buildHexagon(def, state),
    };
  });
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
 * Award XP directly (quizzes, streak bonuses, admin tools). Bypasses classifier
 * and duplicate check, and the daily cap unless `respectDailyCap` is set, but is
 * clamped per stat per call.
 */
export async function awardXp(input: DirectAwardInput): Promise<AwardResult> {
  const subjectId = input.subject ?? DEFAULT_SUBJECT;
  assertValidUserId(input.userId);
  const def = getSubject(subjectId);
  if (!input.reason?.trim()) throw new StatsError("reason is required", 400);

  const clamped: Record<StatId, number> = {};
  for (const [stat, v] of Object.entries(input.xp ?? {})) {
    if (!isStatOf(def, stat)) throw new StatsError(`Unknown stat "${stat}" for ${subjectId}`, 400);
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n > 0) clamped[stat] = Math.min(n, MAX_DIRECT_AWARD);
  }
  if (Object.keys(clamped).length === 0) throw new StatsError("xp must contain at least one positive value", 400);

  return withUserLock(input.userId, async () => {
    const profile = (await readUser(input.userId)) ?? newProfile(input.userId);
    const state = subjectState(profile, subjectId);
    const now = new Date();
    const capped = input.respectDailyCap ?? false;
    const { gains, notes } = capped
      ? capToDailyLimit(state, clamped, now)
      : { gains: clamped, notes: [] };
    const rankUps = applyGains(state, gains, { countsAsQuestion: false, trackDaily: capped, now });

    profile.updatedAt = now.toISOString();
    profile.activity.unshift({
      at: profile.updatedAt,
      subject: subjectId,
      question: `[award] ${input.reason.trim().slice(0, 190)}`,
      depth: "apply",
      gains,
      rankUps,
    });
    await writeUser(profile);

    return {
      userId: input.userId,
      subject: subjectId,
      classification: { weights: {}, depth: "apply", source: "provided" },
      gains,
      totalGain: Object.values(gains).reduce((a, b) => a + b, 0),
      rankUps,
      notes,
      hexagon: buildHexagon(def, state),
    };
  });
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

  return withUserLock(input.userId, async () => {
    const profile = (await readUser(input.userId)) ?? newProfile(input.userId);
    const removed = removeXp(subjectState(profile, subjectId), input.xp as Record<StatId, number>);
    if (Object.keys(removed).length === 0) return removed;

    profile.updatedAt = new Date().toISOString();
    profile.activity.unshift({
      at: profile.updatedAt,
      subject: subjectId,
      question: `[penalty] ${input.reason.trim().slice(0, 190)}`,
      depth: "apply",
      gains: Object.fromEntries(Object.entries(removed).map(([stat, xp]) => [stat, -xp])),
      rankUps: [],
    });
    await writeUser(profile);
    return removed;
  });
}

/** Wipe a user's progress in one subject (keeps the user). */
export async function resetSubject(userId: string, subjectId: SubjectId = DEFAULT_SUBJECT): Promise<HexagonView> {
  const def = getSubject(subjectId);
  return withUserLock(userId, async () => {
    const profile = await getUser(userId);
    profile.subjects[subjectId] = emptySubjectState(def);
    profile.activity = profile.activity.filter((a) => a.subject !== subjectId);
    profile.updatedAt = new Date().toISOString();
    await writeUser(profile);
    return buildHexagon(def, profile.subjects[subjectId]);
  });
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
 * Rank users by total subject XP, or by a single stat if `stat` is given.
 * Reads every user file — fine for a hackathon, swap for a DB later.
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
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 100);

  const ids = await listUserIds();
  const profiles = (await Promise.all(ids.map((id) => readUser(id).catch(() => null)))).filter(
    (p): p is UserProfile => !!p,
  );

  const rows = profiles.map((p) => {
    const hex = buildHexagon(def, p.subjects[subjectId] ?? emptySubjectState(def));
    if (opts.stat) {
      const axis = hex.axes.find((a) => a.id === opts.stat)!;
      return { userId: p.userId, displayName: p.displayName, score: axis.xp, rank: axis.rank, rankTitle: axis.rankTitle };
    }
    return { userId: p.userId, displayName: p.displayName, score: hex.totalXp, rank: hex.overallRank };
  });

  rows.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));
  return rows.slice(0, limit).map((r, i) => ({ position: i + 1, ...r }));
}
