# App logic

How the app works under the hood: project setup, auth flow, route protection, roles, Supabase setup, data flow and key files. Read it together with [`ux.md`](./ux.md), which covers the UI and design.

_Last updated: step 2 of 7 (Supabase clients, login and sign-up)._

---

## Current state

**Built and working**

- Next.js **16.4.5** (App Router, Turbopack), React **19.3**, TypeScript (strict), ESLint (`eslint-config-next`), npm.
- Material Web (`@material/web` 2.5) is installed and themed (details in `ux.md`).
- Environment files: `.env` (git-ignored, placeholder values) and `.env.example` (committed template).
- **Supabase clients** for the server (`src/lib/supabase/server.ts`) and the browser (`src/lib/supabase/client.ts`), using `@supabase/ssr` 0.12 and `@supabase/supabase-js` 2.119.
- **Login page** at `/login`: email + password via a Server Action. Shows errors and keeps the typed values on failure. On success it redirects to `/`. It links to `/signup`, and after a sign-up it shows a confirmation notice.
- **Sign-up page** at `/signup`: email, password and a **teacher / student** choice. It creates the Supabase user with the role in the user's metadata, then redirects to `/login` with a notice.
- `/` is a **temporary** page that shows "Signed in as …" or "Not signed in." It proves the server can read the session cookie. Step 3 replaces it.
- `npm run build`, `npm run lint` and `npx tsc --noEmit` all pass.
- Login and sign-up were tested in Chrome against a local mock of Supabase Auth, covering:
  - wrong and correct password, cookie set, session read after reload
  - every submit path (click, Enter, keyboard)
  - sign-up validation, an existing email, the confirmation-required flow and the auto-confirm flow
  
  They have **not yet been tested against a real Supabase project**, because `.env` still has placeholders.

**Not built yet**

- Route protection, session refresh (proxy), logout, the `profiles` table and reading roles, dashboard layout, Overview page, README. See [Next steps](#next-steps).
- Until step 4 adds the `profiles` table, the chosen role lives **only** in each user's metadata.
- No password-reset page (out of scope).

---

## How it works

### Folder structure

```
.
├── AGENTS.md                 # Agent instructions (top block is managed by `next dev`)
├── features/                 # Project docs: logic.md, ux.md, leaderboard.md
├── src/
│   ├── app/                  # App Router routes
│   │   ├── layout.tsx        # Root layout: font, theme CSS, Material Web registration, title template
│   │   ├── globals.css       # Small, token-based global styles
│   │   ├── page.tsx          # TEMPORARY setup check page with session status (replaced in step 3)
│   │   ├── page.module.css
│   │   └── (auth)/           # Route group (not in the URL) for the public auth pages
│   │       ├── layout.tsx        # Centred card shared by /login and /signup
│   │       ├── AuthHeader.tsx    # App name + page <h1>
│   │       ├── auth.module.css
│   │       ├── login/
│   │       │   ├── page.tsx      # /login (+ post-sign-up notice from ?signup=…)
│   │       │   └── LoginForm.tsx
│   │       └── signup/
│   │           ├── page.tsx      # /signup
│   │           └── SignupForm.tsx
│   ├── components/
│   │   └── material/         # Material Web registration, JSX types, MaterialForm (see ux.md)
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── actions.ts    # Server Actions: login, signup
│   │   │   └── roles.ts      # ROLES, Role type, labels, isRole()
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
- Pages and their route-only components live in the route folder. Shared logic lives in `src/lib/` (auth actions in `src/lib/auth/actions.ts`); shared UI lives in `src/components/`.
- Planned homes for later steps: `src/proxy.ts` (route protection + session refresh), `supabase/` (SQL), `src/config/` (navigation config). Update this tree when they are added.

### Key files

| File | What it does |
| --- | --- |
| `next.config.ts` | Turns on `cacheComponents` and `partialPrefetching` (see below). |
| `src/app/layout.tsx` | Root layout. Loads Roboto with `next/font`, imports the theme CSS and M3 type scale, renders `<MaterialWeb />` so the M3 elements are defined in the browser. Sets the title template `%s · REPLY Track`. |
| `src/lib/supabase/server.ts` | `createClient()` for server code. Reads and writes the session cookies via `next/headers`. Create one per request. |
| `src/lib/supabase/client.ts` | `createClient()` for browser code. Same cookie session. Not used yet. |
| `src/lib/auth/actions.ts` | Server Actions `login` and `signup`, both called through `useActionState`. They validate input, call Supabase Auth, map errors to user-friendly messages and redirect on success. |
| `src/lib/auth/roles.ts` | The role list (`teacher`, `student`), `Role` type, display labels and `isRole()` guard. Use it everywhere roles appear. |
| `src/app/(auth)/login/page.tsx` | Login page. Reads `?signup=confirm|done` (behind `<Suspense>`) to show the post-sign-up notice. |
| `src/app/(auth)/signup/SignupForm.tsx` | Sign-up form with the role radio group. |
| `src/theme/theme.css` | All `--md-sys-color-*` tokens for light and dark mode, plus typeface tokens. |
| `src/components/material/MaterialWeb.tsx` | The one place where Material Web components are imported/registered. |
| `src/components/material/MaterialForm.tsx` | `MaterialForm`, `SubmitButton`, `FormError`: the form building blocks every form uses (see ux.md). |
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
- Reading request data (`cookies()`, `headers()`, `searchParams`, and therefore the Supabase session) **outside a `<Suspense>` boundary is a build error**. Anything that depends on the logged-in user or the query string must render inside `<Suspense>`. Examples: `SessionStatus` in `src/app/page.tsx`, `SignupNotice` in the login page.
- Don't `await` the session at the top level of a layout. Push the read down into a component inside a boundary.
- Server Actions can read and write cookies freely; the rule above only applies to rendering.
- `/signup` is fully static. `/login` is static apart from the small notice. Keep auth pages free of session reads. Step 3 adds the "already logged in" redirect in the proxy, not in the pages.
- In development, Next also checks each page for things that would block instant navigation. These appear as warnings in the dev overlay, not build errors. Keeping session reads inside `<Suspense>` satisfies them.
- Reference: `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`.

### Supabase clients

Both come from `@supabase/ssr`, which stores the session (access + refresh token) in **cookies** named `sb-<project-ref>-auth-token` (split into `.0`, `.1`, … if large). Because the session is in cookies, server code and browser code see the same session.

| Use in | Import | Notes |
| --- | --- | --- |
| Server Components, Server Actions, Route Handlers | `import { createClient } from '@/lib/supabase/server'` then `await createClient()` | Async, because it reads `cookies()`. Writing cookies only works in Actions and Route Handlers; in Server Components the write is silently skipped (try/catch in `setAll`). |
| Client Components | `import { createClient } from '@/lib/supabase/client'` | For browser-only features (e.g. realtime). Prefer server code for auth and data. |

**Reading the current user on the server:** use `supabase.auth.getClaims()`. It validates the JWT, either locally with the project's asymmetric signing keys or by calling Supabase Auth for legacy symmetric keys, and returns the claims (`sub` = user id, `email`, …). **Don't trust `getSession()` on the server**: it only decodes the cookie without validating it.

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
       └─ success → session cookies written by the server client → redirect('/')
```

- Errors come back as `FormState` (`{ error: string | null }`) and are shown by `<FormError>`.
- `redirect()` throws by design. Keep it outside any `try/catch`.
- **TODO (step 3):** redirect to the dashboard instead of `/`.

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
- **Why sign out after an auto-confirmed sign-up:** the requirement is that new users land on the login page. If Supabase signs them in straight away, the proxy (step 3) would otherwise bounce them from `/login` to the dashboard.
- The `signup` query value only selects one of two fixed messages in the login page (`SIGNUP_NOTICES`), so arbitrary text can't be injected through the URL.

### Supabase project setup

Needed to try login and sign-up with a real project. Step 7's README repeats this for new developers.

1. Create a project at https://supabase.com/dashboard (free tier is fine).
2. **Project Settings → API**: copy the Project URL into `NEXT_PUBLIC_SUPABASE_URL` and the anon (or publishable) key into `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env`. Restart `npm run dev`.
3. **Authentication → Sign In / Providers → Email** must be enabled (it is by default). On the same screen:
   - **Confirm email** (on by default): new users must click a link in an email before they can sign in. The built-in email service on the free tier only sends a few emails per hour. For local development it is easiest to turn this **off**; for production, keep it on and add custom SMTP.
   - **Minimum password length** (default 6): keep `minLength` in `SignupForm.tsx` in sync.
4. **Authentication → URL Configuration → Site URL**: the confirmation link sends users here (default `http://localhost:3000`). Set it to the real app URL when deploying.
5. Visit `/signup`, create an account, then sign in on `/login`. Users can also be created in **Authentication → Users → Add user** (tick **Auto Confirm User**), but those users have no role in their metadata. Set it under the user's raw metadata, or in `profiles` once step 4 exists.

### Environment variables

| Variable | Used for | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key: the legacy anon key or the newer publishable key (`sb_publishable_…`). Safe in the browser because Row Level Security protects the data. | Same page |

- `.env` is created with placeholder values. Paste the real values there. The project uses **`.env`** (not `.env.local`) by convention.
- `.gitignore` ignores `.env*` but allows `.env.example`.
- Never add the `service_role` / secret key to a `NEXT_PUBLIC_` variable.
- Next.js loads `.env` in every environment (dev, build, start). If someone also creates a `.env.local`, it overrides `.env`, so keep only one.
- If the variables are missing entirely, creating a Supabase client throws "Your project's URL and Key are required…". If they are placeholders, sign-in/sign-up shows "… failed. Please try again." and the server log shows `AuthRetryableFetchError: fetch failed`.

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
- [ ] **3. Route protection**: `src/proxy.ts` refreshes the session and redirects (logged-out → `/login`, logged-in → dashboard); `/` redirects; logout; change the login redirect target
- [ ] **4. Roles**: SQL for the `profiles` table (`role` = `teacher` | `student`, checked by a constraint). It must also include:
  - a trigger that creates the profile from `raw_user_meta_data->>'role'` on sign-up
  - a backfill for existing users
  - RLS so users can read their own profile but **not change their role**
  - reading the role in the app
- [ ] **5. Dashboard layout**: navigation built from a config array (role-aware), logout button
- [ ] **6. Overview page**: different placeholder content for teachers and students
- [ ] **7. README**: install, env vars, Supabase settings, SQL, run locally

Left unfinished on purpose in step 2:

- **No session refresh yet.** Access tokens expire after about an hour. Until step 3's proxy refreshes them, an expired session simply reads as "Not signed in."
- Login redirects to the temporary `/` page.
- `src/lib/supabase/client.ts` exists but has no caller yet.

---

## Gotchas

- **This is Next.js 16, not the version most examples online use.** Check the bundled docs in `node_modules/next/dist/docs/` before writing Next-specific code (see `AGENTS.md`). In particular, `middleware.ts` is deprecated and renamed to **`proxy.ts`** (export `proxy` instead of `middleware`).
- **Never read the role from user metadata for authorization.** Users can change their own `user_metadata` with `supabase.auth.updateUser()`. Metadata is only the hand-off from the sign-up form to the database trigger. The `profiles` table (step 4, protected by RLS) is the source of truth.
- **Anyone can sign up as a teacher.** The role is self-selected, as specified. If that ever matters, add an approval step (e.g. a `pending` flag that an admin clears).
- **"Account already exists" is only reported when email confirmation is off.** With confirmation on, Supabase hides whether an email is registered (to prevent account enumeration). It returns a normal-looking result and sends no email, so the user sees the "check your email" notice.
- **The free tier's built-in email sender is heavily rate-limited.** Repeated sign-up tests quickly hit `over_email_send_rate_limit`. Turn off "Confirm email" while developing.
- **`LayoutProps` / `PageProps` are global types that Next generates.** On a fresh clone, `npx tsc --noEmit` fails with "Cannot find name 'LayoutProps'" until `npm run dev`, `npm run build` or `npx next typegen` has run once.
- **`NEXT_PUBLIC_*` values are inlined at build time.** Restart `npm run dev` (or rebuild) after editing `.env`.
- **Supabase key naming.** The variable is called `..._ANON_KEY` because that name was requested, but the newer publishable key works in it too (supabase-js treats both the same).
- **Auth cookies are not `httpOnly`.** This is `@supabase/ssr`'s design, so the browser client can read the session too. Protection relies on Row Level Security in the database, not on hiding the token.
- **`setAll` errors are swallowed in Server Components** (see `server.ts`). This is intentional: Server Components can't set cookies, and the proxy (step 3) will handle token refresh.
- **Recently visited pages stay mounted.** With Cache Components, Next keeps the previous route in the DOM, hidden by React `<Activity>`, instead of unmounting it. After login, the login form (and its state) stays mounted invisibly. Keep this in mind for logout in step 3. A full reload clears it.
- **Use `getClaims()`, not `getSession()`, for anything security-related on the server** (see [Supabase clients](#supabase-clients)).
- **`'use server'` files may only export async functions** (plus types). Constants like `ROLES` live in `roles.ts`, not in `actions.ts`.
- **`npm audit` reports a moderate advisory** in `minimatch`, pulled in by the ESLint/TypeScript tooling (dev-only, not shipped to the browser). `npm audit fix --force` would downgrade `eslint-config-next` to v15, so don't run it. Wait for an upstream fix instead.
- **`AGENTS.md`**: the block between the `nextjs-agent-rules` markers is rewritten by `next dev`. Put project notes outside that block.
