<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project docs and structure

Before changing anything, read `features/logic/logic.md` (auth, routing, roles, Supabase, key files) and `features/ux/ux.md` (Material 3 theme, components, layout, navigation). Keep both up to date with every change.

Code is organised in feature folders: each doc in `features/` sits in its own folder (`features/logic/`, `features/ux/`, `features/chatbot/`, `features/teacher/`, `features/leaderboard/`) together with the code it describes. `src/app/` and `src/proxy.ts` contain only one-line re-exports, because Next.js requires those files to be there. Import feature code with the `@features/*` alias. See "Folder structure" in `features/logic/logic.md`.
