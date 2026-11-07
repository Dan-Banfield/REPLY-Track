// Next.js entry point (Next only looks for the proxy here). The logic lives in
// features/logic/auth/proxy.ts; see features/logic/logic.md, "Route protection".
export { proxy } from '@features/logic/auth/proxy';

// Must stay in this file: Next reads the matcher without running the code.
export const config = {
  matcher: [
    // Everything except Next.js internals and static files.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
