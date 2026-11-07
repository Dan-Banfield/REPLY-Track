# Backend — Hexagon Stats

This is the backend that turns **"a student asked the chatbot a question"** into **"their stat on the hexagon went up"**. Each user's stats are stored in **Supabase**, in a `student_stats` table with one row per user. A row holds the stats as JSON plus a rendered **Markdown** copy (the student's "stats file").

It does **not** contain the chatbot. The chatbot calls `recordQuestion()` (or the HTTP route) once per student question.

Read this together with [`logic.md`](logic.md), which covers auth, roles, Supabase setup, folder conventions and gotchas.

---

## TL;DR for frontend / chatbot agents

**From the chatbot's server code** (preferred: no HTTP round trip, and the browser can't fake it):

```ts
import { getCurrentUser } from '@features/logic/auth/session';
import { recordQuestion } from '@features/logic/stats';

const user = await getCurrentUser();
const award = await recordQuestion({
  userId: user.id,
  question: 'Why does proof by induction work?',
  classification: { weights: { discrete: 1 }, depth: 'conceptual' }, // from the LLM, see §5
  displayName: user.email.split('@')[0],                            // only used on first save
});
// award.gains   -> { discrete: 16 }              show "+16 Discrete"
// award.rankUps -> [{ stat, from, to, title }]   show a "Rank up!" animation
// award.hexagon -> full radar data               re-render the hexagon
```

**From the browser** (the session cookie authenticates the request):

```ts
const hex = await fetch('/api/stats/me/hexagon?subject=maths').then((r) => r.json());
// hex.axes[i].value is 0..1. Plot it on the i-th vertex (clockwise from the top).

await fetch('/api/stats/me/questions', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ question: 'How do I find eigenvalues?' }),
});
```

Client components may import **types only**, from `@features/logic/stats/types`. Everything else in `features/logic/stats/` is `server-only`.

---

## 1. Setup

1. Run the SQL in `features/logic/migrations/` in the Supabase SQL Editor, in filename order. The stats table comes from `20261107180000_create_student_stats.sql`, which needs `profiles` from the earlier file. Both are safe to re-run.
2. Put the secret key in `.env` as `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API Keys → **secret** key `sb_secret_…`, or the legacy `service_role` key). The server writes stats with it. See `.env.example`.
3. Restart `npm run dev`.

If the table is missing, every stats call fails with *"Table public.student_stats is missing. Run features/logic/migrations/*.sql…"*.

## 2. Layout

```
features/logic/
├── backend.md                ← this file
├── migrations/20261107180000_create_student_stats.sql   ← table, RLS, is_teacher()
├── supabase/admin.ts         ← createAdminClient(): service_role client (bypasses RLS), server-only
└── stats/
    ├── index.ts              ← PUBLIC API: import from "@features/logic/stats"
    ├── types.ts              ← all shared types (the only file safe to import client-side)
    ├── config.ts             ← balance knobs: XP, ranks, caps
    ├── subjects.ts           ← subject + 6-stat definitions and keywords
    ├── classifier.ts         ← fallback keyword classifier (question → stats + depth)
    ├── engine.ts             ← pure maths: gains, caps, ranks, hexagon view
    ├── markdown.ts           ← renders a profile as the Markdown "stats file"
    ├── store.ts              ← Supabase reads/writes, optimistic concurrency
    ├── service.ts            ← high-level operations (recordQuestion, awardXp, …)
    └── api/                  ← Route Handler implementations (+ http.ts: auth & error helpers)

src/app/api/stats/**/route.ts ← one-line re-exports of stats/api/*
```

Data flows in one direction: **route → service → (classifier, engine) → store → Supabase**.

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

Each stat also has a `description` and a suggested `color`. Get them from `GET /api/stats/subjects` rather than hardcoding them.

### From question to XP
1. **Classify** the question into:
   - `weights`: which stats it touches, e.g. `{ discrete: 0.7, probability: 0.3 }`.
   - `depth`: `recall | clarify | apply | conceptual`.

   A `classification` sent by the caller is used if valid. Otherwise the keyword classifier is the fallback (§5).
2. **Normalise weights**: unknown stats are dropped and the rest are scaled to sum to 1. Any stat under 10% is dropped and the remaining weights are re-normalised.
3. **XP pool** = `BASE_XP (10) × depth multiplier`:

   | depth | multiplier | example |
   |---|---|---|
   | recall | 0.6 | "What is the formula for…" |
   | clarify | 1.0 | "I don't understand what X means" |
   | apply | 1.3 | "How do I solve…" |
   | conceptual | 1.6 | "Why does X work?" |

4. **Split** the pool across stats by weight, rounding each share (minimum 1 per stat).
5. **Anti-farming rules**:
   - Questions shorter than 8 characters earn nothing.
   - A repeat of any of the user's last 50 questions earns nothing. Matching ignores case and punctuation.
   - Each stat can earn at most **60 XP per UTC day** from questions.
6. **Apply** the XP, recalculate ranks, report rank-ups, and add the question to the activity log.

Every reason XP was reduced or blocked comes back in `notes[]`. Show these to the user.

### Ranks (the Persona-style part)

| Rank | Title | Total XP needed |
|---|---|---|
| 1 | Novice | 0 |
| 2 | Apprentice | 30 |
| 3 | Adept | 80 |
| 4 | Expert | 160 |
| 5 | Master | 280 |

**Overall rank** for a subject is the floor of the average of its 6 stat ranks. All numbers live in `config.ts`.

### Hexagon values
- `value` (0..1): position along the whole ladder, **linear in rank, not XP**, so the shape grows evenly. **Use it for the radar polygon.**
- `progressToNext` (0..1): progress to the next rank. **Use it for progress bars.**

A new user has `value: 0` everywhere. Consider drawing a minimum radius (e.g. `0.05 + 0.95 * value`).

## 4. HTTP API

All routes need a logged-in session. The browser sends the Supabase auth cookies automatically.
- Logged out: the proxy answers **401** `{ "error": "Not signed in" }`.
- Other errors: `{ "error": string }` with status 400, 403, 404, 409 or 500.

User ids are Supabase auth user ids (UUIDs).

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/stats/subjects` | anyone logged in | Subject/stat definitions + rank ladder |
| POST | `/api/stats/classify` | anyone logged in | Dry-run classification (writes nothing) |
| GET | `/api/stats/me` | self | All hexagons + recent activity (zeros if no stats yet) |
| GET | `/api/stats/me/hexagon?subject=maths` | self | Radar data for one subject |
| POST | `/api/stats/me/questions` | self | **Record a question → award XP** |
| GET | `/api/stats/students/:userId` | teacher, or self | Full stored profile + `hexagons` (404 if no stats) |
| POST | `/api/stats/students/:userId/award` | teacher | Direct XP award (quizzes, bonuses) |
| POST | `/api/stats/students/:userId/reset` | teacher | Wipe progress in a subject |
| GET | `/api/stats/leaderboard?subject=maths&stat=discrete&limit=10` | anyone logged in | Leaderboard (students only) |

### `POST /api/stats/me/questions`
```json
{
  "question": "How do I count permutations with a recurrence relation?",
  "subject": "maths",
  "classification": { "weights": { "discrete": 1 }, "depth": "apply" }
}
```
Only `question` is required. The first call creates the user's stats row, with the part of their email before `@` as display name.

Response (`AwardResult`):
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
  "hexagon": { "...": "HexagonView" }
}
```
`classification.source` is `"provided"` (your weights were used), `"keyword"` (the fallback) or `"none"` (no stat matched, so no XP).

### `GET /api/stats/me/hexagon` → `HexagonView`
```json
{
  "subject": "maths", "label": "Mathematics",
  "totalXp": 79, "questions": 2, "overallRank": 1,
  "axes": [
    { "id": "algebra", "label": "Algebra", "color": "#e4572e",
      "xp": 0, "rank": 1, "rankTitle": "Novice",
      "value": 0, "progressToNext": 0, "xpForNextRank": 30, "questions": 0 },
    { "id": "discrete", "label": "Discrete", "color": "#669bbc",
      "xp": 63, "rank": 2, "rankTitle": "Apprentice",
      "value": 0.415, "progressToNext": 0.66, "xpForNextRank": 80, "questions": 1 }
  ]
}
```
`axes` always has 6 entries in vertex order. `xpForNextRank` is `null` at Master.

### `GET /api/stats/me`
```json
{ "userId": "…", "displayName": "alice", "hexagons": [HexagonView, …], "activity": [ActivityEntry, …] }
```
`displayName` is `null` until the user's first recorded question.

### `POST /api/stats/students/:userId/award` (teachers)
```json
{ "xp": { "discrete": 20, "algebra": 5 }, "reason": "Completed quiz: Graphs 101", "subject": "maths" }
```
This skips the classifier, duplicate check and daily cap. Each stat is clamped to **50 XP per call**. Returns an `AwardResult`. The student's stats row is created if needed.

### `POST /api/stats/students/:userId/reset` (teachers)
Body `{ "subject": "maths" }` (optional, defaults to maths). Returns the zeroed `HexagonView`, or 404 if the student has no stats.

### `GET /api/stats/leaderboard`
Ranks users whose `profiles.role` is `student` by total subject XP, or by one stat's XP if `stat` is given.
```json
{ "entries": [ { "position": 1, "userId": "…", "displayName": "alice", "score": 63, "rank": 2, "rankTitle": "Apprentice" } ] }
```
`rankTitle` is only included when `stat` is set; otherwise `rank` is the overall rank.

## 5. Chatbot integration contract

The keyword classifier is a **fallback**: fast and free, but blunt. The chatbot understands the question, so it should send a classification. Suggested structured-output schema for the LLM:

```json
{
  "type": "object",
  "properties": {
    "weights": {
      "type": "object",
      "description": "Relevance of the student's question to each stat, 0-1. Omit irrelevant stats.",
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

Pass the result as `classification`. Weights don't need to sum to 1. Invalid stat ids are ignored. If every weight is invalid, the backend falls back to keywords. Build the stat list from `SUBJECTS` / `GET /api/stats/subjects` so it stays correct when subjects change.

**Call `recordQuestion()` from the chatbot's Server Action or Route Handler**, with `userId` from `getCurrentUser()`. Never take the userId from the request body. The HTTP route `/api/stats/me/questions` exists for convenience, but a student could call it directly with made-up questions. The anti-farming caps limit how much that is worth.

## 6. Library reference (server code)

Everything is exported from `@features/logic/stats`. **These functions don't check permissions.** Authenticate first with `getCurrentUser()` and decide who may act on which `userId`. The handlers in `stats/api/` show the pattern via `requireUser()`, `requireTeacher()` and `requireTeacherOrSelf()`.

| Function | Description |
|---|---|
| `recordQuestion({ userId, question, subject?, classification?, displayName? })` | Main entry point → `AwardResult` |
| `awardXp({ userId, xp, reason, subject? })` | Direct award → `AwardResult` |
| `getHexagon(userId, subject?, db?)` | → `HexagonView` (zeros if no stats) |
| `getUser(userId, db?)` | → `UserProfile` (404 `StatsError` if no stats) |
| `hexagonsFor(profile \| null)` | → `HexagonView[]` for every subject |
| `resetSubject(userId, subject?)` | → `HexagonView` |
| `getLeaderboard({ subject?, stat?, limit? })` | → `LeaderboardEntry[]` |
| `resolveClassification(subject, question, provided?)` | → `Classification` (no writes) |
| `renderUserMarkdown(profile)` | → the Markdown stats file |
| `listSubjects()`, `getSubject(id)`, `SUBJECTS` | Subject definitions |

`db` is an optional Supabase client for reads. Pass the user's own client (`await createClient()` from `@features/logic/supabase/server`) to have RLS enforce what they may read. It defaults to the admin client. Writes always use the admin client.

`StatsError` carries an HTTP `status`. `handle()` in `stats/api/http.ts` maps it to a JSON response and re-throws Next's redirect errors.

## 7. Storage (Supabase `public.student_stats`)

| Column | Type | Meaning |
|---|---|---|
| `user_id` | uuid PK → `auth.users(id)`, cascade delete | Whose stats |
| `data` | jsonb | `UserProfile` (see `types.ts`). **Source of truth.** |
| `markdown` | text | The same profile as a Markdown document, regenerated on every save (format below). Never parsed back. |
| `version` | int | Optimistic-concurrency counter |
| `updated_at` | timestamptz | Last save |

Markdown format (view it in Table Editor, or `select markdown from student_stats where user_id = '…'`):

```markdown
---
{ "schemaVersion": 1, "userId": "…", "displayName": "alice", "subjects": { "maths": { … } }, "activity": [ … ] }
---

# alice — Learning Stats
## Mathematics
| Stat | Rank | Title | XP | Next rank at | Progress |
| Discrete | 2 | Apprentice | 63 | 80 | ███████░░░ |
## Recent activity
- 2026-11-07 12:54 · maths · conceptual · +11 linear_algebra, +5 probability — "Explain eigenvalues…"
```

**Access (RLS):**

| Who | Access |
|---|---|
| Logged-in user | `select` their own row |
| Teacher (`public.is_teacher()`) | `select` every row |
| `anon` | nothing |
| Server (`service_role` via `createAdminClient()`) | everything. **All writes go through it**, so students can't edit their own XP through the public API. |

**Concurrency:** `mutateUser()` in `store.ts` reads the row and its `version`, applies the change, then saves with `update … where version = <read version>`. If another request saved first, it re-reads and retries, up to 25 times. A new row uses `insert`, and a duplicate-key error triggers a retry. This works across serverless instances, unlike an in-memory lock.

The activity log keeps the last 50 entries. Daily-cap bookkeeping keeps 7 days. The duplicate check remembers the last 50 question hashes.

## 8. Extending

- **New subject**: add an entry to `SUBJECTS` in `subjects.ts` with exactly 6 stats and keywords. Users get the subject the first time they earn XP in it. No migration is needed, because it lives in `data`.
- **New stat on an existing subject**: it's filled with zeros when old rows load. Keep exactly 6 per subject.
- **Balance**: everything is in `config.ts`.
- **Schema changes**: add a **new** migration file. Never edit one that has already been run (see logic.md conventions).

## 9. Known limitations / TODO

- Display names come from the email address (the part before `@`), set when the stats row is created. A proper name field on `profiles` would be better.
- The leaderboard loads every stats row. That's fine for a class; for more users, move it into a SQL view or RPC that reads `data->'subjects'->'maths'->>'totalXp'`.
- Students can call `/api/stats/me/questions` directly. Prefer server-side `recordQuestion()` from the chatbot.
- The keyword classifier is blunt: short keywords like `set` or `graph` can match casual wording.
- No unit tests yet. `engine.ts` is pure and the obvious place to start. The SQL and RLS were tested in PGlite (see logic.md).
