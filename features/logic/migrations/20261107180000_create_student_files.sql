-- =============================================================================
-- Student files
--
-- One row per student, holding a copy of their stats file (data/users/<id>.md):
-- their stats, feedback and recent activity. Teachers read it on the Students
-- page.
--
-- How to run: Supabase dashboard → SQL Editor → New query → paste this whole
-- file → Run. It is safe to run more than once. Run it after
-- 20261107000000_create_profiles.sql.
--
-- Rows are written by the server with the secret key, which bypasses Row Level
-- Security. Users can only read: if students could write here, they could fake
-- their own stats and feedback using the public anon key.
-- =============================================================================

-- 0. Remove the table from an earlier design ----------------------------------
-- session_results was replaced by this table before anything was written to it.
drop table if exists public.session_results;

-- 1. Table ---------------------------------------------------------------------
create table if not exists public.student_files (
  student_id    uuid primary key references public.profiles (id) on delete cascade,
  student_email text not null,
  content       text not null,
  updated_at    timestamptz not null
);

comment on table public.student_files is
  'A copy of each student''s stats file, updated when they finish a session. Written by the server only.';

-- 2. Row Level Security ----------------------------------------------------------
-- Students can read their own file and teachers can read everyone's. There are
-- deliberately no insert/update/delete policies.
alter table public.student_files enable row level security;

drop policy if exists "Students can read their own file" on public.student_files;
create policy "Students can read their own file"
  on public.student_files
  for select
  to authenticated
  using ((select auth.uid()) = student_id);

drop policy if exists "Teachers can read all student files" on public.student_files;
create policy "Teachers can read all student files"
  on public.student_files
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid()) and role = 'teacher'
    )
  );

-- Belt and braces on top of RLS: the API roles may only read.
revoke all on public.student_files from anon, authenticated;
grant select on public.student_files to authenticated;
grant all on public.student_files to service_role;
