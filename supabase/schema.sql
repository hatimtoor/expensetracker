-- WealthTrack — Supabase schema (per-user, locked down with RLS + Auth)
-- Run this in your Supabase project's SQL editor (Dashboard -> SQL -> New query).
-- Safe to run more than once; it upgrades an earlier (anon) version in place.

create table if not exists public.monthly_records (
  id            uuid primary key default gen_random_uuid(),
  month         text not null,                   -- "YYYY-MM"
  income        numeric not null default 0,
  total_expense numeric not null default 0,
  balance       numeric not null default 0,
  breakdown     jsonb  not null default '{}'::jsonb,  -- { "Food": 500, "Rent": 1200 }
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Ownership: every row belongs to the authenticated user who created it.
alter table public.monthly_records
  add column if not exists user_id uuid default auth.uid()
    references auth.users(id) on delete cascade;

-- Drop any pre-auth demo rows that have no owner (from the earlier anon setup).
delete from public.monthly_records where user_id is null;

-- One row per (user, month). Replace the old month-only unique constraint.
alter table public.monthly_records drop constraint if exists monthly_records_month_key;
create unique index if not exists monthly_records_user_month_key
  on public.monthly_records (user_id, month);

-- Keep updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_monthly_records_updated_at on public.monthly_records;
create trigger trg_monthly_records_updated_at
  before update on public.monthly_records
  for each row execute function public.set_updated_at();

-- Row Level Security: each user can only see and touch their own rows.
alter table public.monthly_records enable row level security;

drop policy if exists "anon full access" on public.monthly_records;      -- old permissive policy
drop policy if exists "Users manage own records" on public.monthly_records;

create policy "Users manage own records"
  on public.monthly_records
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── After running this ────────────────────────────────────────────────────────
-- 1. Create your single account from the app's login screen (Sign up), OR in
--    Dashboard -> Authentication -> Users -> Add user.
-- 2. To truly lock it to just you, disable public sign-ups:
--    Dashboard -> Authentication -> Providers -> Email -> turn OFF "Allow new users
--    to sign up" (do this AFTER your account exists).
-- 3. Optional: also turn OFF "Confirm email" there so sign-in works instantly.
