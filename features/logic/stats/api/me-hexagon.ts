import type { NextRequest } from 'next/server';

import { createClient } from '@features/logic/supabase/server';

import { getHexagon } from '../service';
import { handle, requireUser } from './http';

/** GET /api/stats/me/hexagon?subject=maths — radar data for the logged-in user (zeros if none yet). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const subject = req.nextUrl.searchParams.get('subject') ?? undefined;
    return getHexagon(user.id, subject, await createClient());
  });
}
