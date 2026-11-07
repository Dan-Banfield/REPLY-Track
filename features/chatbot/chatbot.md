# Chatbot

Students open **Study** in the rail and chat with an AI maths tutor, earning XP for their questions. A second model scores each question, and a short quiz at the end earns bonus XP. The XP rules live in the stats engine, documented in [`backend.md`](../logic/backend.md). The student's stats appear on the Overview page, not here.

_Status: MVP. Tested in Chrome with the real OpenAI API and a local mock of Supabase. A typical exchange takes 4–6 seconds: the first words appear after about 1 second, and scoring adds about 2 seconds after the reply._

---

## Setup

Add your OpenAI key to `.env`, then restart `npm run dev`:

```dotenv
OPENAI_API_KEY=your-openai-key
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | none, required | Server-only. Never give it a `NEXT_PUBLIC_` name. |
| `OPENAI_TUTOR_MODEL` | `gpt-6.1-sol` | The model that talks to the student |
| `OPENAI_SCORER_MODEL` | `gpt-6-luna` | The cheaper model that scores questions and writes quizzes |

Without a key, pages still load, but sending a message shows "Something went wrong".

## How a session works

```
/dashboard/session (students only, "Study" in the rail)
  First message ──── startSession(), then POST /api/chat
  Each message ───── POST /api/chat
     1. Tutor reply streams to the browser           tutor.ts
     2. Scorer rates the question: stats and depth   scorer.ts
     3. recordQuestion() adds XP                     features/logic/stats
     4. Exchange saved, XP sent back                 sessions.ts
  End & take quiz ── endSession()
     5. Quiz written from the transcript             quiz.ts
  Submit answers ─── submitQuiz()
     6. Marked on the server, awardXp() adds XP      quiz.ts, actions.ts
     7. Summary shown, session closed
     8. Afterwards: feedback rewritten in the student's
        stats file, and that file uploaded for teachers  feedback.ts, actions.ts
```

- **One open session per student.** It survives a reload, and `findOpenSession()` picks it back up, including mid-quiz.
- **If the scorer fails,** `recordQuestion()` falls back to its keyword classifier, which counts everything as `basic`.
- **If the tutor fails,** nothing is saved. The question goes back into the message box to retry.
- **Quiz answers stay on the server.** `toClientSession()` strips `answerIndex` before anything reaches the browser.

## How scoring works

The scorer (`scorer.ts`) decides what each message is, then rates it. XP is `10 × depth × quality`, split across the stats it touches. The numbers are in `features/logic/stats/config.ts`.

| Rating | Multiplier | An answer to the tutor | A question |
| --- | --- | --- | --- |
| `none` | 0 | Wrong final answer, however close. A guess. Copying what the tutor just said. | "I don't get it", "explain more", "idk", or only wanting the answer. Also greetings, thanks and anything off-topic. |
| `basic` | 0.25 | A correct step, when they say they haven't finished | Names a topic or asks for a fact, with no thinking of their own |
| `good` | 0.6 | Correct | A specific question that pinpoints what they want to understand |
| `excellent` | 1 | Correct, with their reasoning explained | Shows their own thinking: what they tried, or a connection they noticed |

- **It sees context.** The scorer gets the message, the tutor's reply and the last 6 messages. So "why does that work?" can be scored, and "54" is judged against what the tutor asked.
- **Answers are checked.** The scorer works the answer out itself as well as reading the tutor's response.
- **Short and repeated answers can earn.** A repeated question earns nothing, but the same answer can be right for two problems.
- **Passing the quiz** (2 of 3 or better) earns 5 XP per correct answer. Quiz XP counts towards the daily cap.
- **Failing the quiz** takes back half the XP each stat earned in that session, rounded up. A stat can't go below 0, and a rank can drop. Older XP isn't touched, and the daily cap isn't given back. The numbers are `PASS_MARK`, `XP_PER_CORRECT_ANSWER` and `FAILED_QUIZ_XP_LOSS` in `quiz.ts`.
- **The penalty can be dodged** by never ending a session, because chat XP lands straight away. An automatic end to idle sessions would close this.
- **The daily cap is 50 XP per stat,** and it isn't shown to the student. If correct answers suddenly stop earning, check the `daily` figures in `data/users/<userId>.md`.
- **To review a rating,** read `reason` on the message in the session file. It is saved but not shown.

**After changing the rubric,** re-test it against real replies. Check that wrong answers earn nothing and that correct ones still earn something: tightening one rule easily breaks the other.

## The chat screen

It follows the familiar AI chat layout:

- **Full height.** `.screen` cancels the dashboard's padding and fills the window. Only the thread scrolls, and the message box stays pinned to the bottom.
- **Centred column,** 768px at most. The scrolling area itself spans the full width, so its scrollbar sits at the window edge.
- **Empty state:** the greeting, message box and starter prompts sit in the middle of the screen. The first message moves the box to the bottom and starts the session.
- **Messages:** the student's text is in a right-aligned bubble. The tutor's text has no bubble.
- **While waiting:** a pulsing dot until the first words arrive, then "Scoring your question…" until the XP lands. Sending is blocked until then, because the server saves the whole exchange at the end.
- **XP** appears as a pill under the reply.
- **Message box:** Enter sends, Shift+Enter adds a line, and it grows up to 200px.
- **Scrolling:** the thread follows new text, unless the student has scrolled up.

Tutor replies are Markdown with LaTeX, rendered by `features/ux/markdown/Markdown.tsx`. Quiz questions stay plain text with Unicode maths, because they sit in form labels.

## Files

| File | What it does |
| --- | --- |
| `SessionPage.tsx` | Page for `/dashboard/session`. Checks the role and loads any open session and the stat labels. |
| `SessionChat.tsx` | Client component for the whole screen: chat, quiz and summary. |
| `Composer.tsx` | The message box. |
| `QuizForm.tsx` | The quiz: one radio group per question. |
| `chatRoute.ts` | `POST /api/chat`: runs one exchange and streams the result. |
| `actions.ts` | Server Actions `startSession`, `endSession`, `submitQuiz`. |
| `tutor.ts` | Tutor instructions and the streaming call. |
| `scorer.ts` | Scorer instructions and JSON schema. Returns `{ weights, depth }` for `recordQuestion()`. |
| `quiz.ts` | Writes and marks the quiz. |
| `feedback.ts` | Rewrites the student's running feedback after a session. The student and their teacher both read it. |
| `sessions.ts` | Session types, `requireStudent()` and file storage. |
| `openai.ts` | OpenAI client, model names and the Structured Outputs helper. |

Route entries are one-line re-exports: `src/app/dashboard/session/page.tsx` and `src/app/api/chat/route.ts`. The rail item is in `features/ux/navigation/navigation.ts`. The hexagon is `features/ux/dashboard/overview/Hexagon.tsx`.

## `/api/chat` response

Newline-delimited JSON, one `ChatEvent` per line:

```json
{"type":"delta","text":"The chain rule "}
{"type":"scoring"}
{"type":"award","award":{"gains":{"calculus":16},"rankUps":[]}}
```

`{"type":"error"}` replaces the `award` line if the exchange fails.

## Storage

Sessions are JSON files at `data/sessions/<userId>/<sessionId>.json`, next to the stats files in `data/users/`. The whole `data/` folder is git-ignored. Like the stats files, this only works on one long-running server, so it won't work on a host like Vercel.

Session files are never uploaded. When a session finishes, only the student's stats file goes to Supabase, for teachers. See [`teacher.md`](../teacher/teacher.md).

## Not built yet

These were left out of the MVP on purpose:

- **Spending limits.** Nothing limits messages per student. Set a spending limit on the OpenAI key.
- **Safeguarding.** There is no moderation check. Review [OpenAI's under-18 guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance) before real students use this. Names and emails are not sent to OpenAI.
- **Chat extras.** There is no stop button, copy button or regenerate, and past sessions can't be reopened.
- **Database storage.** Sessions and stats need to move to Supabase before deploying, with stats writes kept server-side so students can't edit their own.
- **Classes.** Every teacher sees every student, because teachers aren't linked to students yet.

## Gotchas

- **Every rated message needs a stat.** If the scorer rates a message above `none` but leaves every stat at 0, the XP silently vanishes, because plain arithmetic fits none of the six stats. The rubric tells it to use the closest stat.
- **Keep `katex` on the version `rehype-katex` uses.** `npm ls katex` must show one version. The stylesheet comes from the top-level package, and rehype-katex writes the HTML, and class names changed between versions. A mismatch still renders simple equations, but `\boxed` becomes a black line and `≠` falls apart.
- **`displayMathOnOwnLines()` in `features/ux/markdown/Markdown.tsx` is required.** remark-math needs each `$$` on its own line, and models often don't do that. One bad block turns the rest of the reply into error text.
- **Test tutor changes against the real model.** Both bugs above only appeared with real replies. A mock returns only the formats you thought of.
- **A dollar amount needs escaping.** `$5 and $6` is read as an equation, so the tutor is told to write `\$5`.
- **Use the logged-in user's ID.** Everything here takes it from `getCurrentUser()`, never from the browser. `sessionId` does come from the browser, so `readSession()` checks its format and only looks in that user's folder.
- **Testing with a script:** use `localhost`, not `127.0.0.1`. The dev server blocks its browser scripts on any other host, so Material components never load. Next also keeps visited pages in the DOM but hidden, so check for visible elements.
