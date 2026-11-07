/**
 * Public API of the stats backbone. Import from "@features/logic/stats".
 *
 * Server-only (talks to Supabase with the service_role key). Client components
 * may import types only, from "@features/logic/stats/types".
 */
export * from './types';
export * from './config';
export { SUBJECTS, DEFAULT_SUBJECT, getSubject, listSubjects, StatsError } from './subjects';
export { classifyQuestion } from './classifier';
export { rankForXp, rankTitle, buildHexagon } from './engine';
export { renderUserMarkdown } from './markdown';
export {
  getUser,
  getHexagon,
  hexagonsFor,
  resolveClassification,
  recordQuestion,
  awardXp,
  resetSubject,
  getLeaderboard,
} from './service';
export type {
  RecordQuestionInput,
  DirectAwardInput,
  ProvidedClassification,
  LeaderboardEntry,
} from './service';
