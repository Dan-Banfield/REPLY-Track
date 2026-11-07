import { handle, readJson } from "@/lib/http";
import { getAllHexagons, getUser, upsertUser } from "@/lib/stats";

type Ctx = { params: Promise<{ userId: string }> };

/** GET /api/users/:userId — full profile (incl. activity) + every subject's hexagon. 404 if unknown. */
export async function GET(_req: Request, { params }: Ctx) {
  const { userId } = await params;
  return handle(async () => {
    const profile = await getUser(userId);
    const { subjects: _raw, ...rest } = profile;
    return { ...rest, hexagons: await getAllHexagons(userId) };
  });
}

/** PUT /api/users/:userId  { displayName? } — create or rename. Idempotent. */
export async function PUT(req: Request, { params }: Ctx) {
  const { userId } = await params;
  return handle(async () => {
    const body = await readJson<{ displayName?: string }>(req).catch(() => ({}) as { displayName?: string });
    const profile = await upsertUser(userId, body.displayName);
    return { userId: profile.userId, displayName: profile.displayName, createdAt: profile.createdAt };
  });
}
