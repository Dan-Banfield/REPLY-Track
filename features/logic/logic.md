# App logic

How the app works under the hood: project setup, auth flow, route protection, roles, Supabase setup, data flow and key files. Read it together with [`ux.md`](../ux/ux.md), which covers the UI and design. The hexagon stats backend (XP, ranks, the `student_stats` table and the `/api/stats` routes) has its own doc: [`backend.md`](backend.md).

_Last updated: after step 8. Hexagon stats stored in Supabase (`student_stats`), served by `/api/stats/*`._

---

## Current state

**Built and working**

- Next.js **16.4.5** (App Router, Turbopack), React **19.3**, TypeScript (strict), ESLint (`eslint-config-next`), npm.
- Material Web (`@material/web` 2.5) is installed and themed (details in `ux.md`).
- Environment files: `.env` (git-ignored, real keys) and `.env.example` (committed template).
- **Supabase clients** for the server (`features/logic/supabase/server.ts`) and the browser (`features/logic/supabase/client.ts`), using `@supabase/ssr` 0.12 and `@supabase/supabase-js` 2.119.
- **Login page** (`/login`): email + password via a Server Action, then redirects to `/dashboard`. It links to `/signup` and shows a notice after a sign-up.
- **Sign-up page** (`/signup`): email, password and a **teacher / student** choice. The role is stored in the user's metadata, then the user is redirected to `/login` with a notice.
- **Route protection** (`features/logic/auth/proxy.ts`, wired up by `src/proxy.ts`):
  - logged-out users can only open `/login` and `/signup`; everything else redirects to `/login` (`/api/*` gets a JSON 401 instead)
  - logged-in users opening `/`, `/login` or `/signup` are redirected to `/dashboard`
  - the proxy also refreshes expired sessions
- **Server-side verification**: `getCurrentUser()` (`features/logic/auth/session.ts`) re-checks the session on the server and returns `{ id, email, role }`. It redirects to `/login` if the session is missing.
- **Roles** (step 4), set up by the SQL in `features/logic/migrations/20261107000000_create_profiles.sql`:
  - a `public.profiles` table (one row per user) with a `role` column of enum type `public.user_role` (`teacher` | `student`)
  - a trigger that fills it from the sign-up choice, plus a backfill for existing users
  - RLS: users can read only their own profile and can never change it
  
  The app reads the role from `profiles` in `getCurrentUser()`.
- **Hexagon stats** (step 8, documented in [`backend.md`](backend.md)), set up by `features/logic/migrations/20261107180000_create_student_stats.sql`:
  - a `public.student_stats` table, one row per user: the stats as jsonb (source of truth) plus a rendered Markdown copy
  - RLS: users read their own row; teachers (`public.is_teacher()`) read all rows; only the server writes, with the `service_role` key (`features/logic/supabase/admin.ts`), so students can't edit their XP
  - code in `features/logic/stats/`; Route Handlers under `/api/stats/*`, with one-line entries in `src/app/api/stats/`
- **Logout**: a Server Action ends the session, then a full page load goes to `/login`. It's triggered from the navigation rail, or from the error page.
- **Dashboard layout** (`features/ux/dashboard/DashboardLayout.tsx`): every page under `/dashboard` gets an M3 navigation rail. Its items come from one config array (`features/ux/navigation/navigation.ts`), filtered by the user's role on the server (details in `ux.md`).
- **Overview** (`/dashboard`): shows `TeacherOverview` or `StudentOverview` depending on the user's role. Both are placeholder cards for now (see ux.md). There is no page at `/`; the proxy always redirects it.
- **Error page** (`features/ux/root/ErrorPage.tsx`): any page that fails to load (e.g. a missing profile) shows "Something went wrong" with **Try again** and **Log out**, so users are never stuck.
- **`README.md`**: setup for new developers. It covers install, `.env`, creating the Supabase project, running the SQL, auth settings, running locally, scripts, structure, common tasks and troubleshooting.
- `npm run build`, `npm run lint` and `npx tsc --noEmit` all pass.
- The SQL was tested in PGlite (Postgres 17 in WebAssembly) with a stand-in for Supabase's `auth` schema and API roles. Coverage: re-running the script, backfill, the trigger with valid/invalid/missing roles, RLS (own-row read; update/insert/delete denied; `anon` denied) and cascade delete. It has since been run in the project owner's Supabase project (see below).
- Tested in Chrome against a local mock of Supabase Auth, in both `next start` and `next dev`. The dev console is clean apart from Lit's expected dev-mode notice. Coverage:
  - logged-out and logged-in redirects for every route
  - login, logout (cookies cleared, fresh login form, dashboard locked again)
  - expired-token refresh in both proxy branches
  - all sign-up and login form paths
  - the role shown for a teacher and a student
  - the error page for a user without a profile
  - the navigation rail: items per role, active state, icons, keyboard focus, Log out
  - adding a teacher-only page via the config (in a throwaway copy)
  - the Overview content for each role, on desktop and phone widths
  
  **With a real Supabase project** (the project owner's, November 2026), sign-in worked. Before the SQL migration had been run, the dashboard failed with "Could not find the table 'public.profiles'", as expected. After it was run, the dev log showed no further errors. Not every flow above has been repeated against the real project.
- The `student_stats` SQL was tested in PGlite the same way. Coverage: re-running the script, `service_role` insert/update, a student reads only their own row, a teacher reads every row, student insert/update/delete denied, `anon` denied (table and `is_teacher()`), cascade delete, and the foreign key rejecting unknown users.

**Not built yet**

- Real content: the Overview cards are placeholders. The stats API exists (`backend.md`), but no screen uses it yet.
- The chatbot (it should call `recordQuestion()` server-side; see `backend.md` §5).
- No password-reset page (out of scope).

---

## How it works

### Folder structure

The code is organised by **feature folder**. Each doc in `features/` has its own folder, holding the doc **and the code it describes**:

- **`features/logic/`**: behaviour and data. Supabase clients, auth (Server Actions, session, roles, routes, proxy), the SQL, and the hexagon stats backend. Documented here and in [`backend.md`](backend.md) (stats).
- **`features/ux/`**: everything the user sees. Theme, Material Web setup, form components, navigation, and the screens (root layout, error page, auth pages, dashboard, Overview). Documented in [`ux.md`](../ux/ux.md).
- **`features/leaderboard/`**: a planned feature; only its (empty) doc so far.

`src/` only contains what Next.js requires to be there: the route files in `src/app/` and `src/proxy.ts`. Each is a **one-line re-export** from a feature folder, so the URL structure stays visible at a glance.

```
.
├── README.md                     # Setup instructions for new developers
├── AGENTS.md                     # Agent instructions (top block is managed by `next dev`)
├── features/
│   ├── logic/
│   │   ├── logic.md              # This document
│   │   ├── backend.md            # Hexagon stats: game rules, /api/stats, student_stats table
│   │   ├── auth/
│   │   │   ├── actions.ts        # Server Actions: login, signup, logout
│   │   │   ├── proxy.ts          # proxy(): session refresh + redirects (re-exported by src/proxy.ts)
│   │   │   ├── roles.ts          # ROLES, Role type, labels, isRole() (mirrors the DB enum)
│   │   │   ├── routes.ts         # LOGIN_PATH, HOME_PATH, PUBLIC_PATHS
│   │   │   └── session.ts        # getCurrentUser(): verified user + role for server code
│   │   ├── supabase/
│   │   │   ├── server.ts         # createClient() for Server Components / Actions / Route Handlers
│   │   │   ├── client.ts         # createClient() for Client Components (not used yet)
│   │   │   └── admin.ts          # createAdminClient(): service_role key, bypasses RLS, server-only
│   │   ├── stats/                # Hexagon stats backend (see backend.md)
│   │   │   ├── index.ts          # Public API: recordQuestion, awardXp, getHexagon, getLeaderboard, …
│   │   │   ├── types.ts          # Shared types (the only stats file Client Components may import)
│   │   │   ├── config.ts, subjects.ts, classifier.ts, engine.ts, markdown.ts
│   │   │   ├── store.ts          # student_stats reads/writes (optimistic concurrency)
│   │   │   ├── service.ts        # High-level operations
│   │   │   └── api/              # Route Handler implementations + http.ts (auth/error helpers)
│   │   └── migrations/           # SQL to run in the Supabase SQL Editor, in filename order
│   │       ├── 20261107000000_create_profiles.sql        # profiles table, role enum, RLS, sign-up trigger, backfill
│   │       └── 20261107180000_create_student_stats.sql   # student_stats table, is_teacher(), RLS
│   ├── ux/
│   │   ├── ux.md
│   │   ├── theme/                # theme.css (M3 tokens, light + dark), globals.css
│   │   ├── material/             # Material Web registration, JSX types, MaterialForm, icon font URL
│   │   ├── navigation/           # navigation.ts (NAV_ITEMS), NavigationRail.tsx
│   │   ├── root/                 # RootLayout.tsx (fonts, theme, Material Web), ErrorPage.tsx
│   │   ├── auth/                 # AuthLayout, AuthHeader, LoginPage/Form, SignupPage/Form, LogoutButton
│   │   └── dashboard/            # DashboardLayout, OverviewPage, overview/ (Teacher/Student Overview, cards)
│   └── leaderboard/
│       └── leaderboard.md
├── src/                          # Next.js entry points only (one-line re-exports)
│   ├── proxy.ts                  # export { proxy } from features/logic/auth/proxy + the matcher config
│   └── app/
│       ├── layout.tsx            # → features/ux/root/RootLayout
│       ├── error.tsx             # → features/ux/root/ErrorPage ('use client')
│       ├── favicon.ico
│       ├── (auth)/               # Route group (not in the URL)
│       │   ├── layout.tsx        # → features/ux/auth/AuthLayout
│       │   ├── login/page.tsx    # /login  → features/ux/auth/LoginPage
│       │   └── signup/page.tsx   # /signup → features/ux/auth/SignupPage
│       ├── dashboard/
│       │   ├── layout.tsx        # /dashboard/* → features/ux/dashboard/DashboardLayout
│       │   └── page.tsx          # /dashboard   → features/ux/dashboard/OverviewPage
│       └── api/stats/**/route.ts # /api/stats/* → features/logic/stats/api/* (see backend.md §4)
├── .env.example                  # Committed env template
├── .env                          # Your real keys (git-ignored)
└── next.config.ts
```

Conventions:

- **Import alias `@features/*` → `features/*`.** Import from another folder with the alias (`@features/logic/auth/session`); use relative imports (`./auth.module.css`) only within the same folder. `@/*` → `src/*` still exists but nothing should import from `src/`.
- **Route entry files stay one line**, e.g. `export { default, metadata } from '@features/ux/auth/LoginPage';` or, for a Route Handler, `export { GET } from '@features/logic/stats/api/me';`. Re-export every Next-specific export the page has (`metadata`, `generateMetadata`, …). Two exceptions must live in `src/` itself:
  - `src/proxy.ts` keeps `export const config` (the matcher). Next reads it without running the code.
  - `src/app/error.tsx` starts with `'use client'`, because error boundaries must be Client Components.
- **Which folder?** Behaviour, data access, auth and SQL go in `features/logic/`; anything rendered or styled goes in `features/ux/`. A screen (in `ux`) calls into `logic` (actions, `getCurrentUser()`), never the other way round. `features/logic/` must not import from `features/ux/`.
- **A new feature** (e.g. the leaderboard) gets its own folder `features/<name>/` with its `<name>.md` and its code (it may import from `logic/` and `ux/`), plus one-line route entries in `src/app/` for its pages.
- Route paths used in code come from `features/logic/auth/routes.ts`, not string literals.
- Database changes go in a **new** file in `features/logic/migrations/` named `<YYYYMMDDHHMMSS>_<what>.sql`. Never edit a file that has already been run in a real project. Write migrations so they can be re-run safely (`if not exists`, `drop … if exists`, `on conflict do nothing`).
- New dashboard pages: implementation in a feature folder, a one-line entry `src/app/dashboard/<name>/page.tsx`, and one entry in `features/ux/navigation/navigation.ts` (see ux.md, "Navigation config").

### Key files

| File | What it does |
| --- | --- |
| `next.config.ts` | Turns on `cacheComponents` and `partialPrefetching` (see below). |
| `features/logic/auth/proxy.ts` | `proxy()`: runs before every page request and Server Action. Validates and refreshes the Supabase session, then redirects according to the [rules below](#route-protection). |
| `src/proxy.ts` | Next.js entry: re-exports `proxy` and holds the `config.matcher` (must stay in this file). |
| `features/ux/root/RootLayout.tsx` | Root layout. Loads Roboto with `next/font`, imports the theme CSS and M3 type scale, renders `<MaterialWeb />` so the M3 elements are defined in the browser. Sets the title template `%s · REPLY Track`. |
| `features/logic/supabase/server.ts` | `createClient()` for server code. Reads and writes the session cookies via `next/headers`, and calls `io()` (see [Rendering model](#rendering-model-cache-components-are-on)). Create one per request. |
| `features/logic/supabase/client.ts` | `createClient()` for browser code. Same cookie session. Not used yet. |
| `features/logic/auth/session.ts` | `getCurrentUser()`: the verified `{ id, email, role }` of the logged-in user, or a redirect to `/login`. Reads the role from `profiles`. Cached per request. Throws if the profile is missing. |
| `features/logic/migrations/20261107000000_create_profiles.sql` | Creates the `user_role` enum, the `profiles` table, RLS policy and grants, the `on_auth_user_created` trigger, and backfills existing users. See [Roles](#roles). |
| `features/ux/root/ErrorPage.tsx` | Error boundary for every route below the root layout. Shows **Try again** and **Log out**. |
| `features/logic/auth/actions.ts` | Server Actions `login`, `signup` (both via `useActionState`) and `logout`. |
| `features/logic/auth/routes.ts` | `LOGIN_PATH` (`/login`), `HOME_PATH` (`/dashboard`), `PUBLIC_PATHS` (`/login`, `/signup`). |
| `features/logic/auth/roles.ts` | The role list (`teacher`, `student`), `Role` type, display labels and `isRole()` guard. Use it everywhere roles appear. |
| `features/ux/auth/LogoutButton.tsx` | `useLogout()` (calls `logout()`, then `window.location.assign('/login')`) and the standalone outlined `LogoutButton` (used on the error page). |
| `features/ux/navigation/navigation.ts` | `NAV_ITEMS` (label, href, icon, roles) and `navItemsFor(role)`. Adding a page = one entry. |
| `features/ux/dashboard/DashboardLayout.tsx` | Dashboard shell. Inside `<Suspense>`, `RoleNavigation` calls `getCurrentUser()` and renders `<NavigationRail items={navItemsFor(role)} />`. |
| `features/ux/navigation/NavigationRail.tsx` | Client component: M3 rail from the given items, active item from `usePathname()`, Log out at the bottom. |
| `features/ux/material/material-symbols.ts` | Builds the Google Fonts URL for the icon font from the icons in `NAV_ITEMS` + `OTHER_ICONS`. |
| `features/ux/dashboard/OverviewPage.tsx` | Overview page. Inside `<Suspense>`, `RoleOverview` calls `getCurrentUser()` and renders `OVERVIEW_BY_ROLE[role]`, a `Record<Role, Component>`, so TypeScript forces an Overview for every role. |
| `features/ux/dashboard/overview/TeacherOverview.tsx`, `StudentOverview.tsx` | The per-role Overview content (placeholder cards). Server Components that receive the `CurrentUser`. |
| `features/ux/auth/LoginPage.tsx` | Login page. Reads `?signup=confirm|done` (behind `<Suspense>`) to show the post-sign-up notice. |
| `features/ux/auth/SignupForm.tsx` | Sign-up form with the role radio group. |
| `features/ux/material/MaterialWeb.tsx` | The one place where Material Web components are imported/registered (plus the hydration rule; see ux.md). |
| `features/ux/material/MaterialForm.tsx` | `MaterialForm`, `SubmitButton`, `FormError`: the form building blocks every form uses (see ux.md). |
| `features/ux/theme/theme.css` | All `--md-sys-color-*` tokens for light and dark mode, plus typeface tokens. |
| `features/logic/supabase/admin.ts` | `createAdminClient()`: Supabase client with the `service_role` key. Bypasses RLS; `server-only`. Used for stats writes and the leaderboard. |
| `features/logic/migrations/20261107180000_create_student_stats.sql` | `student_stats` table, `is_teacher()` helper, RLS (own row / teachers read all / only `service_role` writes). See `backend.md` §7. |
| `features/logic/stats/index.ts` | Public API of the stats backend. See [`backend.md`](backend.md). |
| `features/logic/stats/api/http.ts` | `handle()` (StatsError → JSON, re-throws Next redirects), `readJson()`, `requireUser()`, `requireTeacher()`, `requireTeacherOrSelf()`. |
| `.env.example` / `.env` | Supabase URL, anon key, service_role key, OpenAI key (template / real values). |

### Rendering model: Cache Components are on

`next.config.ts` keeps the Next 16.4 scaffold defaults:

```ts
cacheComponents: true,
partialPrefetching: true,
```

**Why:** the bundled Next docs say both will be enabled everywhere in the next major version and the options will be removed. Building on them now avoids a migration later.

**What it means for auth, roles and the dashboard:**

- Data is dynamic by default; nothing is cached unless marked with `'use cache'`.
- Reading request data (`cookies()`, `headers()`, `searchParams`, and therefore the Supabase session) **outside a `<Suspense>` boundary is a build error**. Anything that depends on the logged-in user or the query string must render inside `<Suspense>`. Examples: `SignedInAs` in `features/ux/dashboard/OverviewPage.tsx`, `SignupNotice` in the login page.
- Don't `await` the session at the top level of a layout. Push the read down into a component inside a boundary, as `RoleNavigation` in `features/ux/dashboard/DashboardLayout.tsx` does.
- **`createClient()` calls `await io()`** after reading cookies. Partial Prefetching can prerender pages *with* the user's cookies (a per-session shell). Supabase then compares token expiry with `Date.now()`, which Next rejects during prerendering ("encountered the unstable value `Date.now()`"). `io()` tells Next that time-dependent work follows: it resolves immediately during real requests and Server Actions, and keeps the session read out of prerendered shells. Don't remove it.
- Server Actions can read and write cookies freely; the Suspense rule only applies to rendering.
- `/signup` is fully static. `/login` and `/dashboard` are static shells with a small streamed part. Keep auth pages free of session reads; the proxy handles "already logged in".
- In development, Next also checks each page for things that would block instant navigation. These appear in the dev overlay and console. Keeping session reads inside `<Suspense>` (plus `io()`) satisfies them.
- Reference: `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`.

### Supabase clients

Both come from `@supabase/ssr`, which stores the session (access + refresh token) in **cookies** named `sb-<project-ref>-auth-token` (split into `.0`, `.1`, … if large). Because the session is in cookies, server code and browser code see the same session.

| Use in | Import | Notes |
| --- | --- | --- |
| Server Components, Server Actions, Route Handlers | `import { createClient } from '@features/logic/supabase/server'` then `await createClient()` | Async, because it reads `cookies()`. Writing cookies only works in Actions and Route Handlers; in Server Components the write is silently skipped (try/catch in `setAll`). |
| Client Components | `import { createClient } from '@features/logic/supabase/client'` | For browser-only features (e.g. realtime). Prefer server code for auth and data. |
| `features/logic/auth/proxy.ts` | its own `createServerClient` with request/response cookies | Proxy can't use `next/headers`; it reads `request.cookies` and writes response cookies. |

**Reading the current user on the server:** call `getCurrentUser()` from `features/logic/auth/session.ts`. It uses `supabase.auth.getClaims()`, which validates the JWT either locally (asymmetric signing keys) or by calling Supabase Auth (legacy symmetric keys). **Don't trust `getSession()` on the server**: it only decodes the cookie without validating it.

### Route protection

Two layers, following Next's guidance that the proxy alone is not enough:

**1. The proxy: `features/logic/auth/proxy.ts`, wired up by `src/proxy.ts` (optimistic, runs first)**

| Request | Logged out | Logged in |
| --- | --- | --- |
| `/login`, `/signup` (`PUBLIC_PATHS`) | page renders | 307 → `/dashboard` |
| `/` | 307 → `/login` | 307 → `/dashboard` |
| `/api/*` (`API_PREFIX`) | 401 `{ "error": "Not signed in" }` | handler runs |
| anything else (incl. unknown paths, Server Action POSTs) | 307 → `/login` | page renders (or 404) |

- The redirect drops any query string, e.g. `/login?signup=done` while logged in → `/dashboard`.
- **Session refresh:** `supabase.auth.getClaims()` refreshes an expired access token using the refresh token. The new cookies are written to the request (so the page rendering this request sees them) and to the response, **including redirect responses**. Supabase refresh tokens are single-use, so a response that drops the new cookies would sign the user out on their next request.
- The `Cache-Control: private, no-store` headers that `@supabase/ssr` asks for when it writes auth cookies are copied onto the response, so a CDN never caches one user's session.
- `config.matcher` (in `src/proxy.ts`) skips `_next/static`, `_next/image`, `favicon.ico` and image files. Everything else, including Server Action POSTs, goes through the proxy.

**2. `getCurrentUser()` (authoritative, in server code)**

- Every protected Server Component calls it (inside `<Suspense>`); Server Actions and Route Handlers that touch user data must call it too (the `/api/stats` handlers do, via `requireUser()` & co. in `features/logic/stats/api/http.ts`).
- In a Route Handler wrapped in `try/catch`, call `unstable_rethrow(err)` first in the `catch`, so its `redirect()` isn't turned into a 500 (`handle()` does this).
- It redirects to `/login` if the session is invalid, so a page is safe even if the proxy matcher changes.
- Wrapped in React `cache()`, so several components calling it in one request cost one check.

**Adding pages:** new pages are protected automatically. To add another public page (e.g. a password-reset page), add its path to `PUBLIC_PATHS` in `features/logic/auth/routes.ts`.

### Roles

**Data model** (`features/logic/migrations/20261107000000_create_profiles.sql`):

```
auth.users (managed by Supabase Auth)
   │ 1:1, on delete cascade
   ▼
public.profiles
   id          uuid  PK, references auth.users(id)
   role        public.user_role  NOT NULL   -- enum: 'teacher' | 'student'
   created_at  timestamptz       NOT NULL default now()
```

**How a role gets there:**

1. `/signup` sends the chosen role as user metadata: `signUp({ …, options: { data: { role } } })` → `auth.users.raw_user_meta_data.role`.
2. The `on_auth_user_created` trigger (function `public.handle_new_user`, `security definer`) inserts the `profiles` row. If the metadata role is not a valid `user_role` (missing, or something like `"admin"`), it uses **`student`**, the least-privileged role. This also covers users added in the Supabase dashboard without metadata.
3. When the script first runs, a backfill creates profiles for users who already exist, using the same rule.

**Who can do what (RLS + grants):**

| Who | profiles access |
| --- | --- |
| Logged-in user (`authenticated`) | `select` their **own** row only (`auth.uid() = id`). No insert/update/delete: they can't change their role. |
| Logged-out (`anon`) | nothing |
| Admin (Table Editor, SQL Editor, `service_role` key) | everything (bypasses RLS) |

**Reading the role in the app:** `getCurrentUser()` in `features/logic/auth/session.ts`:

```
getClaims()  → verified user id + email
   └─ select role from profiles where id = <user id>   (runs as the user, so RLS applies)
        ├─ query error            → throw (shown by features/ux/root/ErrorPage.tsx)
        ├─ no row / unknown value → throw "No valid profile found … run features/logic/migrations/*.sql"
        └─ ok                     → { id, email, role }
```

- Use `const { role } = await getCurrentUser()` in Server Components (inside `<Suspense>`), Server Actions and Route Handlers. Use `ROLE_LABELS[role]` for display.
- **Never** read the role from `user_metadata` or from the JWT's `user_metadata` claim; users can edit those.
- The browser never receives the role directly. The dashboard layout filters `NAV_ITEMS` on the server and sends only the allowed items to the rail. `getCurrentUser()` is called by both the layout (for the rail) and the page; React `cache()` makes that one lookup per request.

### Role-restricted pages

`NAV_ITEMS[].roles` only decides **who sees the link**. It doesn't protect the page: any logged-in user can type the URL. A page meant for some roles must check the role itself, on the server, where it reads its data:

```tsx
// features/<feature>/ClassesPage.tsx (teacher-only example)
// with the route entry src/app/dashboard/classes/page.tsx:
//   export { default } from '@features/<feature>/ClassesPage';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUser } from '@features/logic/auth/session';

export default function ClassesPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <TeacherOnlyContent />
    </Suspense>
  );
}

async function TeacherOnlyContent() {
  const { role } = await getCurrentUser();
  if (role !== 'teacher') notFound(); // or redirect('/dashboard')
  return <h1>Classes</h1>;
}
```

- Server Actions that change role-specific data must check the role the same way, and the database should enforce it with RLS (e.g. a policy that looks up `profiles.role` for `auth.uid()`).
- No page needs this yet: Overview is for both roles.

**Common admin tasks:**

- *Change a user's role:* Supabase → Table Editor → `profiles` → edit `role`, or run `update public.profiles set role = 'teacher' where id = '<user uuid>';` The user sees the new role on their next page load.
- *Add a role (e.g. `admin`):* write a new migration with `alter type public.user_role add value 'admin';`. Then:
  - add it to `ROLES` and `ROLE_LABELS` in `features/logic/auth/roles.ts`
  - add it to the `roles` of the relevant entries in `features/ux/navigation/navigation.ts`
  - give it an Overview in `OVERVIEW_BY_ROLE` (TypeScript will report it as missing) The sign-up form lists every entry in `ROLES`, so remove any role users shouldn't pick there.

### Auth flow: login

```
/login (static page)
  └─ LoginForm (client, uses <MaterialForm>)
       │ user submits (button click or Enter) → form.requestSubmit() → browser validation
       ▼
     startTransition(() => formAction(formData))
       ▼
  login() Server Action (features/logic/auth/actions.ts)
       ├─ empty fields?        → { error: 'Enter your email and password.' }
       ├─ signInWithPassword() → Supabase Auth
       │     ├─ invalid_credentials → 'Incorrect email or password.'
       │     ├─ email_not_confirmed → 'Confirm your email address before signing in.'
       │     └─ anything else       → console.error(details) + 'Sign-in failed. Please try again.'
       └─ success → session cookies written by the server client → redirect(HOME_PATH = '/dashboard')
```

- Errors come back as `FormState` (`{ error: string | null }`) and are shown by `<FormError>`.
- `redirect()` throws by design. Keep it outside any `try/catch`.

### Auth flow: sign-up

```
/signup (static page)
  └─ SignupForm: email, password (min 6), role radio (teacher | student, required)
       ▼
  signup() Server Action
       ├─ empty fields / role not in ROLES → error
       ├─ supabase.auth.signUp({ email, password, options: { data: { role } } })
       │     ├─ user_already_exists / email_exists → 'An account with this email already exists.'
       │     ├─ weak_password                     → Supabase's own message (which rule failed)
       │     ├─ email_address_invalid             → 'Enter a valid email address.'
       │     ├─ over_email_send_rate_limit        → 'Too many sign-up emails were sent recently…'
       │     ├─ signup_disabled                   → 'Sign-ups are currently turned off.'
       │     └─ anything else                     → console.error + 'Sign-up failed. Please try again.'
       ├─ "Confirm email" ON  (no session returned) → redirect('/login?signup=confirm')
       └─ "Confirm email" OFF (session returned)    → signOut({ scope: 'local' }) → redirect('/login?signup=done')
```

- **Where the role goes:** into the new user's `raw_user_meta_data` as `{ "role": "teacher" | "student" }`. The `on_auth_user_created` trigger then copies it into `public.profiles.role` (see [Roles](#roles)).
- **Why sign out after an auto-confirmed sign-up:** the requirement is that new users land on the login page. If they stayed signed in, the proxy would bounce them from `/login` to `/dashboard`.
- The `signup` query value only selects one of two fixed messages in the login page (`SIGNUP_NOTICES`), so arbitrary text can't be injected through the URL.

### Auth flow: logout

```
LogoutButton (client) ── click ──▶ logout() Server Action
                                     └─ supabase.auth.signOut({ scope: 'local' })
                                          → revokes this device's session, clears the auth cookies
                       ◀── returns ──
window.location.assign('/login')  → full page load → proxy sees no session → /login renders
```

- **`scope: 'local'`** signs out only this browser; the user stays signed in on other devices.
- **Why a full page load and not `redirect()`:** with Cache Components, Next keeps recently visited pages mounted in the background (React `<Activity>`). A client-side redirect would leave the previous user's dashboard (and the login form they typed into) in the tab's memory. A full load starts clean.
- If revocation fails (e.g. Supabase unreachable), the cookies are still cleared and the error is logged on the server.

### Supabase project setup

Needed to run the app with a real project. The root `README.md` has the same steps written for new developers, plus a troubleshooting table. **If you change the setup (env vars, SQL, Supabase settings), update both.**

1. Create a project at https://supabase.com/dashboard (free tier is fine).
2. **Project Settings → API / API Keys**: copy the Project URL into `NEXT_PUBLIC_SUPABASE_URL`, the anon (or publishable) key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the **secret** (`sb_secret_…`, or legacy `service_role`) key into `SUPABASE_SERVICE_ROLE_KEY` in `.env`. Restart `npm run dev`.
3. **SQL Editor → New query**: paste the contents of each file in `features/logic/migrations/` and click **Run**, one file at a time in filename order (`20261107000000_create_profiles.sql`, then `20261107180000_create_student_stats.sql`). "Success. No rows returned" is expected. Check under Table Editor that `profiles` and `student_stats` exist.
4. **Authentication → Sign In / Providers → Email** must be enabled (it is by default). On the same screen:
   - **Confirm email** (on by default): new users must click a link in an email before they can sign in. The built-in email service on the free tier only sends a few emails per hour. For local development it is easiest to turn this **off**; for production, keep it on and add custom SMTP.
   - **Minimum password length** (default 6): keep `minLength` in `SignupForm.tsx` in sync.
5. **Authentication → URL Configuration → Site URL**: the confirmation link sends users here (default `http://localhost:3000`). Set it to the real app URL when deploying. Arriving at `/` logged out simply redirects to `/login`.
6. Visit `/signup`, create an account, sign in on `/login` and you land on `/dashboard`, which shows your role. Users can also be created in **Authentication → Users → Add user** (tick **Auto Confirm User**). They get the `student` role; change it in Table Editor → `profiles`.

### Environment variables

| Variable | Used for | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key: the legacy anon key or the newer publishable key (`sb_publishable_…`). Safe in the browser because Row Level Security protects the data. | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret, server-only.** Bypasses RLS. Used by `createAdminClient()` for stats writes and the leaderboard. Without it, every `/api/stats` call that writes fails. | Project Settings → API Keys → secret key (`sb_secret_…`) or legacy `service_role` |
| `OPENAI_API_KEY` | **Secret, server-only.** For the chatbot (not used by any code yet). | OpenAI dashboard → API keys |

- Paste the real values into `.env` (copy it from `.env.example`). The project uses **`.env`** (not `.env.local`) by convention.
- `.gitignore` ignores `.env*` but allows `.env.example`.
- Never add the `service_role` / secret key (or any other secret) to a `NEXT_PUBLIC_` variable: those are inlined into browser code.
- Next.js loads `.env` in every environment (dev, build, start). If someone also creates a `.env.local`, it overrides `.env`, so keep only one.
- If the variables are missing entirely, creating a Supabase client throws "Your project's URL and Key are required…". Since the proxy creates one on every request, **every page then fails**. If they are placeholders, pages load and sign-in/sign-up show "… failed. Please try again." The server log then shows `AuthRetryableFetchError: fetch failed`.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Production build (also type-checks) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

---

## Next steps

Planned build order. Each step is reviewed and committed separately.

- [x] **1. Project setup**: Next.js, Material 3 theme, env files
- [x] **2. Supabase**: browser and server clients, login page (email/password), sign-up page with role choice
- [x] **3. Route protection**: proxy with session refresh and redirects, server-side `getCurrentUser()`, logout
- [x] **4. Roles**: `profiles` table + `user_role` enum, sign-up trigger, backfill, RLS (read own, never change role), role in `getCurrentUser()`, error page
- [x] **5. Dashboard layout**: `features/ux/dashboard/DashboardLayout.tsx` with an M3 navigation rail built from `NAV_ITEMS` (filtered by role on the server), Log out in the rail
- [x] **6. Overview page**: different placeholder content for teachers and students (`OVERVIEW_BY_ROLE` in `features/ux/dashboard/OverviewPage.tsx`)
- [x] **7. README**: install, env vars, Supabase project + SQL + auth settings, run locally, scripts, structure, common tasks, troubleshooting
- [x] **8. Hexagon stats in Supabase**: `student_stats` table + RLS, `service_role` admin client, stats library in `features/logic/stats/`, `/api/stats/*` routes, `/api/*` 401 in the proxy (see `backend.md`)

Left unfinished on purpose:

- The Overview cards are placeholders with no data behind them. Real content will need its own tables and RLS policies (new migrations), read on the server in the Overview components.
- `features/logic/supabase/client.ts` exists but has no caller yet.
- Database types are not generated. Query results are validated at runtime (`isRole`). When more tables arrive, consider `npx supabase gen types typescript --project-id <ref> > features/logic/supabase/database.types.ts` and pass the `Database` type to the clients.
- Each protected page load makes two Supabase calls for the user (claims + profile). If that becomes a bottleneck, a Supabase *custom access token hook* can put the role into the JWT instead.
- No "return to the page you wanted after login" (`?next=`). The login always lands on `/dashboard`.

---

## Gotchas

- **This is Next.js 16, not the version most examples online use.** Check the bundled docs in `node_modules/next/dist/docs/` before writing Next-specific code (see `AGENTS.md`). In particular, `middleware.ts` is deprecated and renamed to **`proxy.ts`** (export `proxy` instead of `middleware`). It runs on the Node.js runtime.
- **Hiding a nav item is not access control.** See [Role-restricted pages](#role-restricted-pages).
- **Don't rely on the proxy alone.** Call `getCurrentUser()` in every protected page, Server Action and Route Handler. Next's docs warn that a matcher change or moving a Server Action can silently remove proxy coverage.
- **Keep refreshed cookies on every proxy response**, including redirects (see [Route protection](#route-protection)). Refresh tokens are single-use, so dropping them signs users out.
- **Proxy cost per request:** `getClaims()` verifies the token locally only when the Supabase project uses the newer asymmetric JWT signing keys. With legacy symmetric keys it calls Supabase Auth on **every** request (proxy + `getCurrentUser()`). If pages feel slow, switch the project to asymmetric keys (Project Settings → JWT Keys).
- **Don't remove `await io()` from `createClient()`** (see [Rendering model](#rendering-model-cache-components-are-on)).
- **Logout must stay a full page load** (see [Auth flow: logout](#auth-flow-logout)).
- **`createAdminClient()` bypasses RLS.** Only call it after checking who the caller is and what they may touch. Never import it (or `@features/logic/stats`) into a Client Component; the `server-only` import makes that a build error.
- **Stats writes go through the server only.** `student_stats` has no insert/update policy on purpose. Don't add one, or students could set their own XP via the public API.
- **Never read the role from user metadata for authorization.** Users can change their own `user_metadata` with `supabase.auth.updateUser()`. Metadata is only the hand-off from the sign-up form to the database trigger. The `profiles` table (protected by RLS) is the source of truth.
- **If you ever let users edit their own profile** (e.g. a display name), don't add a plain `update` policy: it would let them change `role` too. Grant only the safe columns (`grant update (display_name) on public.profiles to authenticated;`) together with an update policy on `auth.uid() = id`.
- **Missing profile = error page.** If the SQL hasn't been run, or a profile row is deleted, `getCurrentUser()` throws and the user sees the error page (with Log out). The server log names the user id and points to the SQL.
- **Role values live in two places:** the `public.user_role` enum and `ROLES` in `features/logic/auth/roles.ts`. Change both together, the database via a new migration.
- **Role changes apply on the next page load**, not instantly in open tabs.
- **Anyone can sign up as a teacher.** The role is self-selected, as specified. If that ever matters, add an approval step (e.g. a `pending` flag that an admin clears).
- **"Account already exists" is only reported when email confirmation is off.** With confirmation on, Supabase hides whether an email is registered (to prevent account enumeration). It returns a normal-looking result and sends no email, so the user sees the "check your email" notice.
- **The free tier's built-in email sender is heavily rate-limited.** Repeated sign-up tests quickly hit `over_email_send_rate_limit`. Turn off "Confirm email" while developing.
- **`LayoutProps` / `PageProps` are global types that Next generates.** On a fresh clone, `npx tsc --noEmit` fails with "Cannot find name 'LayoutProps'" until `npm run dev`, `npm run build` or `npx next typegen` has run once.
- **`NEXT_PUBLIC_*` values are inlined at build time.** Restart `npm run dev` (or rebuild) after editing `.env`.
- **Only one `next dev` per project folder.** Next 16 refuses to start a second dev server in the same directory. Don't delete `.next/` while a dev server is running.
- **Supabase key naming.** The variable is called `..._ANON_KEY` because that name was requested, but the newer publishable key works in it too (supabase-js treats both the same).
- **Auth cookies are not `httpOnly`.** This is `@supabase/ssr`'s design, so the browser client can read the session too. Protection relies on Row Level Security in the database, not on hiding the token.
- **`setAll` errors are swallowed in Server Components** (see `server.ts`). This is intentional: Server Components can't set cookies, and the proxy handles token refresh before the page renders.
- **Recently visited pages stay mounted.** With Cache Components, Next keeps the previous route in the DOM, hidden by React `<Activity>`. After login, the login form stays mounted invisibly until the next full page load (logout does one).
- **`'use server'` files may only export async functions** (plus types). Constants like `ROLES` live in `roles.ts`, and paths live in `routes.ts`, not in `actions.ts`.
- **`npm audit` reports a moderate advisory** in `minimatch`, pulled in by the ESLint/TypeScript tooling (dev-only, not shipped to the browser). `npm audit fix --force` would downgrade `eslint-config-next` to v15, so don't run it. Wait for an upstream fix instead.
- **`AGENTS.md`**: the block between the `nextjs-agent-rules` markers is rewritten by `next dev`. Put project notes outside that block.
