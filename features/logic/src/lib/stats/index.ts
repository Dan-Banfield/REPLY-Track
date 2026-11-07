/**
 * Public API of the stats backbone. Import from "@/lib/stats".
 *
 * Server-only (uses node:fs). Client components should call the HTTP routes
 * under /api, or import only from "./types".
 */
export * from "./types";
export * from "./config";
export { SUBJECTS, DEFAULT_SUBJECT, getSubject, listSubjects, StatsError } from "./subjects";
export { classifyQuestion } from "./classifier";
export { rankForXp, rankTitle, buildHexagon } from "./engine";
export {
  getUser,
  upsertUser,
  getHexagon,
  getAllHexagons,
  resolveClassification,
  recordQuestion,
  awardXp,
  resetSubject,
  getLeaderboard,
} from "./service";
export type {
  RecordQuestionInput,
  DirectAwardInput,
  ProvidedClassification,
  LeaderboardEntry,
} from "./service";
