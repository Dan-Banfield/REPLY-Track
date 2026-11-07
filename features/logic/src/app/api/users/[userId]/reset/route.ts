import { handle, readJson } from "@/lib/http";
import { resetSubject } from "@/lib/stats";

type Ctx = { params: Promise<{ userId: string }> };

/** POST /api/users/:userId/reset  { subject?: "maths" } — wipe progress in one subject. */
export async function POST(req: Request, { params }: Ctx) {
  const { userId } = await params;
  return handle(async () => {
    const body = await readJson<{ subject?: string }>(req).catch(() => ({}) as { subject?: string });
    return resetSubject(userId, body.subject);
  });
}
