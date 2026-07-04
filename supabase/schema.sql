-- WealthTrack — Supabase schema
-- Run this in your Supabase project's SQL editor (Dashboard -> SQL -> New query).

create table if not exists public.monthly_records (
  id            uuid primary key default gen_random_uuid(),
  month         text not null unique,            -- "YYYY-MM", one row per month
  income        numeric not null default 0,
  total_expense numeric not null default 0,
  balance       numeric not null default 0,
  breakdown     jsonb  not null default '{}'::jsonb,  -- { "Food": 500, "Rent": 1200 }
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

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

-- Row Level Security.
alter table public.monthly_records enable row level security;

-- Permissive policy for a single-user / personal tracker using the anon key.
-- The anon key is safe to expose in the browser ONLY with RLS enabled.
-- For a multi-user deployment, replace this with auth-based policies
-- (e.g. add a `user_id uuid` column and check `auth.uid() = user_id`).
drop policy if exists "anon full access" on public.monthly_records;
create policy "anon full access"
  on public.monthly_records
  for all
  to anon
  using (true)
  with check (true);
