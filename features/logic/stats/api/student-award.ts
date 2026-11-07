import { awardXp } from '../service';
import { handle, readJson, requireTeacher } from './http';

/** POST /api/stats/students/:userId/award  { xp: { discrete: 20 }, reason, subject? } — teachers only. */
export async function POST(req: Request, ctx: RouteContext<'/api/stats/students/[userId]/award'>) {
  return handle(async () => {
    const { userId } = await ctx.params;
    await requireTeacher();
    const body = await readJson<{ xp: Record<string, number>; reason: string; subject: string }>(req);
    return awardXp({ userId, xp: body.xp ?? {}, reason: body.reason as string, subject: body.subject });
  });
}
