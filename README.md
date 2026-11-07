# REPLY Track

A minimal dashboard template for teachers and students, ready to be extended.

- **Next.js 16** (App Router) + **React 19** + TypeScript
- **Supabase** for authentication (email/password) and data (free tier is enough)
- **Material Design 3** via Google's [Material Web](https://material-web.dev/) components and M3 design tokens

What's included:

- Sign-up (with a **teacher** / **student** choice) and sign-in pages
- Route protection: logged-out users always land on `/login`, logged-in users on the dashboard
- Roles stored in a Supabase `profiles` table, protected by Row Level Security
- A dashboard with an M3 navigation rail built from a single config array (with per-role visibility) and a log-out button
- An Overview page with different placeholder content for teachers and students
- Light and dark theme (follows the operating system)

---

## Prerequisites

- [Node.js](https://nodejs.org/) **20.9 or newer** (includes npm)
- A free [Supabase](https://supabase.com/) account

## Setup

### 1. Install

```bash
git clone https://github.com/Dan-Banfield/REPLY-Track.git
cd REPLY-Track
npm install
```

### 2. Create a Supabase project

In the [Supabase dashboard](https://supabase.com/dashboard), click **New project**, choose a name and a database password, and wait for it to finish setting up.

### 3. Environment variables

Copy the template, then fill in your project's values:

```bash
cp .env.example .env
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Project Settings → API** (called **Data API** in newer dashboards) → Project URL. The **Connect** button at the top of the project shows it too. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → **Project Settings → API Keys** → the **anon** key (legacy) or the **publishable** key (`sb_publishable_…`); either works |

- This project uses **`.env`** (not `.env.local`). It is git-ignored; `.env.example` is the committed template.
- Both values are safe to expose to the browser. **Never** put the `service_role` / secret key in this file under a `NEXT_PUBLIC_` name.

### 4. Create the database tables

The app reads each user's role from a `profiles` table, which you create once by running the SQL in [`supabase/migrations/`](supabase/migrations/):

1. Supabase → **SQL Editor → New query**
2. Paste the **whole** contents of [`supabase/migrations/20261107000000_create_profiles.sql`](supabase/migrations/20261107000000_create_profiles.sql)
3. Click **Run**. You should see *"Success. No rows returned"*.
4. Check **Table Editor** (schema `public`): a `profiles` table should now exist.

The script creates:

- the `user_role` type (`teacher` | `student`)
- the `profiles` table and its security rules (users can read only their own profile and can't change their role)
- a trigger that creates a profile whenever someone signs up
- profiles for any accounts that already exist

It is safe to run more than once. If more migration files are added later, run them in filename order.

### 5. Auth settings

Under Supabase → **Authentication**:

- **Sign In / Providers → Email** must be enabled (it is by default).
- **Confirm email** (same screen) is on by default: new users must click a link in an email before they can sign in. The free tier's built-in email sender only allows a few emails per hour, so **turn it off while developing**. For production, keep it on and set up custom SMTP.
- **Minimum password length** defaults to 6, which matches the sign-up form. If you change it, also update `minLength` in `src/app/(auth)/signup/SignupForm.tsx`.
- **URL Configuration → Site URL** is where confirmation emails send people. Keep `http://localhost:3000` for local development; set your real URL when you deploy.

### 6. Run locally

```bash
npm run dev
```

Open http://localhost:3000. You'll be redirected to `/login`.

1. Click **Sign up**, enter an email and password, choose **Teacher** or **Student**, and create the account.
2. Sign in. You land on the dashboard, and the Overview shows the content for your role.
3. **Log out** is at the bottom of the navigation rail.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server at http://localhost:3000 |
| `npm run build` | Production build (also type-checks) |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
├── proxy.ts                 # Route protection + Supabase session refresh
├── app/
│   ├── (auth)/              # /login and /signup
│   ├── dashboard/           # Dashboard layout (navigation rail) and the Overview page
│   ├── error.tsx            # Error page with "Try again" and "Log out"
│   └── layout.tsx           # Root layout: fonts, theme, Material Web
├── config/navigation.ts     # The navigation items (one entry per page)
├── components/              # Shared UI: navigation rail, Material Web setup, forms
├── lib/
│   ├── auth/                # Server Actions, roles, routes, getCurrentUser()
│   └── supabase/            # Supabase clients (server and browser)
└── theme/theme.css          # Material 3 colour and type tokens (light + dark)
supabase/migrations/         # SQL to run in the Supabase SQL Editor
features/                    # Detailed project docs (see below)
```

## Common tasks

- **Add a dashboard page:** create `src/app/dashboard/<name>/page.tsx` and add one entry to `NAV_ITEMS` in [`src/config/navigation.ts`](src/config/navigation.ts) with its label, URL, [Material Symbols](https://fonts.google.com/icons) icon and the roles that can see it. If the page is for some roles only, also check the role in the page; see [`features/logic.md`](features/logic.md#role-restricted-pages).
- **Change someone's role:** Supabase → **Table Editor → `profiles`**, then edit the `role` column. It takes effect on their next page load.
- **Change the brand colour:** see "Theme" in [`features/ux.md`](features/ux.md#theme-design-tokens).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| **"Something went wrong"** right after signing in; the terminal shows *"Could not find the table 'public.profiles'"* | The SQL hasn't been run in this Supabase project. Do [step 4](#4-create-the-database-tables), then click **Try again**. |
| "Something went wrong" and the terminal shows *"No valid profile found for user …"* | That account has no row in `profiles` (e.g. it was deleted). Re-run the SQL from step 4; it adds missing profiles. |
| *"Confirm your email address before signing in."* | Click the link in the confirmation email, or turn off **Confirm email** (step 5). Accounts created in the dashboard need **Auto Confirm User** ticked. |
| *"Too many sign-up emails were sent recently."* | The free tier's email limit was hit. Turn off **Confirm email** while developing (step 5). |
| *"Sign-in failed. Please try again."* and the terminal shows `fetch failed` | `.env` still has placeholder or wrong values. Fix them and restart `npm run dev`. |
| Every page errors with *"Your project's URL and Key (or API key) are required to create a Supabase client"* | `.env` is missing or a variable name is misspelled. Fix it and restart `npm run dev`. |
| Icons show as words (e.g. "dashboard") | The icon font couldn't load (offline?), or a new icon wasn't added to the list; see "Icons" in [`features/ux.md`](features/ux.md#icons-material-symbols). |
| *"Another next dev server is already running"* | Only one dev server can run per project folder. Use the existing one, or stop it first. |

## Documentation

Detailed, up-to-date docs for developers (and AI coding agents) live in [`features/`](features/):

- [`features/logic.md`](features/logic.md): auth flow, route protection, roles and SQL, Supabase setup, key files, gotchas
- [`features/ux.md`](features/ux.md): Material 3 theme and components, layout, navigation config, what each role sees

[`AGENTS.md`](AGENTS.md) has notes for AI coding agents, including that this project uses Next.js 16 conventions (e.g. `proxy.ts` instead of `middleware.ts`).
