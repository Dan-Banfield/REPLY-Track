/**
 * Public API of the stats backbone. Import from "@features/logic/stats".
 *
 * Server-only (uses node:fs). Client components may only import types, from
 * "./types".
 */
export * from "./types";
export * from "./config";
export { SUBJECTS, DEFAULT_SUBJECT, getSubject, listSubjects, StatsError } from "./subjects";
export { classifyQuestion } from "./classifier";
export { rankForXp, rankTitle, buildHexagon } from "./engine";
export { userFileDetails } from "./store";
export {
  getUser,
  upsertUser,
  getHexagon,
  getAllHexagons,
  feedbackFromFile,
  getFeedback,
  getUserFile,
  hexagonFromFile,
  saveFeedback,
  resolveClassification,
  recordQuestion,
  awardXp,
  deductXp,
  resetSubject,
  getLeaderboard,
} from "./service";
export type {
  RecordQuestionInput,
  DirectAwardInput,
  ProvidedClassification,
  LeaderboardEntry,
} from "./service";
