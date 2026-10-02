-- =========================================================
-- Confidential Job Board Demo — Supabase schema + RLS
-- Run this whole file in Supabase > SQL Editor
-- =========================================================

-- 1. Roles
create type public.user_role as enum ('admin', 'recruiter', 'employer');

-- 2. Profiles (one row per user, holds their role)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'recruiter',
  created_at timestamptz not null default now()
);

-- 3. Jobs: the SANITIZED part everyone allowed can see
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null,
  location text,
  description text,
  created_at timestamptz not null default now()
);

-- 4. Job private details: the REDACTED part (only employer owner + admin)
create table public.job_private (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  company_name text not null,
  contact_email text not null
);

-- 5. Helper: get the current user's role (security definer avoids RLS loops)
create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- 6. Auto-create a profile on signup.
--    Users can only self-select 'employer' or 'recruiter'. Admin is set manually.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    case when new.raw_user_meta_data->>'role' = 'employer'
         then 'employer'::public.user_role
         else 'recruiter'::public.user_role
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. Turn on Row Level Security
alter table public.profiles    enable row level security;
alter table public.jobs        enable row level security;
alter table public.job_private enable row level security;

-- ---------- PROFILES ----------
create policy "Users see own profile, admin sees all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() = 'admin');

-- ---------- JOBS (sanitized) ----------
create policy "Admin and recruiters see all jobs, employers see their own"
  on public.jobs for select to authenticated
  using (
    public.my_role() in ('admin', 'recruiter')
    or employer_id = auth.uid()
  );

create policy "Employers post their own jobs"
  on public.jobs for insert to authenticated
  with check (
    public.my_role() = 'employer'
    and employer_id = auth.uid()
  );

-- ---------- JOB_PRIVATE (redacted) ----------
-- Recruiters have NO policy here, so the database returns nothing to them.
create policy "Only the owning employer and admin see private details"
  on public.job_private for select to authenticated
  using (
    public.my_role() = 'admin'
    or exists (
      select 1 from public.jobs j
      where j.id = job_private.job_id and j.employer_id = auth.uid()
    )
  );

create policy "Employers add private details to their own jobs"
  on public.job_private for insert to authenticated
  with check (
    exists (
      select 1 from public.jobs j
      where j.id = job_private.job_id and j.employer_id = auth.uid()
    )
  );

-- =========================================================
-- AFTER creating your 3 demo users in Authentication > Users,
-- run these lines (edit the emails to match yours):
-- =========================================================
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'admin@demo.com');
-- update public.profiles set role = 'employer'
--   where id = (select id from auth.users where email = 'employer@demo.com');
-- update public.profiles set role = 'recruiter'
--   where id = (select id from auth.users where email = 'recruiter@demo.com');
