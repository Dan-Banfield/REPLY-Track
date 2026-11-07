import { MAX_RANK, RANK_THRESHOLDS, RANK_TITLES } from '../config';
import { listSubjects } from '../subjects';

/** GET /api/stats/subjects — subject + stat definitions and the rank ladder. Static. */
export async function GET() {
  return Response.json({
    subjects: listSubjects().map((s) => ({
      id: s.id,
      label: s.label,
      stats: s.stats.map(({ id, label, description, color }) => ({ id, label, description, color })),
    })),
    ranks: { max: MAX_RANK, thresholds: RANK_THRESHOLDS, titles: RANK_TITLES },
  });
}
