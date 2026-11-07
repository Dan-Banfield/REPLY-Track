import type { QuestionDepth, QuestionQuality } from "./types";

/**
 * Tunable game-balance numbers. Change these freely; nothing else hardcodes them.
 */

/** XP a single "clarify"-depth question is worth before splitting across stats. */
export const BASE_XP = 10;

/** Deeper questions earn more. */
export const DEPTH_MULTIPLIER: Record<QuestionDepth, number> = {
  recall: 0.6, // "what is the formula for..."
  clarify: 1.0, // "I don't get what X means"
  apply: 1.3, // "how do I solve..."
  conceptual: 1.6, // "why does X work / how does X relate to Y"
};

/** The scorer's rating decides how much of that a message actually earns. */
export const QUALITY_MULTIPLIER: Record<QuestionQuality, number> = {
  none: 0, // no real effort, or a wrong answer
  basic: 0.25, // a plain request with no thinking shown, or a partly right answer
  good: 0.6, // a specific question, or a correct answer
  excellent: 1, // shows their own reasoning
};

/**
 * Cumulative XP needed to reach each rank. Index 0 = rank 1.
 * Length defines MAX_RANK.
 */
export const RANK_THRESHOLDS = [0, 40, 120, 300, 600] as const;
export const MAX_RANK = RANK_THRESHOLDS.length;

/** Title shown for each rank (same ladder for every stat). Index 0 = rank 1. */
export const RANK_TITLES = ["Novice", "Apprentice", "Adept", "Expert", "Master"] as const;

/** Max XP a single stat can gain per UTC day from questions and quizzes (anti-grinding). */
export const DAILY_CAP_PER_STAT = 50;

/** Stats with a normalised weight below this get nothing (weight is redistributed). */
export const MIN_WEIGHT = 0.1;

/** Questions shorter than this (after trimming) earn no XP. */
export const MIN_QUESTION_LENGTH = 8;

/** How many recent question hashes to remember for duplicate detection. */
export const RECENT_HASHES_KEPT = 50;

/** How many activity entries to keep in a user's file. */
export const MAX_ACTIVITY = 50;

/** Days of daily-cap bookkeeping to keep. */
export const DAILY_HISTORY_DAYS = 7;

/** Direct awards (POST /award) are clamped to this per stat per call. */
export const MAX_DIRECT_AWARD = 50;
