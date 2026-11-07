import type { NextRequest } from "next/server";
import { handle } from "@/lib/http";
import { getHexagon } from "@/lib/stats";

type Ctx = { params: Promise<{ userId: string }> };

/** GET /api/users/:userId/hexagon?subject=maths — radar-chart data. Unknown users get zeros. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { userId } = await params;
  const subject = req.nextUrl.searchParams.get("subject") ?? undefined;
  return handle(() => getHexagon(userId, subject));
}
