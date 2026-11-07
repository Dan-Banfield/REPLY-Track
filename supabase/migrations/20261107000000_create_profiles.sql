-- =============================================================================
-- Profiles and roles
--
-- One row in public.profiles per user in auth.users, holding the user's role
-- ('teacher' or 'student').
--
-- How to run: Supabase dashboard → SQL Editor → New query → paste this whole
-- file → Run. It is safe to run more than once.
--
-- Flow:
--   1. The sign-up form passes the chosen role as user metadata
--      (auth.users.raw_user_meta_data ->> 'role').
--   2. The trigger below copies it into public.profiles when the user is created.
--   3. The app reads the role from public.profiles only, never from metadata
--      (users can edit their own metadata, but not their profile).
--
-- Keep the role values in sync with ROLES in src/lib/auth/roles.ts.
-- =============================================================================

-- 1. Role type ----------------------------------------------------------------
do $$
begin
  create type public.user_role as enum ('teacher', 'student');
exception
  when duplicate_object then null; -- already exists
end
$$;

-- 2. Profiles table -----------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.user_role not null,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. role is set at sign-up by the on_auth_user_created trigger; users cannot change it.';

-- 3. Row Level Security ---------------------------------------------------------
-- Logged-in users may read their own profile. There are deliberately no
-- insert/update/delete policies: profiles are created by the trigger and
-- roles are changed only by an admin (Table Editor or SQL, which bypass RLS).
alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Belt and braces on top of RLS: the API roles may only read.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- 4. Create a profile for every new user -------------------------------------
-- Uses the role from sign-up metadata if it is a valid user_role, otherwise
-- falls back to 'student' (least privilege), e.g. for users added in the
-- dashboard without metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    case
      when requested_role = any (enum_range(null::public.user_role)::text[])
        then requested_role::public.user_role
      else 'student'::public.user_role
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Backfill users who signed up before this script ran ---------------------
insert into public.profiles (id, role)
select
  u.id,
  case
    when u.raw_user_meta_data ->> 'role' = any (enum_range(null::public.user_role)::text[])
      then (u.raw_user_meta_data ->> 'role')::public.user_role
    else 'student'::public.user_role
  end
from auth.users as u
on conflict (id) do nothing;
