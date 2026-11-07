# App logic

How the app works under the hood: project setup, auth flow, route protection, roles, Supabase setup, data flow and key files. Read it together with [`ux.md`](./ux.md), which covers the UI and design.

_Last updated: step 3 of 7 (route protection and logout)._

---

## Current state

**Built and working**

- Next.js **16.4.5** (App Router, Turbopack), React **19.3**, TypeScript (strict), ESLint (`eslint-config-next`), npm.
- Material Web (`@material/web` 2.5) is installed and themed (details in `ux.md`).
- Environment files: `.env` (git-ignored, placeholder values) and `.env.example` (committed template).
- **Supabase clients** for the server (`src/lib/supabase/server.ts`) and the browser (`src/lib/supabase/client.ts`), using `@supabase/ssr` 0.12 and `@supabase/supabase-js` 2.119.
- **Login page** (`/login`): email + password via a Server Action, then redirects to `/dashboard`. It links to `/signup` and shows a notice after a sign-up.
- **Sign-up page** (`/signup`): email, password and a **teacher / student** choice. The role is stored in the user's metadata, then the user is redirected to `/login` with a notice.
- **Route protection** (`src/proxy.ts`):
  - logged-out users can only open `/login` and `/signup`; everything else redirects to `/login`
  - logged-in users opening `/`, `/login` or `/signup` are redirected to `/dashboard`
  - the proxy also refreshes expired sessions
- **Server-side verification**: `getCurrentUser()` (`src/lib/auth/session.ts`) re-checks the session on the server and redirects to `/login` if it is missing.
- **Logout**: a Server Action ends the session, then a full page load goes to `/login`.
- `/dashboard` is a **placeholder** page ("Signed in as …" and a "Log out" button). Steps 5–6 replace it with the real layout and Overview page. There is no page at `/`; the proxy always redirects it.
- `npm run build`, `npm run lint` and `npx tsc --noEmit` all pass.
- Tested in Chrome against a local mock of Supabase Auth, in both `next start` and `next dev`. The dev console is clean apart from Lit's expected dev-mode notice. Coverage:
  - logged-out and logged-in redirects for every route
  - login, logout (cookies cleared, fresh login form, dashboard locked again)
  - expired-token refresh in both proxy branches
  - all sign-up and login form paths
  
  **Not yet tested against a real Supabase project**, because `.env` still has placeholders.

**Not built yet**

- The `profiles` table and reading roles (step 4), dashboard layout and navigation (step 5), Overview page (step 6), README (step 7).
- Until step 4, the chosen role lives **only** in each user's metadata.
- No password-reset page (out of scope).

---

## How it works

### Folder structure

```
.
├── AGENTS.md                 # Agent instructions (top block is managed by `next dev`)
├── features/                 # Project docs: logic.md, ux.md, leaderboard.md
├── src/
│   ├── proxy.ts              # Route protection + session refresh (runs before every request)
│   ├── app/                  # App Router routes (no page at "/": the proxy redirects it)
│   │   ├── layout.tsx        # Root layout: font, theme CSS, Material Web registration, title template
│   │   ├── globals.css       # Small, token-based global styles
│   │   ├── (auth)/           # Route group (not in the URL) for the public auth pages
│   │   │   ├── layout.tsx        # Centred card shared by /login and /signup
│   │   │   ├── AuthHeader.tsx    # App name + page <h1>
│   │   │   ├── auth.module.css
│   │   │   ├── login/        # /login: page.tsx (+ post-sign-up notice), LoginForm.tsx
│   │   │   └── signup/       # /signup: page.tsx, SignupForm.tsx
│   │   └── dashboard/        # /dashboard: PLACEHOLDER page (steps 5–6 replace it)
│   │       ├── page.tsx
│   │       └── page.module.css
│   ├── components/
│   │   ├── auth/
│   │   │   └── LogoutButton.tsx  # Calls logout(), then full page load to /login
│   │   └── material/         # Material Web registration, JSX types, MaterialForm (see ux.md)
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── actions.ts    # Server Actions: login, signup, logout
│   │   │   ├── roles.ts      # ROLES, Role type, labels, isRole()
│   │   │   ├── routes.ts     # LOGIN_PATH, HOME_PATH, PUBLIC_PATHS
│   │   │   └── session.ts    # getCurrentUser(): verified user for server code
│   │   └── supabase/
│   │       ├── server.ts     # createClient() for Server Components / Actions / Route Handlers
│   │       └── client.ts     # createClient() for Client Components (not used yet)
│   └── theme/
│       └── theme.css         # M3 design tokens (colours, typefaces), light + dark
├── .env.example              # Committed env template
├── .env                      # Your real keys (git-ignored)
└── next.config.ts
```

Conventions:

- Import alias `@/*` → `src/*`.
- Pages and their route-only components live in the route folder. Shared logic lives in `src/lib/`; shared UI lives in `src/components/`.
- Route paths used in code come from `src/lib/auth/routes.ts`, not string literals.
- Planned homes for later steps: `supabase/` (SQL), `src/config/` (navigation config), `src/app/dashboard/layout.tsx` (dashboard shell). Update this tree when they are added.

### Key files

| File | What it does |
| --- | --- |
| `next.config.ts` | Turns on `cacheComponents` and `partialPrefetching` (see below). |
| `src/proxy.ts` | Runs before every page request and Server Action. Validates and refreshes the Supabase session, then redirects according to the [rules below](#route-protection). |
| `src/app/layout.tsx` | Root layout. Loads Roboto with `next/font`, imports the theme CSS and M3 type scale, renders `<MaterialWeb />` so the M3 elements are defined in the browser. Sets the title template `%s · REPLY Track`. |
| `src/lib/supabase/server.ts` | `createClient()` for server code. Reads and writes the session cookies via `next/headers`, and calls `io()` (see [Rendering model](#rendering-model-cache-components-are-on)). Create one per request. |
| `src/lib/supabase/client.ts` | `createClient()` for browser code. Same cookie session. Not used yet. |
| `src/lib/auth/session.ts` | `getCurrentUser()`: the verified `{ id, email }` of the logged-in user, or a redirect to `/login`. Cached per request. Step 4 adds the role. |
| `src/lib/auth/actions.ts` | Server Actions `login`, `signup` (both via `useActionState`) and `logout`. |
| `src/lib/auth/routes.ts` | `LOGIN_PATH` (`/login`), `HOME_PATH` (`/dashboard`), `PUBLIC_PATHS` (`/login`, `/signup`). |
| `src/lib/auth/roles.ts` | The role list (`teacher`, `student`), `Role` type, display labels and `isRole()` guard. Use it everywhere roles appear. |
| `src/components/auth/LogoutButton.tsx` | M3 outlined "Log out" button. Calls `logout()`, then `window.location.assign('/login')`. |
| `src/app/dashboard/page.tsx` | Placeholder protected page. Shows the user via `getCurrentUser()` inside `<Suspense>`. |
| `src/app/(auth)/login/page.tsx` | Login page. Reads `?signup=confirm|done` (behind `<Suspense>`) to show the post-sign-up notice. |
| `src/app/(auth)/signup/SignupForm.tsx` | Sign-up form with the role radio group. |
| `src/components/material/MaterialWeb.tsx` | The one place where Material Web components are imported/registered (plus the hydration rule; see ux.md). |
| `src/components/material/MaterialForm.tsx` | `MaterialForm`, `SubmitButton`, `FormError`: the form building blocks every form uses (see ux.md). |
| `src/theme/theme.css` | All `--md-sys-color-*` tokens for light and dark mode, plus typeface tokens. |
| `.env.example` / `.env` | Supabase URL and anon key (placeholders). |

### Rendering model: Cache Components are on

`next.config.ts` keeps the Next 16.4 scaffold defaults:

```ts
cacheComponents: true,
partialPrefetching: true,
```

**Why:** the bundled Next docs say both will be enabled everywhere in the next major version and the options will be removed. Building on them now avoids a migration later.

**What it means for auth, roles and the dashboard:**

- Data is dynamic by default; nothing is cached unless marked with `'use cache'`.
- Reading request data (`cookies()`, `headers()`, `searchParams`, and therefore the Supabase session) **outside a `<Suspense>` boundary is a build error**. Anything that depends on the logged-in user or the query string must render inside `<Suspense>`. Examples: `SignedInAs` in `src/app/dashboard/page.tsx`, `SignupNotice` in the login page.
- Don't `await` the session at the top level of a layout. Push the read down into a component inside a boundary (relevant for the dashboard layout in step 5).
- **`createClient()` calls `await io()`** after reading cookies. Partial Prefetching can prerender pages *with* the user's cookies (a per-session shell). Supabase then compares token expiry with `Date.now()`, which Next rejects during prerendering ("encountered the unstable value `Date.now()`"). `io()` tells Next that time-dependent work follows: it resolves immediately during real requests and Server Actions, and keeps the session read out of prerendered shells. Don't remove it.
- Server Actions can read and write cookies freely; the Suspense rule only applies to rendering.
- `/signup` is fully static. `/login` and `/dashboard` are static shells with a small streamed part. Keep auth pages free of session reads; the proxy handles "already logged in".
- In development, Next also checks each page for things that would block instant navigation. These appear in the dev overlay and console. Keeping session reads inside `<Suspense>` (plus `io()`) satisfies them.
- Reference: `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`.

### Supabase clients

Both come from `@supabase/ssr`, which stores the session (access + refresh token) in **cookies** named `sb-<project-ref>-auth-token` (split into `.0`, `.1`, … if large). Because the session is in cookies, server code and browser code see the same session.

| Use in | Import | Notes |
| --- | --- | --- |
| Server Components, Server Actions, Route Handlers | `import { createClient } from '@/lib/supabase/server'` then `await createClient()` | Async, because it reads `cookies()`. Writing cookies only works in Actions and Route Handlers; in Server Components the write is silently skipped (try/catch in `setAll`). |
| Client Components | `import { createClient } from '@/lib/supabase/client'` | For browser-only features (e.g. realtime). Prefer server code for auth and data. |
| `src/proxy.ts` | its own `createServerClient` with request/response cookies | Proxy can't use `next/headers`; it reads `request.cookies` and writes response cookies. |

**Reading the current user on the server:** call `getCurrentUser()` from `src/lib/auth/session.ts`. It uses `supabase.auth.getClaims()`, which validates the JWT either locally (asymmetric signing keys) or by calling Supabase Auth (legacy symmetric keys). **Don't trust `getSession()` on the server**: it only decodes the cookie without validating it.

### Route protection

Two layers, following Next's guidance that the proxy alone is not enough:

**1. `src/proxy.ts` (optimistic, runs first)**

| Request | Logged out | Logged in |
| --- | --- | --- |
| `/login`, `/signup` (`PUBLIC_PATHS`) | page renders | 307 → `/dashboard` |
| `/` | 307 → `/login` | 307 → `/dashboard` |
| anything else (incl. unknown paths, Server Action POSTs) | 307 → `/login` | page renders (or 404) |

- The redirect drops any query string, e.g. `/login?signup=done` while logged in → `/dashboard`.
- **Session refresh:** `supabase.auth.getClaims()` refreshes an expired access token using the refresh token. The new cookies are written to the request (so the page rendering this request sees them) and to the response, **including redirect responses**. Supabase refresh tokens are single-use, so a response that drops the new cookies would sign the user out on their next request.
- The `Cache-Control: private, no-store` headers that `@supabase/ssr` asks for when it writes auth cookies are copied onto the response, so a CDN never caches one user's session.
- `config.matcher` skips `_next/static`, `_next/image`, `favicon.ico` and image files. Everything else, including Server Action POSTs, goes through the proxy.

**2. `getCurrentUser()` (authoritative, in server code)**

- Every protected Server Component calls it (inside `<Suspense>`); future Server Actions and Route Handlers that touch user data must call it too.
- It redirects to `/login` if the session is invalid, so a page is safe even if the proxy matcher changes.
- Wrapped in React `cache()`, so several components calling it in one request cost one check.

**Adding pages:** new pages are protected automatically. To add another public page (e.g. a password-reset page), add its path to `PUBLIC_PATHS` in `src/lib/auth/routes.ts`.

### Auth flow: login

```
/login (static page)
  └─ LoginForm (client, uses <MaterialForm>)
       │ user submits (button click or Enter) → form.requestSubmit() → browser validation
       ▼
     startTransition(() => formAction(formData))
       ▼
  login() Server Action (src/lib/auth/actions.ts)
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

- **Where the role goes:** into the new user's `raw_user_meta_data` as `{ "role": "teacher" | "student" }`. In step 4, a database trigger on `auth.users` copies it into `public.profiles.role` when the user is created, and a one-off backfill covers users who signed up before that.
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

Needed to try the app with a real project. Step 7's README repeats this for new developers.

1. Create a project at https://supabase.com/dashboard (free tier is fine).
2. **Project Settings → API**: copy the Project URL into `NEXT_PUBLIC_SUPABASE_URL` and the anon (or publishable) key into `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env`. Restart `npm run dev`.
3. **Authentication → Sign In / Providers → Email** must be enabled (it is by default). On the same screen:
   - **Confirm email** (on by default): new users must click a link in an email before they can sign in. The built-in email service on the free tier only sends a few emails per hour. For local development it is easiest to turn this **off**; for production, keep it on and add custom SMTP.
   - **Minimum password length** (default 6): keep `minLength` in `SignupForm.tsx` in sync.
4. **Authentication → URL Configuration → Site URL**: the confirmation link sends users here (default `http://localhost:3000`). Set it to the real app URL when deploying. Arriving at `/` logged out simply redirects to `/login`.
5. Visit `/signup`, create an account, sign in on `/login` and you land on `/dashboard`. Users can also be created in **Authentication → Users → Add user** (tick **Auto Confirm User**), but those users have no role in their metadata. Set it under the user's raw metadata, or in `profiles` once step 4 exists.

### Environment variables

| Variable | Used for | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key: the legacy anon key or the newer publishable key (`sb_publishable_…`). Safe in the browser because Row Level Security protects the data. | Same page |

- `.env` is created with placeholder values. Paste the real values there. The project uses **`.env`** (not `.env.local`) by convention.
- `.gitignore` ignores `.env*` but allows `.env.example`.
- Never add the `service_role` / secret key to a `NEXT_PUBLIC_` variable.
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
- [ ] **4. Roles**: SQL for the `profiles` table (`role` = `teacher` | `student`, checked by a constraint). It must also include:
  - a trigger that creates the profile from `raw_user_meta_data->>'role'` on sign-up
  - a backfill for existing users
  - RLS so users can read their own profile but **not change their role**
  - adding `role` to `getCurrentUser()` (read from `profiles`, never from metadata)
- [ ] **5. Dashboard layout**: `src/app/dashboard/layout.tsx` with navigation built from a config array (role-aware) and the logout button (move `LogoutButton` there)
- [ ] **6. Overview page**: replace the placeholder `src/app/dashboard/page.tsx` with different placeholder content for teachers and students
- [ ] **7. README**: install, env vars, Supabase settings, SQL, run locally

Left unfinished on purpose:

- `/dashboard` is a bare placeholder (heading, email, logout button).
- `getCurrentUser()` returns only `id` and `email`.
- `src/lib/supabase/client.ts` exists but has no caller yet.
- No "return to the page you wanted after login" (`?next=`). The login always lands on `/dashboard`.

---

## Gotchas

- **This is Next.js 16, not the version most examples online use.** Check the bundled docs in `node_modules/next/dist/docs/` before writing Next-specific code (see `AGENTS.md`). In particular, `middleware.ts` is deprecated and renamed to **`proxy.ts`** (export `proxy` instead of `middleware`). It runs on the Node.js runtime.
- **Don't rely on the proxy alone.** Call `getCurrentUser()` in every protected page, Server Action and Route Handler. Next's docs warn that a matcher change or moving a Server Action can silently remove proxy coverage.
- **Keep refreshed cookies on every proxy response**, including redirects (see [Route protection](#route-protection)). Refresh tokens are single-use, so dropping them signs users out.
- **Proxy cost per request:** `getClaims()` verifies the token locally only when the Supabase project uses the newer asymmetric JWT signing keys. With legacy symmetric keys it calls Supabase Auth on **every** request (proxy + `getCurrentUser()`). If pages feel slow, switch the project to asymmetric keys (Project Settings → JWT Keys).
- **Don't remove `await io()` from `createClient()`** (see [Rendering model](#rendering-model-cache-components-are-on)).
- **Logout must stay a full page load** (see [Auth flow: logout](#auth-flow-logout)).
- **Never read the role from user metadata for authorization.** Users can change their own `user_metadata` with `supabase.auth.updateUser()`. Metadata is only the hand-off from the sign-up form to the database trigger. The `profiles` table (step 4, protected by RLS) is the source of truth.
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
