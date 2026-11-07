import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { HOME_PATH, LOGIN_PATH, PUBLIC_PATHS } from './routes';

/**
 * Next.js proxy (re-exported by src/proxy.ts, which also holds the matcher).
 * Runs before every page request and Server Action.
 *
 * 1. Validates the Supabase session and refreshes it when the access token
 *    has expired, writing the new cookies to the browser.
 * 2. Redirects:
 *    - logged out, on any page except PUBLIC_PATHS → /login
 *    - logged in, on a PUBLIC_PATHS page or "/"    → /dashboard
 *
 * This is an optimistic check for fast redirects. Pages and Server Actions
 * still verify the user themselves with getCurrentUser() (./session.ts).
 */
export async function proxy(request: NextRequest) {
  const refreshed: { cookies: Parameters<SetAllCookies>[0]; headers: Record<string, string> } = {
    cookies: [],
    headers: {},
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Let the page rendering this request see the refreshed session...
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // ...and remember the cookies (+ no-cache headers) for the browser.
          refreshed.cookies.push(...cookiesToSet);
          Object.assign(refreshed.headers, headers);
        },
      },
    },
  );

  // Keep this directly after creating the client: it is what refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  let response: NextResponse;
  if (!isLoggedIn && !isPublic) {
    response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  } else if (isLoggedIn && (isPublic || pathname === '/')) {
    response = NextResponse.redirect(new URL(HOME_PATH, request.url));
  } else {
    response = NextResponse.next({ request });
  }

  // Always pass refreshed cookies on, including on redirects, or the browser
  // keeps the old (already used) refresh token and gets signed out.
  refreshed.cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  Object.entries(refreshed.headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
