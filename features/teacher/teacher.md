# Teacher view

The **Students** page (`/dashboard/students`, teachers only) shows every student's hexagon and feedback side by side, with their stats table and recent activity folded away underneath. It all comes from each student's stats file. Read it together with [`chatbot.md`](../chatbot/chatbot.md), which covers the sessions themselves.

---

## Setup

Two steps, once per Supabase project:

1. Run [`20261107180000_create_student_files.sql`](../logic/migrations/20261107180000_create_student_files.sql) in the Supabase SQL Editor. It also drops `session_results`, a table from an earlier design that was never written to.
2. Add the secret key to `.env`, then restart `npm run dev`:

   ```dotenv
   SUPABASE_SERVICE_ROLE_KEY=your-secret-key
   ```

   Find it under Supabase → **Project Settings → API Keys**: the **service_role** key (legacy) or a **secret** key (`sb_secret_…`). It bypasses Row Level Security, so keep it server-only and never give it a `NEXT_PUBLIC_` name.

## How it works

```
Student submits the quiz
  └─ submitQuiz() (features/chatbot/actions.ts)
       ├─ updates the student's stats and session file, and returns their result
       └─ after the response has been sent:
            ├─ writeFeedback() rewrites the feedback in data/users/<id>.md
            └─ saveStudentFile() uploads that file to public.student_files

Teacher opens /dashboard/students
  └─ listStudentFiles() → reads as the teacher, so RLS applies
       └─ one card per student: hexagon and feedback, with the rest folded away
```

- **The student's stats file is the only thing uploaded.** Session files stay in `data/sessions/` and are never sent. Tutor replies are never uploaded.
- **The file does contain what students typed.** Its recent activity keeps the first 200 characters of their last 50 messages, so teachers can read those.
- **It uploads when a session finishes,** which means when the quiz is submitted. Students who haven't finished a session since this was set up don't appear, because teachers can't list students any other way.
- **Feedback is rewritten, not added to.** The scorer model gets the previous feedback and this session, including the XP and reason for each message, and returns a new note. See `features/chatbot/feedback.ts`.
- **Students read the same note,** on their Overview. It is written to read naturally to both, so it avoids "the student" and "you".
- **If the feedback fails,** the file still uploads with the old feedback and the new stats.
- **If the upload fails,** the student isn't affected and the error is logged. Teachers see the old copy until the next finished session uploads a new one.

## `public.student_files`

One row per student.

| Column | Meaning |
| --- | --- |
| `student_id` | Primary key |
| `student_email` | The student. `profiles` has no email, so it is copied here. |
| `content` | The whole file, as in `data/users/<id>.md`, including its JSON frontmatter |
| `updated_at` | When it was last uploaded |

**Who can do what:**

| Who | Access |
| --- | --- |
| Students | Read their own row |
| Teachers | Read every row |
| Logged out | Nothing |
| The server (secret key) | Write |

Nobody can write with the public key. If students could, they could fake their own stats and feedback. The rules were tested on Postgres (PGlite) with a stand-in for Supabase's auth schema.

## Files

| File | What it does |
| --- | --- |
| `StudentsPage.tsx` | The page. Checks the role, then shows one card per student. |
| `students.module.css` | Its styles |
| `features/logic/studentFiles.ts` | `saveStudentFile()` and `listStudentFiles()` |
| `features/logic/supabase/admin.ts` | The Supabase client that uses the secret key |
| `features/chatbot/feedback.ts` | Writes the feedback |

The page also uses `Hexagon` and `Feedback` from `features/ux/dashboard/overview/`, and `Markdown` from `features/ux/markdown/`. It reads the file with `hexagonFromFile()`, `feedbackFromFile()` and `userFileDetails()`.

## Gotchas

- **Every teacher sees every student.** There are no classes yet. Anyone can also sign up as a teacher, so anyone can read every student's email, stats, feedback and recent messages. Fix both before real students use this.
- **Feedback is written by a model.** It can be wrong, so teachers should treat it as a starting point.
- **The page shows the error page until the migration has been run.** The terminal says which table is missing.
- **Student text appears on this page.** `Markdown` drops images and links, so a student can't make a teacher's browser load something or put a link in front of them.
- **The files in `data/` are the source of truth.** Supabase only holds a copy. Nothing is ever read back from it into the stats.
