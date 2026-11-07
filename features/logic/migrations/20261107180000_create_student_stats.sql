-- =============================================================================
-- Student stats (the hexagon)
--
-- One row per user in public.student_stats, holding that user's stats "file":
--   data      jsonb  the UserProfile (source of truth): XP, ranks, activity log
--   markdown  text   the same profile rendered as a Markdown document
--                    (JSON frontmatter + readable tables), regenerated on every save
--   version   int    optimistic-concurrency counter, bumped on every write
--
-- Shapes are defined in features/logic/stats/types.ts; see features/logic/backend.md.
--
-- How to run: Supabase dashboard → SQL Editor → New query → paste this whole
-- file → Run. Run 20261107000000_create_profiles.sql first. Safe to run more
-- than once.
--
-- Who can do what:
--   - Rows are written only by the server, with the service_role key
--     (features/logic/supabase/admin.ts). Users can never write here, otherwise
--     a student could edit their own XP through the public API.
--   - A logged-in user may read their own row.
--   - Teachers may read every row (to see their students' progress).
-- =============================================================================

-- 1. Table ----------------------------------------------------------------------
create table if not exists public.student_stats (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  markdown   text not null,
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);

comment on table public.student_stats is
  'Hexagon stats per user. data = UserProfile JSON (source of truth), markdown = rendered copy. Written only by the server (service_role).';

-- 2. Helper: is the current user a teacher? -----------------------------------
-- security definer so the check works no matter what RLS allows on profiles.
-- stable + wrapped in (select …) in the policy so it runs once per query.
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'teacher'
  );
$$;

revoke execute on function public.is_teacher() from public, anon;
grant execute on function public.is_teacher() to authenticated;

-- 3. Row Level Security ---------------------------------------------------------
alter table public.student_stats enable row level security;

drop policy if exists "Users can read their own stats" on public.student_stats;
create policy "Users can read their own stats"
  on public.student_stats
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Teachers can read all stats" on public.student_stats;
create policy "Teachers can read all stats"
  on public.student_stats
  for select
  to authenticated
  using ((select public.is_teacher()));

-- Belt and braces on top of RLS: the API roles may only read; the server
-- (service_role, which bypasses RLS) does all writes.
revoke all on public.student_stats from anon, authenticated;
grant select on public.student_stats to authenticated;
grant select, insert, update, delete on public.student_stats to service_role;
