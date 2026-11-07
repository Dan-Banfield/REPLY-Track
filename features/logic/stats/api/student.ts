import { getUser, hexagonsFor } from '../service';
import { handle, requireTeacherOrSelf } from './http';

/** GET /api/stats/students/:userId — a student's full stats incl. Markdown. Teachers, or the student themself. 404 if none. */
export async function GET(_req: Request, ctx: RouteContext<'/api/stats/students/[userId]'>) {
  return handle(async () => {
    const { userId } = await ctx.params;
    await requireTeacherOrSelf(userId);
    const profile = await getUser(userId);
    return { ...profile, hexagons: hexagonsFor(profile) };
  });
}
