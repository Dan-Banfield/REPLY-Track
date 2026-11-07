/**
 * Core types for the hexagon stat system.
 *
 * A "subject" (e.g. maths) has exactly six stats, one per hexagon vertex.
 * Each stat accumulates XP; XP maps to a rank (1..MAX_RANK) with a title.
 */

export type SubjectId = string; // e.g. "maths"
export type StatId = string; // e.g. "discrete"

export interface StatDefinition {
  id: StatId;
  label: string; // Display name, e.g. "Discrete"
  description: string;
  color: string; // Suggested hex colour for UI
  /** Lowercase keywords/phrases used by the fallback classifier. */
  keywords: string[];
}

export interface SubjectDefinition {
  id: SubjectId;
  label: string;
  /** Exactly 6 stats, in clockwise order starting from the top vertex. */
  stats: [
    StatDefinition,
    StatDefinition,
    StatDefinition,
    StatDefinition,
    StatDefinition,
    StatDefinition,
  ];
}

/** How deep/valuable a question is. Multiplies the base XP. */
export type QuestionDepth = "recall" | "clarify" | "apply" | "conceptual";

/** How much a message deserves, judged by the scorer. Multiplies the XP again. */
export type QuestionQuality = "none" | "basic" | "good" | "excellent";

/**
 * Maps stat ids to relative weights (any non-negative numbers).
 * They are normalised to sum to 1 before XP is split.
 * e.g. { discrete: 0.7, probability: 0.3 }
 */
export type StatWeights = Partial<Record<StatId, number>>;

export interface Classification {
  weights: StatWeights;
  depth: QuestionDepth;
  /** Only set by a scorer. Without one, the message counts as "basic". */
  quality?: QuestionQuality;
  /** The student answering the tutor, not asking. Short and repeated answers are allowed. */
  isAnswer?: boolean;
  /** Where the classification came from. */
  source: "provided" | "keyword" | "none";
  /** Keyword hits per stat (only for source = "keyword"), handy for debugging. */
  matches?: Record<StatId, string[]>;
}

export interface StatState {
  xp: number;
  rank: number; // 1..MAX_RANK
  questions: number; // how many questions contributed to this stat
}

export interface SubjectState {
  stats: Record<StatId, StatState>;
  totalXp: number;
  questions: number;
  /** ISO date (YYYY-MM-DD) -> statId -> xp earned that day (for the daily cap). */
  daily: Record<string, Record<StatId, number>>;
  /** Hashes of recent questions to block repeat-spam farming. */
  recentQuestionHashes: string[];
}

export interface ActivityEntry {
  at: string; // ISO timestamp
  subject: SubjectId;
  question: string; // truncated
  depth: QuestionDepth;
  gains: Record<StatId, number>;
  rankUps: RankUp[];
}

/** A running note about the student, rewritten after each session. */
export interface StudentFeedback {
  summary: string;
  strengths: string[];
  workOn: string[];
  updatedAt: string;
}

export interface UserProfile {
  schemaVersion: 1;
  userId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  subjects: Record<SubjectId, SubjectState>;
  /** Most recent first, capped (see MAX_ACTIVITY). */
  activity: ActivityEntry[];
  feedback?: StudentFeedback;
}

export interface RankUp {
  stat: StatId;
  from: number;
  to: number;
  title: string;
}

export interface AwardResult {
  userId: string;
  subject: SubjectId;
  classification: Classification;
  /** Actual XP added per stat after caps (0s omitted). */
  gains: Record<StatId, number>;
  totalGain: number;
  rankUps: RankUp[];
  /** Why XP may have been reduced/blocked. */
  notes: string[];
  hexagon: HexagonView;
}

/** Frontend-ready view of one subject's hexagon. */
export interface HexagonView {
  subject: SubjectId;
  label: string;
  totalXp: number;
  questions: number;
  /** Overall level = average rank, rounded down. */
  overallRank: number;
  axes: HexagonAxis[];
}

export interface HexagonAxis {
  id: StatId;
  label: string;
  color: string;
  xp: number;
  rank: number;
  rankTitle: string;
  /** 0..1 — how far along the whole rank ladder this stat is. Use for the radar shape. */
  value: number;
  /** 0..1 — progress from current rank to the next (1 when maxed). Use for progress bars. */
  progressToNext: number;
  xpForNextRank: number | null; // null when maxed
  questions: number;
}
