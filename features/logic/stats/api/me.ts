import { createClient } from '@features/logic/supabase/server';

import { hexagonsFor } from '../service';
import { readUser } from '../store';
import { handle, requireUser } from './http';

/**
 * GET /api/stats/me — the logged-in user's stats: every subject's hexagon,
 * recent activity and the stored Markdown. Users with no stats yet get zeros.
 * Read with the user's own Supabase client, so RLS applies.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const profile = await readUser(user.id, await createClient());
    return {
      userId: user.id,
      displayName: profile?.displayName ?? null,
      hexagons: hexagonsFor(profile),
      activity: profile?.activity ?? [],
    };
  });
}
