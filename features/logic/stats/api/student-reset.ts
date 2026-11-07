import { resetSubject } from '../service';
import { handle, readJson, requireTeacher } from './http';

/** POST /api/stats/students/:userId/reset  { subject? } — wipe one subject's progress. Teachers only. */
export async function POST(req: Request, ctx: RouteContext<'/api/stats/students/[userId]/reset'>) {
  return handle(async () => {
    const { userId } = await ctx.params;
    await requireTeacher();
    const body = await readJson<{ subject: string }>(req, { optional: true });
    return resetSubject(userId, body.subject);
  });
}
