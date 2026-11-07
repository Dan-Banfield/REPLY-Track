# App logic

How the app works under the hood: project setup, auth flow, route protection, roles, Supabase setup, data flow and key files. Read it together with [`ux.md`](./ux.md), which covers the UI and design.

_Last updated: step 1 of 7 (project setup)._

---

## Current state

**Built and working**

- Next.js **16.4.5** (App Router, Turbopack), React **19.3**, TypeScript (strict), ESLint (`eslint-config-next`), npm.
- Material Web (`@material/web` 2.5) is installed and themed (details in `ux.md`).
- Environment files: `.env` (git-ignored, placeholder values) and `.env.example` (committed template).
- `/` is a **temporary** page that only shows the theme. Step 3 replaces it.
- `npm run build`, `npm run lint` and `npx tsc --noEmit` all pass.

**Not built yet**

- Supabase clients, login page, route protection, logout, roles (`profiles` table), dashboard layout, Overview page, README. See [Next steps](#next-steps).

---

## How it works

### Folder structure

```
.
├── AGENTS.md                 # Agent instructions (top block is managed by `next dev`)
├── features/                 # Project docs: logic.md, ux.md, leaderboard.md
├── src/
│   ├── app/                  # App Router routes
│   │   ├── layout.tsx        # Root layout: font, theme CSS, Material Web registration
│   │   ├── globals.css       # Small, token-based global styles
│   │   ├── page.tsx          # TEMPORARY theme check page (replaced in step 3)
│   │   └── page.module.css
│   ├── components/
│   │   └── material/         # Material Web registration + JSX types (see ux.md)
│   └── theme/
│       └── theme.css         # M3 design tokens (colours, typefaces), light + dark
├── .env.example              # Committed env template
├── .env                      # Your real keys (git-ignored)
└── next.config.ts
```

Conventions:

- Import alias `@/*` → `src/*`.
- Planned homes for later steps: `src/lib/supabase/` (Supabase clients), `src/proxy.ts` (route protection), `supabase/` (SQL), `src/config/` (navigation config). Update this tree when they are added.

### Key files

| File | What it does |
| --- | --- |
| `next.config.ts` | Turns on `cacheComponents` and `partialPrefetching` (see below). |
| `src/app/layout.tsx` | Root layout. Loads Roboto with `next/font`, imports the theme CSS and M3 type scale, renders `<MaterialWeb />` so the M3 elements are defined in the browser. |
| `src/theme/theme.css` | All `--md-sys-color-*` tokens for light and dark mode, plus typeface tokens. |
| `src/components/material/MaterialWeb.tsx` | The one place where Material Web components are imported/registered. |
| `src/components/material/material-web.d.ts` | Makes every registered `md-*` tag type-safe in JSX. |
| `.env.example` / `.env` | Supabase URL and anon key (placeholders). |

### Rendering model: Cache Components are on

`next.config.ts` keeps the Next 16.4 scaffold defaults:

```ts
cacheComponents: true,
partialPrefetching: true,
```

**Why:** the bundled Next docs say both will be enabled everywhere in the next major version and the options will be removed. Building on them now avoids a migration later.

**What it means for later steps (auth, roles, dashboard):**

- Data is dynamic by default; nothing is cached unless marked with `'use cache'`.
- Reading request data (`cookies()`, `headers()`, and therefore the Supabase session) **outside a `<Suspense>` boundary is a build error**. Anything that depends on the logged-in user must render inside `<Suspense>`.
- Don't `await` the session at the top level of a layout. Push the read down into a component inside a boundary.
- Reference: `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`.

### Environment variables

| Variable | Used for | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (anon) API key, safe in the browser because Row Level Security protects the data | Same page |

- `.env` is created with placeholder values. Paste the real values there. The project uses **`.env`** (not `.env.local`) by convention.
- `.gitignore` ignores `.env*` but allows `.env.example`.
- Never add the `service_role` key to a `NEXT_PUBLIC_` variable.
- Next.js loads `.env` in every environment (dev, build, start). If someone also creates a `.env.local`, it overrides `.env`, so keep only one.

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
- [ ] **2. Supabase**: browser and server clients, login page (email/password)
- [ ] **3. Route protection**: logged-out users go to `/login`, logged-in users go to the dashboard; logout
- [ ] **4. Roles**: SQL for the `profiles` table (`role` = `teacher` | `student`), reading the role in the app
- [ ] **5. Dashboard layout**: navigation built from a config array (role-aware), logout button
- [ ] **6. Overview page**: different placeholder content for teachers and students
- [ ] **7. README**: install, env vars, Supabase SQL, run locally

---

## Gotchas

- **This is Next.js 16, not the version most examples online use.** Check the bundled docs in `node_modules/next/dist/docs/` before writing Next-specific code (see `AGENTS.md`). In particular, `middleware.ts` is deprecated and renamed to **`proxy.ts`** (export `proxy` instead of `middleware`).
- **`LayoutProps` / `PageProps` are global types that Next generates.** On a fresh clone, `npx tsc --noEmit` fails with "Cannot find name 'LayoutProps'" until `npm run dev`, `npm run build` or `npx next typegen` has run once.
- **`NEXT_PUBLIC_*` values are inlined at build time.** Restart `npm run dev` (or rebuild) after editing `.env`.
- **Supabase key naming.** Supabase now also issues "publishable" keys (`sb_publishable_…`) as the successor to the legacy anon key. Either should work in `NEXT_PUBLIC_SUPABASE_ANON_KEY` (to be confirmed in step 2). The variable name was kept because it is the one requested.
- **`npm audit` reports a moderate advisory** in `minimatch`, pulled in by the ESLint/TypeScript tooling (dev-only, not shipped to the browser). `npm audit fix --force` would downgrade `eslint-config-next` to v15, so don't run it. Wait for an upstream fix instead.
- **`AGENTS.md`**: the block between the `nextjs-agent-rules` markers is rewritten by `next dev`. Put project notes outside that block.
