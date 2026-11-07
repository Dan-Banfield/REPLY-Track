# Logic — Hexagon Stats Backbone

This is the backend that turns **"a user asked the chatbot a question"** into **"their stat on the hexagon went up"**. It is a server-side TypeScript library inside the main app, at `features/logic/stats/`. Each user's stats live in **Supabase**, in the `student_stats` table, one row per user. A row holds the stats as JSON plus a rendered **Markdown** copy: the student's "stats file".

It does **not** contain the chatbot. The chatbot ([`features/chatbot/`](../chatbot/chatbot.md)) calls it once per user question.

Read this together with [`logic.md`](logic.md), which covers auth, roles, Supabase setup, folder conventions and gotchas.

---

## TL;DR for frontend / chatbot agents

```ts
import { getHexagon, recordQuestion } from '@features/logic/stats';

// After every user question to the chatbot (server code only):
const award = await recordQuestion({
  userId,                                                           // from getCurrentUser(), never from the browser
  question: 'Why does proof by induction work?',
  subject: 'maths',                                                 // optional, default "maths"
  classification: { weights: { discrete: 1 }, depth: 'conceptual' }, // optional but recommended (see §5)
});
// award.gains     -> { discrete: 16 }               show "+16 Discrete"
// award.rankUps   -> [{ stat, from, to, title }]    show "Rank up!"
// award.hexagon   -> full radar data                re-render the hexagon

// To draw the hexagon at any time:
const hex = await getHexagon(userId, 'maths');
// hex.axes[i].value is 0..1. Plot it on the i-th vertex (clockwise from the top).
```

From the browser, use the logged-in routes under `/api/stats` (§4), e.g. `fetch('/api/stats/me/hexagon')`. Client components may import **types only**, from `@features/logic/stats/types`; everything else in `features/logic/stats/` is `server-only`.

---

## 1. Setup

It runs as part of the main app (`npm run dev` in the repo root), and it needs:

1. **The SQL**: run every file in `features/logic/migrations/` in the Supabase SQL Editor, in filename order. The stats table comes from `20261107190000_create_student_stats.sql`. All files are safe to re-run.
2. **`SUPABASE_SERVICE_ROLE_KEY` in `.env`**: Supabase → Project Settings → API Keys → the **secret** key (`sb_secret_…`) or the legacy `service_role` key. The server writes stats with it. See `.env.example`.
3. A restart of `npm run dev`.

If the table is missing, every stats call fails with *"Table public.student_stats is missing. Run features/logic/migrations/*.sql…"*.

## 2. Layout

```
features/logic/
├── backend.md                ← this file
├── migrations/20261107190000_create_student_stats.sql   ← table, RLS, is_teacher()
├── supabase/admin.ts         ← createAdminClient(): service_role client (bypasses RLS), server-only
└── stats/
    ├── index.ts              ← PUBLIC API: import from "@features/logic/stats"
    ├── types.ts              ← all shared types (the only file safe to import client-side)
    ├── config.ts             ← balance knobs: XP, ranks, caps
    ├── subjects.ts           ← subject + 6-stat definitions and keywords
    ├── classifier.ts         ← fallback keyword classifier (question → stats + depth)
    ├── engine.ts             ← pure maths: gains, caps, ranks, hexagon view
    ├── markdown.ts           ← the Markdown stats file: render, parse, details
    ├── store.ts              ← Supabase reads/writes, optimistic concurrency
    ├── service.ts            ← high-level operations for server code
    └── api/                  ← Route Handler implementations (+ http.ts: auth & error helpers)

src/app/api/stats/**/route.ts ← one-line re-exports of stats/api/*
```

Data flows in one direction: **server code / route → service → (classifier, engine) → store → Supabase**.

## 3. How the game logic works

### Subjects and stats
A **subject** has exactly **6 stats**, one per hexagon vertex. The MVP has one subject, `maths`:

| # (clockwise from top) | id | label |
|---|---|---|
| 0 | `algebra` | Algebra |
| 1 | `calculus` | Calculus |
| 2 | `geometry` | Geometry |
| 3 | `discrete` | Discrete |
| 4 | `probability` | Probability & Stats |
| 5 | `linear_algebra` | Linear Algebra |

Each stat also comes with a `description` and a suggested `color`. Read them from `listSubjects()` (or `GET /api/stats/subjects`) rather than hardcoding them.

### From question to XP
1. **Classify** the question into:
   - `weights`: which stats it touches, e.g. `{ discrete: 0.7, probability: 0.3 }`.
   - `depth`: `recall | clarify | apply | conceptual`.
   - `quality`: `none | basic | good | excellent`.

   If the caller supplies a `classification`, it is used. Otherwise the keyword classifier is the fallback (§5), and it always counts as `basic` because it can't judge quality.
2. **Normalise weights**: unknown stats are dropped and the rest are scaled to sum to 1. Any stat under 10% is dropped and the remaining weights are re-normalised.
3. **XP pool** = `BASE_XP (10) × depth multiplier × quality multiplier`:

   | depth | multiplier | example |
   |---|---|---|
   | recall | 0.6 | "What is the formula for…" |
   | clarify | 1.0 | "I don't understand what X means" |
   | apply | 1.3 | "How do I solve…" |
   | conceptual | 1.6 | "Why does X work?" |

   | quality | multiplier | XP range |
   |---|---|---|
   | none | 0 | 0 |
   | basic | 0.25 | 2–4 |
   | good | 0.6 | 4–10 |
   | excellent | 1 | 6–16 |

   `none` is final: the keyword classifier can't overrule it. The chatbot's rubric for each rating is in `features/chatbot/scorer.ts`.

4. **Split** the pool across stats by weight, rounding each share (minimum 1 per stat).
5. **Anti-farming rules**:
   - Without a scorer, questions shorter than 8 characters earn nothing. A scorer has read the message, so a short answer like `x = 3` can still earn.
   - A repeat of any of the user's last 50 questions earns nothing. Matching ignores case and punctuation. Answers (`isAnswer`) are exempt, because the same answer can be right for two different problems.
   - Each stat can earn at most **50 XP per UTC day**, shared between questions and any award that sets `respectDailyCap`.
6. **Apply** the XP, recalculate ranks, report rank-ups, and add the question to the activity log.

Every reason XP was reduced or blocked comes back in `notes[]`. Show these to the user, e.g. "Daily cap reached for Discrete".

### Ranks (the Persona-style part)
Each stat climbs its own ladder:

| Rank | Title | Total XP needed |
|---|---|---|
| 1 | Novice | 0 |
| 2 | Apprentice | 40 |
| 3 | Adept | 120 |
| 4 | Expert | 300 |
| 5 | Master | 600 |

A good message earns about 8 XP, so the first rank-up takes about 5 good messages. Rank 5 takes about 75, and at least 12 days because of the daily cap. All of these numbers live in `config.ts`. Ranks are recalculated whenever a profile loads, so changing the thresholds applies to existing users.

**Overall rank** for a subject is the floor of the average of its 6 stat ranks.

### Hexagon values
Each axis has two values:
- `value` (0..1): position along the whole ladder. It is **linear in rank, not XP**, so the shape grows evenly even though later ranks cost more. **Use this for the radar polygon.**
- `progressToNext` (0..1): progress from the current rank to the next. **Use this for progress bars.**

A brand-new user has `value: 0` on every axis. Frontends may want to draw a minimum radius (e.g. `0.05 + 0.95 * value`) so the shape isn't a single point.

## 4. Return values and HTTP API

Server code calls the functions in §6 directly, taking the `userId` from `getCurrentUser()`. A `userId` is a Supabase auth user id (a UUID). Errors are thrown as `StatsError`, which carries an HTTP `status`.

### `recordQuestion()` → `AwardResult`
Only `userId` and `question` are required. The user's stats row is **created automatically** on first use; `displayName` is used only at that point.

```json
{
  "userId": "2b0c…",
  "subject": "maths",
  "classification": {
    "weights": { "discrete": 3 }, "depth": "apply", "source": "keyword",
    "matches": { "discrete": ["permutation", "recurrence", "relation"] }
  },
  "gains": { "discrete": 13 },
  "totalGain": 13,
  "rankUps": [],
  "notes": [],
  "hexagon": { "...": "see HexagonView below" }
}
```
`classification.source` is `"provided"` (your weights were used), `"keyword"` (the fallback classifier) or `"none"` (no stat matched, so no XP was given).

### `getHexagon()` → `HexagonView`
```json
{
  "subject": "maths", "label": "Mathematics",
  "totalXp": 79, "questions": 2, "overallRank": 1,
  "axes": [
    { "id": "algebra", "label": "Algebra", "color": "#e4572e",
      "xp": 0, "rank": 1, "rankTitle": "Novice",
      "value": 0, "progressToNext": 0, "xpForNextRank": 40, "questions": 0 },
    { "id": "discrete", "label": "Discrete", "color": "#669bbc",
      "xp": 63, "rank": 2, "rankTitle": "Apprentice",
      "value": 0.322, "progressToNext": 0.288, "xpForNextRank": 120, "questions": 1 }
  ]
}
```
`axes` always has 6 entries in vertex order. `xpForNextRank` is `null` once the stat is at Master. Users with no stats get zeros.

### `awardXp()`
```ts
await awardXp({ userId, xp: { discrete: 20, algebra: 5 }, reason: 'Completed quiz: Graphs 101', subject: 'maths' });
```
This skips the classifier, duplicate check and daily cap. Set `respectDailyCap: true` to count it against the daily cap instead, as the chatbot's quiz does. Each stat is clamped to **50 XP per call**. It returns an `AwardResult` and is meant for quiz or achievement features.

### `getLeaderboard()`
Ranks users whose `profiles.role` is `student` by total subject XP, or by a single stat's XP if `stat` is given.
```json
[ { "position": 1, "userId": "2b0c…", "displayName": "alice", "score": 63, "rank": 2, "rankTitle": "Apprentice" } ]
```
`rankTitle` is only included when `stat` is set; otherwise `rank` is the overall rank.

### HTTP routes (`/api/stats/*`)
For browser code. Every route needs a logged-in session; the browser sends the Supabase auth cookies automatically.
- Logged out: the proxy answers **401** `{ "error": "Not signed in" }`.
- Other errors: `{ "error": string }` with status 400, 403, 404, 409 or 500.

| Method | Path | Who | Body / query | Returns |
|---|---|---|---|---|
| GET | `/api/stats/subjects` | anyone logged in | | Subject/stat definitions + rank ladder |
| POST | `/api/stats/classify` | anyone logged in | `{ question, subject?, classification? }` | `Classification` (dry run, writes nothing) |
| GET | `/api/stats/me` | self | | `{ userId, displayName, hexagons, activity }` (zeros if no stats) |
| GET | `/api/stats/me/hexagon` | self | `?subject=maths` | `HexagonView` |
| POST | `/api/stats/me/questions` | self | `{ question, subject?, classification? }` | `AwardResult` |
| GET | `/api/stats/students/:userId` | teacher, or self | | stored `UserProfile` + `hexagons` (404 if none) |
| POST | `/api/stats/students/:userId/award` | teacher | `{ xp, reason, subject? }` | `AwardResult` |
| POST | `/api/stats/students/:userId/reset` | teacher | `{ subject? }` | zeroed `HexagonView` (404 if none) |
| GET | `/api/stats/leaderboard` | anyone logged in | `?subject=maths&stat=discrete&limit=10` | `{ entries: LeaderboardEntry[] }` |

The `/me` reads use the user's own Supabase client, so RLS applies. `POST /api/stats/me/questions` exists for convenience, but a student could call it directly with made-up questions (the daily cap limits what that's worth). The chatbot records questions server-side through `features/chatbot/chatRoute.ts` instead, with its scorer's classification.

## 5. Chatbot integration contract

The keyword classifier is a **fallback**. It is fast and free, but it is blunt, so the chatbot sends a classification from its scorer model (`features/chatbot/scorer.ts`). It also sends `quality` and `isAnswer`. The core of the schema looks like this:

```json
{
  "type": "object",
  "properties": {
    "weights": {
      "type": "object",
      "description": "Relevance of the user's question to each stat, 0-1. Omit irrelevant stats.",
      "properties": {
        "algebra": {"type": "number"}, "calculus": {"type": "number"},
        "geometry": {"type": "number"}, "discrete": {"type": "number"},
        "probability": {"type": "number"}, "linear_algebra": {"type": "number"}
      }
    },
    "depth": { "type": "string", "enum": ["recall", "clarify", "apply", "conceptual"] }
  },
  "required": ["weights", "depth"]
}
```
Pass the result as `classification` to `recordQuestion()`. Weights don't need to sum to 1. Invalid stat ids are ignored. If every weight turns out invalid, the engine falls back to keywords. Build the stat list in the schema from `getSubject()` so it stays correct when subjects change.

## 6. Using the library directly (server code)

Everything is exported from `@features/logic/stats` (`features/logic/stats/index.ts`). **These functions don't check permissions.** Authenticate first with `getCurrentUser()` and decide who may act on which `userId`. The handlers in `stats/api/` show the pattern with `requireUser()`, `requireTeacher()` and `requireTeacherOrSelf()`.

| Function | Description |
|---|---|
| `recordQuestion({ userId, question, subject?, classification?, displayName? })` | Main entry point → `AwardResult` |
| `awardXp({ userId, xp, reason, subject?, respectDailyCap? })` | Direct award → `AwardResult` |
| `deductXp({ userId, xp, reason, subject? })` | Takes XP away → what was removed from each stat. A stat can't go below 0, and its rank can drop. |
| `getFeedback(userId, db?)` | → `StudentFeedback`, or `null` before the first finished session |
| `saveFeedback(userId, feedback)` | Replaces the user's running feedback |
| `getUserFile(userId)` | → the whole stats file (Markdown) as text, e.g. for uploading to `student_files` |
| `hexagonFromFile(md, subject?)`, `feedbackFromFile(md)` | → the `HexagonView` or feedback stored in that text |
| `getHexagon(userId, subject?, db?)` | → `HexagonView` (zeros if no stats) |
| `getAllHexagons(userId, db?)` / `hexagonsFor(profile \| null)` | → `HexagonView[]` for every subject |
| `getUser(userId, db?)` | → `UserProfile` (throws 404 `StatsError`) |
| `upsertUser(userId, displayName?)` | → `UserProfile` |
| `resetSubject(userId, subject?)` | → `HexagonView` |
| `getLeaderboard({ subject?, stat?, limit? })` | → `LeaderboardEntry[]` |
| `resolveClassification(subject, question, provided?)` | → `Classification` (no writes) |
| `renderUserMarkdown(profile)`, `parseUserMarkdown(md)`, `userFileDetails(md)` | The stats file: render, read back, stats/activity sections only |
| `listSubjects()`, `getSubject(id)`, `SUBJECTS` | Subject definitions |

`db` is an optional Supabase client for reads. Pass the user's own client (`await createClient()` from `@features/logic/supabase/server`) to have RLS decide what they may read. It defaults to the admin client. Writes always use the admin client.

The stats modules talk to Supabase with the secret key, so **never import `@features/logic/stats` into a client component** (`server-only` makes that a build error). Client code may import types only, from `@features/logic/stats/types`.

## 7. Storage (Supabase `public.student_stats`)

| Column | Type | Meaning |
|---|---|---|
| `user_id` | uuid PK → `auth.users(id)`, cascade delete | Whose stats |
| `data` | jsonb | `UserProfile` (see `types.ts`). **Source of truth.** |
| `markdown` | text | The stats file (format below), regenerated on every save |
| `version` | int | Optimistic-concurrency counter |
| `updated_at` | timestamptz | Last save |

The stats file (view it in Table Editor, or `select markdown from student_stats where user_id = '…'`):

```markdown
---
{ "schemaVersion": 1, "userId": "…", "displayName": "alice",
  "subjects": { "maths": { "stats": { "discrete": { "xp": 63, "rank": 2, "questions": 1 }, ... },
                           "totalXp": 79, "questions": 2, "daily": {...}, "recentQuestionHashes": [...] } },
  "activity": [ ... ], "feedback": { ... } }
---

# alice — Learning Stats
## Feedback
Running note on the student, rewritten after each session.
## Mathematics
| Stat | Rank | Title | XP | Next rank at | Progress |
| Discrete | 2 | Apprentice | 63 | 120 | ███░░░░░░░ |
...
## Recent activity
- 2026-11-07 12:54 · maths · conceptual · +11 linear_algebra, +5 probability — "Explain eigenvalues…"
```

- The JSON frontmatter mirrors `data`. JSON is valid YAML, so any frontmatter parser can read it. The body is a human-readable summary.
- When a student finishes a session, the chatbot copies this file into `student_files`, and teachers read that copy on the Students page (see [`teacher.md`](../teacher/teacher.md)). It holds up to 200 characters of each logged message, so anything in the activity log is visible to teachers.
- The activity log keeps the last 50 entries. Daily-cap bookkeeping keeps 7 days. The duplicate check remembers the last 50 question hashes.

**Access (RLS):**

| Who | Access |
|---|---|
| Logged-in user | `select` their own row |
| Teacher (`public.is_teacher()`) | `select` every row |
| `anon` | nothing |
| Server (`service_role` via `createAdminClient()`) | everything. **All writes go through it**, so students can't edit their own XP through the public API. |

**Concurrency:** `mutateUser()` in `store.ts` reads the row and its `version`, applies the change, then saves with `update … where version = <read version>`. If another request saved first, it re-reads and retries, up to 25 times. A new row uses `insert`, and a duplicate-key error triggers a retry. This works across server instances, unlike an in-memory lock. The function passed to `mutateUser()` can run more than once, so it must only change the profile it is given.

## 8. Extending

- **New subject**: add an entry to `SUBJECTS` in `subjects.ts` with exactly 6 stats, each with keywords. Nothing else needs to change, including the database (it lives in `data`). Existing users get the subject the first time they earn XP in it.
- **New stat on an existing subject**: it is filled in with zeros when old profiles load. Keep exactly 6 stats per subject or the hexagon breaks.
- **Balance**: everything is in `config.ts`, including thresholds, titles, multipliers and caps.
- **Better classification**: replace or extend `classifier.ts`, or rely on the chatbot's classification (§5).
- **Schema changes**: add a **new** migration file. Never edit one that has already been run (see the conventions in logic.md).

## 9. Known limitations / TODO

- **No authentication of its own.** Functions trust the `userId` they are given. Always pass the ID from `getCurrentUser()`; the `/api/stats` handlers do.
- **Two copies of the stats file.** `student_stats` is live; `student_files` is a snapshot taken at the end of each session for the Students page. The Students page could read `student_stats` directly and the copy could go.
- The leaderboard reads every stats row on each request. That's fine for a class; for more users, move it into a SQL view or RPC.
- Display names default to the user id unless the caller passes `displayName` on first save. A name field on `profiles` would be better.
- The keyword classifier misses some cases: "series" counts as calculus even when it means something else, and short keywords like `set` or `graph` can match casual wording.
- No unit tests yet. `engine.ts` is pure and the obvious place to start. The SQL and RLS were tested in PGlite (see logic.md).
