import { handle, readJson } from "@/lib/http";
import { awardXp } from "@/lib/stats";

type Ctx = { params: Promise<{ userId: string }> };

/** POST /api/users/:userId/award  { xp: { discrete: 20 }, reason: "Quiz", subject?: "maths" } */
export async function POST(req: Request, { params }: Ctx) {
  const { userId } = await params;
  return handle(async () => {
    const body = await readJson<{ xp: Record<string, number>; reason: string; subject?: string }>(req);
    return awardXp({ userId, ...body });
  });
}
