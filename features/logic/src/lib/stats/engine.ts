/**
 * Pure stat maths. No I/O here — everything takes state in and returns new values,
 * so it can be unit tested or reused client-side for previews.
 */
import { createHash } from "node:crypto";
import {
  BASE_XP,
  DAILY_CAP_PER_STAT,
  DAILY_HISTORY_DAYS,
  DEPTH_MULTIPLIER,
  MAX_RANK,
  MIN_QUESTION_LENGTH,
  MIN_WEIGHT,
  RANK_THRESHOLDS,
  RANK_TITLES,
  RECENT_HASHES_KEPT,
} from "./config";
import type {
  Classification,
  HexagonView,
  RankUp,
  StatId,
  StatWeights,
  SubjectDefinition,
  SubjectState,
} from "./types";

// ---------- ranks ----------

export function rankForXp(xp: number): number {
  let rank = 1;
  for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
    if (xp >= RANK_THRESHOLDS[i]) rank = i + 1;
  }
  return rank;
}

export function rankTitle(rank: number): string {
  return RANK_TITLES[Math.min(Math.max(rank, 1), MAX_RANK) - 1];
}

/** 0..1 progress from the current rank threshold to the next. 1 if maxed. */
export function progressToNext(xp: number): number {
  const rank = rankForXp(xp);
  if (rank >= MAX_RANK) return 1;
  const lo = RANK_THRESHOLDS[rank - 1];
  const hi = RANK_THRESHOLDS[rank];
  return (xp - lo) / (hi - lo);
}

export function xpForNextRank(xp: number): number | null {
  const rank = rankForXp(xp);
  return rank >= MAX_RANK ? null : RANK_THRESHOLDS[rank];
}

/** 0..1 position along the whole ladder, linear in rank (not XP) so the hexagon grows evenly. */
export function hexagonValue(xp: number): number {
  const rank = rankForXp(xp);
  if (MAX_RANK <= 1) return 1;
  return Math.min(1, (rank - 1 + (rank >= MAX_RANK ? 0 : progressToNext(xp))) / (MAX_RANK - 1));
}

// ---------- state ----------

export function emptySubjectState(subject: SubjectDefinition): SubjectState {
  const stats: SubjectState["stats"] = {};
  for (const s of subject.stats) stats[s.id] = { xp: 0, rank: 1, questions: 0 };
  return { stats, totalXp: 0, questions: 0, daily: {}, recentQuestionHashes: [] };
}

/** Adds any stats that were added to the subject definition after the user was created. */
export function migrateSubjectState(subject: SubjectDefinition, state: SubjectState): SubjectState {
  for (const s of subject.stats) {
    state.stats[s.id] ??= { xp: 0, rank: 1, questions: 0 };
  }
  state.daily ??= {};
  state.recentQuestionHashes ??= [];
  return state;
}

export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function questionHash(question: string): string {
  const normalised = question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return createHash("sha1").update(normalised).digest("hex").slice(0, 16);
}

// ---------- weights ----------

/**
 * Keep only valid, positive stats; normalise to sum 1; drop tiny weights and renormalise.
 * Returns {} if nothing valid remains.
 */
export function normaliseWeights(subject: SubjectDefinition, weights: StatWeights): Record<StatId, number> {
  const valid = new Set(subject.stats.map((s) => s.id));
  let entries = Object.entries(weights).filter(
    ([id, w]) => valid.has(id) && typeof w === "number" && Number.isFinite(w) && w > 0,
  ) as [StatId, number][];

  const normalise = (es: [StatId, number][]) => {
    const sum = es.reduce((a, [, w]) => a + w, 0);
    return es.map(([id, w]) => [id, w / sum] as [StatId, number]);
  };

  if (entries.length === 0) return {};
  entries = normalise(entries);
  const kept = entries.filter(([, w]) => w >= MIN_WEIGHT);
  // If everything was tiny (e.g. 11 equal weights) keep the original set.
  entries = kept.length > 0 ? normalise(kept) : entries;
  return Object.fromEntries(entries);
}

// ---------- awarding ----------

export interface ComputedGains {
  gains: Record<StatId, number>;
  notes: string[];
  hash: string;
}

/**
 * Work out how much XP a question earns, respecting duplicates and daily caps.
 * Does NOT mutate state.
 */
export function computeQuestionGains(
  subject: SubjectDefinition,
  state: SubjectState,
  question: string,
  classification: Classification,
  now: Date = new Date(),
): ComputedGains {
  const notes: string[] = [];
  const hash = questionHash(question);
  const gains: Record<StatId, number> = {};

  if (question.trim().length < MIN_QUESTION_LENGTH) {
    notes.push("Question too short to earn XP.");
    return { gains, notes, hash };
  }
  if (state.recentQuestionHashes.includes(hash)) {
    notes.push("Duplicate of a recent question; no XP awarded.");
    return { gains, notes, hash };
  }

  const weights = normaliseWeights(subject, classification.weights);
  if (Object.keys(weights).length === 0) {
    notes.push("Could not match the question to any stat; no XP awarded.");
    return { gains, notes, hash };
  }

  const pool = BASE_XP * DEPTH_MULTIPLIER[classification.depth];
  const today = state.daily[utcDay(now)] ?? {};

  for (const [stat, w] of Object.entries(weights)) {
    const raw = Math.max(1, Math.round(pool * w));
    const used = today[stat] ?? 0;
    const allowed = Math.max(0, DAILY_CAP_PER_STAT - used);
    const gain = Math.min(raw, allowed);
    if (gain < raw) {
      notes.push(
        allowed === 0
          ? `Daily cap reached for "${stat}".`
          : `Daily cap limited "${stat}" to +${gain}.`,
      );
    }
    if (gain > 0) gains[stat] = gain;
  }

  return { gains, notes, hash };
}

/**
 * Apply XP gains to subject state (MUTATES state). Returns rank-ups.
 * `countsAsQuestion` controls whether question counters / dedupe history are updated.
 */
export function applyGains(
  state: SubjectState,
  gains: Record<StatId, number>,
  opts: { hash?: string; countsAsQuestion: boolean; trackDaily: boolean; now?: Date },
): RankUp[] {
  const now = opts.now ?? new Date();
  const day = utcDay(now);
  const rankUps: RankUp[] = [];

  for (const [stat, gain] of Object.entries(gains)) {
    const s = state.stats[stat];
    if (!s || gain <= 0) continue;
    const before = s.rank;
    s.xp += gain;
    s.rank = rankForXp(s.xp);
    if (opts.countsAsQuestion) s.questions += 1;
    state.totalXp += gain;
    if (opts.trackDaily) {
      const d = (state.daily[day] ??= {});
      d[stat] = (d[stat] ?? 0) + gain;
    }
    if (s.rank > before) {
      rankUps.push({ stat, from: before, to: s.rank, title: rankTitle(s.rank) });
    }
  }

  if (opts.countsAsQuestion) {
    state.questions += 1;
    if (opts.hash) {
      state.recentQuestionHashes = [opts.hash, ...state.recentQuestionHashes].slice(0, RECENT_HASHES_KEPT);
    }
  }

  // Prune old daily bookkeeping.
  const cutoff = utcDay(new Date(now.getTime() - DAILY_HISTORY_DAYS * 86_400_000));
  for (const k of Object.keys(state.daily)) if (k < cutoff) delete state.daily[k];

  return rankUps;
}

// ---------- views ----------

export function buildHexagon(subject: SubjectDefinition, state: SubjectState): HexagonView {
  const axes = subject.stats.map((def) => {
    const s = state.stats[def.id] ?? { xp: 0, rank: 1, questions: 0 };
    return {
      id: def.id,
      label: def.label,
      color: def.color,
      xp: s.xp,
      rank: s.rank,
      rankTitle: rankTitle(s.rank),
      value: round3(hexagonValue(s.xp)),
      progressToNext: round3(progressToNext(s.xp)),
      xpForNextRank: xpForNextRank(s.xp),
      questions: s.questions,
    };
  });
  const overallRank = Math.floor(axes.reduce((a, x) => a + x.rank, 0) / axes.length);
  return {
    subject: subject.id,
    label: subject.label,
    totalXp: state.totalXp,
    questions: state.questions,
    overallRank,
    axes,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
