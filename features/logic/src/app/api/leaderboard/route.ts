import type { NextRequest } from "next/server";
import { handle } from "@/lib/http";
import { getLeaderboard } from "@/lib/stats";

/** GET /api/leaderboard?subject=maths&stat=discrete&limit=10 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  return handle(async () => ({
    entries: await getLeaderboard({
      subject: q.get("subject") ?? undefined,
      stat: q.get("stat") ?? undefined,
      limit: q.get("limit") ? Number(q.get("limit")) : undefined,
    }),
  }));
}
