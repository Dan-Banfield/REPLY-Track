import type { NextRequest } from 'next/server';

import { getLeaderboard } from '../service';
import { handle, requireUser } from './http';

/** GET /api/stats/leaderboard?subject=maths&stat=discrete&limit=10 — students only, any logged-in user may view. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser();
    const q = req.nextUrl.searchParams;
    return {
      entries: await getLeaderboard({
        subject: q.get('subject') ?? undefined,
        stat: q.get('stat') ?? undefined,
        limit: q.get('limit') ? Number(q.get('limit')) : undefined,
      }),
    };
  });
}
