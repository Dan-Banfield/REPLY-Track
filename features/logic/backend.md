# Logic — Hexagon Stats Backbone

This is the backend that turns **"a user asked the chatbot a question"** into **"their stat on the hexagon went up"**. It is a self-contained Next.js 16 (App Router, TypeScript) project. It has no database: every user's stats live in their own Markdown file.

It does **not** contain the chatbot. The chatbot (or whatever sits in front of it) calls this backend once per user question.

---

## TL;DR for frontend / chatbot agents

```ts
// After every user question to the chatbot:
const res = await fetch(`/api/users/${userId}/questions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    question: "Why does proof by induction work?",
    subject: "maths",                                              // optional, default "maths"
    classification: { weights: { discrete: 1 }, depth: "conceptual" } // optional but recommended (see §5)
  }),
});
const award = await res.json();
// award.gains     -> { discrete: 16 }               show "+16 Discrete" toast
// award.rankUps   -> [{ stat, from, to, title }]    show a "Rank up!" animation
// award.hexagon   -> full radar data                re-render the hexagon
```

```ts
// To draw the hexagon at any time:
const hex = await fetch(`/api/users/${userId}/hexagon?subject=maths`).then(r => r.json());
// hex.axes[i].value is 0..1. Plot it on the i-th vertex (clockwise from the top).
```

---

## 1. Running it

```bash
cd features/logic
npm install
npm run dev          # http://localhost:3000
npm run build        # type-check + production build
```

| Env var | Default | Purpose |
|---|---|---|
| `STATS_DATA_DIR` | `./data/users` | Folder where the per-user `.md` files are stored |

To merge this into a shared Next.js app, copy `src/lib/stats/`, `src/lib/http.ts` and `src/app/api/`. The `@/*` path alias must map to `src/*`.

## 2. Layout

```
features/logic/
├── logic.md                    ← this file
├── data/users/<userId>.md      ← one stats file per user (gitignored runtime data)
└── src/
    ├── lib/
    │   ├── http.ts             ← route helpers (error → JSON mapping)
    │   └── stats/
    │       ├── index.ts        ← PUBLIC API: import from "@/lib/stats"
    │       ├── types.ts        ← all shared types (safe to import client-side)
    │       ├── config.ts       ← balance knobs: XP, ranks, caps
    │       ├── subjects.ts     ← subject + 6-stat definitions and keywords
    │       ├── classifier.ts   ← fallback keyword classifier (question → stats + depth)
    │       ├── engine.ts       ← pure maths: gains, caps, ranks, hexagon view
    │       ├── store.ts        ← Markdown file read/write, per-user lock
    │       └── service.ts      ← high-level operations used by routes
    └── app/api/...             ← HTTP routes (see §4)
```

Data flows in one direction: **route → service → (classifier, engine) → store**.

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

Each stat also comes with a `description` and a suggested `color`. Fetch them from `GET /api/subjects` rather than hardcoding them.

### From question to XP
1. **Classify** the question into:
   - `weights`: which stats it touches, e.g. `{ discrete: 0.7, probability: 0.3 }`.
   - `depth`: `recall | clarify | apply | conceptual`.

   If the caller supplies a `classification`, it is used. Otherwise the keyword classifier is the fallback (§5).
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
6. **Apply** the XP, recalculate ranks, report rank-ups, and append the question to the activity log.

Every reason XP was reduced or blocked comes back in `notes[]`. Show these to the user, e.g. "Daily cap reached for Discrete".

### Ranks (the Persona-style part)
Each stat climbs its own ladder:

| Rank | Title | Total XP needed |
|---|---|---|
| 1 | Novice | 0 |
| 2 | Apprentice | 30 |
| 3 | Adept | 80 |
| 4 | Expert | 160 |
| 5 | Master | 280 |

A conceptual question aimed at a single stat earns 16 XP, so the first rank-up comes after about 2 questions. Rank 5 takes about 18 questions, or a few days because of the daily cap. All of these numbers live in `config.ts`.

**Overall rank** for a subject is the floor of the average of its 6 stat ranks.

### Hexagon values
Each axis has two values:
- `value` (0..1): position along the whole ladder. It is **linear in rank, not XP**, so the shape grows evenly even though later ranks cost more. **Use this for the radar polygon.**
- `progressToNext` (0..1): progress from the current rank to the next. **Use this for progress bars.**

A brand-new user has `value: 0` on every axis. Frontends may want to draw a minimum radius (e.g. `0.05 + 0.95 * value`) so the shape isn't a single point.

## 4. HTTP API

All bodies are JSON. Errors are returned as `{ "error": string }` with status 400, 404 or 500.
A `userId` is 1–64 characters from `[A-Za-z0-9_-]`. There is **no auth yet**: whoever knows a userId can write to it.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/subjects` | Subject/stat definitions + rank ladder |
| POST | `/api/classify` | Dry-run classification (writes nothing) |
| PUT | `/api/users/:userId` | Create user / set display name (idempotent) |
| GET | `/api/users/:userId` | Profile + activity + all hexagons (404 if unknown) |
| GET | `/api/users/:userId/hexagon?subject=maths` | Radar data for one subject (zeros if unknown user) |
| POST | `/api/users/:userId/questions` | **Record a question → award XP** |
| POST | `/api/users/:userId/award` | Direct XP award (quizzes, bonuses) |
| POST | `/api/users/:userId/reset` | Wipe progress in a subject |
| GET | `/api/leaderboard?subject=maths&stat=discrete&limit=10` | Leaderboard |

### `POST /api/users/:userId/questions`
Request:
```json
{
  "question": "How do I count permutations with a recurrence relation?",
  "subject": "maths",
  "displayName": "Alice",
  "classification": { "weights": { "discrete": 1 }, "depth": "apply" }
}
```
Only `question` is required. A user who doesn't exist yet is **created automatically**; `displayName` is used only at that point.

Response (`AwardResult`):
```json
{
  "userId": "alice",
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

### `GET /api/users/:userId/hexagon` → `HexagonView`
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
`axes` always has 6 entries in vertex order. `xpForNextRank` is `null` once the stat is at Master.

### `POST /api/users/:userId/award`
```json
{ "xp": { "discrete": 20, "algebra": 5 }, "reason": "Completed quiz: Graphs 101", "subject": "maths" }
```
This skips the classifier, duplicate check and daily cap. Each stat is clamped to **50 XP per call**. It returns an `AwardResult` and is meant for quiz or achievement features.

### `POST /api/classify`
```json
{ "question": "Why does induction work on graphs?", "subject": "maths" }
```
→ `{ "weights": { "discrete": 4 }, "depth": "conceptual", "source": "keyword", "matches": {...} }`

### `GET /api/leaderboard`
Ranks users by total subject XP, or by a single stat's XP if `stat` is given.
```json
{ "entries": [ { "position": 1, "userId": "alice", "displayName": "Alice", "score": 63, "rank": 2, "rankTitle": "Apprentice" } ] }
```
`rankTitle` is only included when `stat` is set; otherwise `rank` is the overall rank.

## 5. Chatbot integration contract

The keyword classifier is a **fallback**. It is fast and free, but it is blunt. The chatbot already understands the question, so it should send a classification. Suggested addition to the LLM's tool or structured-output schema:

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
Pass the result as `classification` in `POST /questions`. Weights don't need to sum to 1. Invalid stat ids are ignored. If every weight turns out invalid, the backend falls back to keywords. Build the stat list in the schema from `GET /api/subjects` so it stays correct when subjects change.

If the chatbot is a Next.js route in the same app, skip HTTP and call the library directly (server-side only):
```ts
import { recordQuestion } from "@/lib/stats";
const award = await recordQuestion({ userId, question, classification });
```

## 6. Using the library directly (server code)

Everything is exported from `@/lib/stats` (`src/lib/stats/index.ts`):

| Function | Description |
|---|---|
| `recordQuestion({ userId, question, subject?, classification?, displayName? })` | Main entry point → `AwardResult` |
| `awardXp({ userId, xp, reason, subject? })` | Direct award → `AwardResult` |
| `getHexagon(userId, subject?)` | → `HexagonView` |
| `getAllHexagons(userId)` | → `HexagonView[]` |
| `getUser(userId)` | → `UserProfile` (throws 404 `StatsError`) |
| `upsertUser(userId, displayName?)` | → `UserProfile` |
| `resetSubject(userId, subject?)` | → `HexagonView` |
| `getLeaderboard({ subject?, stat?, limit? })` | → `LeaderboardEntry[]` |
| `resolveClassification(subject, question, provided?)` | → `Classification` (no writes) |
| `listSubjects()`, `getSubject(id)`, `SUBJECTS` | Subject definitions |

`StatsError` carries an HTTP `status`. Wrap route handlers with `handle()` from `src/lib/http.ts` to map it automatically.

The stats modules use `node:fs`, so **never import `@/lib/stats` into a client component**. Client code may import types only, from `@/lib/stats/types`.

## 7. Storage format (`data/users/<userId>.md`)

```markdown
---
{ "schemaVersion": 1, "userId": "alice", "displayName": "Alice",
  "subjects": { "maths": { "stats": { "discrete": { "xp": 63, "rank": 2, "questions": 1 }, ... },
                           "totalXp": 79, "questions": 2, "daily": {...}, "recentQuestionHashes": [...] } },
  "activity": [ ... ] }
---

# Alice — Learning Stats
## Mathematics
| Stat | Rank | Title | XP | Next rank at | Progress |
| Discrete | 2 | Apprentice | 63 | 80 | ███████░░░ |
...
## Recent activity
- 2026-11-07 12:54 · maths · conceptual · +11 linear_algebra, +5 probability — "Explain eigenvalues…"
```

- The **JSON frontmatter is the source of truth**. JSON is valid YAML, so any frontmatter parser can read it.
- The body below it is a human-readable summary that is **rewritten on every save**. Edits to the body are lost; edit the JSON instead.
- Writes are atomic: the file is written to a temp file and then renamed over the original.
- Read-modify-write cycles are serialised per user by an in-process lock. A test with 20 parallel requests lost no updates.
- The activity log keeps the last 50 entries. Daily-cap bookkeeping keeps 7 days.

## 8. Extending

- **New subject**: add an entry to `SUBJECTS` in `subjects.ts` with exactly 6 stats, each with keywords. Nothing else needs to change. Existing users get the new subject the first time they earn XP in it.
- **New stat on an existing subject**: it is filled in with zeros when old files load. Keep exactly 6 stats per subject or the hexagon breaks.
- **Balance**: everything is in `config.ts`, including thresholds, titles, multipliers and caps.
- **Better classification**: replace or extend `classifier.ts`, or rely on the chatbot's classification (§5).

## 9. Known limitations / TODO

- **No authentication.** `userId` comes from the URL. Add session auth before anything public.
- **File storage only works on one long-running Node server** (`next dev` / `next start`). On serverless hosts such as Vercel the filesystem is read-only or ephemeral, and the lock only covers a single process. Before deploying, swap `store.ts` for a database or KV store. Its 3 functions (`readUser`, `writeUser`, `listUserIds`) are the whole storage interface.
- The leaderboard reads every user file on each request. That is fine for a demo but won't scale.
- The keyword classifier misses some cases: "series" counts as calculus even when it means something else, and short keywords like `set` or `graph` can match casual wording.
- No tests yet. `engine.ts` is pure and the obvious place to add unit tests.