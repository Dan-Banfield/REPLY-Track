import { handle } from "@/lib/http";
import { listSubjects, RANK_THRESHOLDS, RANK_TITLES, MAX_RANK } from "@/lib/stats";

/** GET /api/subjects — subject + stat definitions and the rank ladder (for building UIs). */
export async function GET() {
  return handle(async () => ({
    subjects: listSubjects().map((s) => ({
      id: s.id,
      label: s.label,
      stats: s.stats.map(({ id, label, description, color }) => ({ id, label, description, color })),
    })),
    ranks: { max: MAX_RANK, thresholds: RANK_THRESHOLDS, titles: RANK_TITLES },
  }));
}
