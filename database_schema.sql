-- Signal CRM — Supabase Database Schema
-- Run this in your Supabase project: Dashboard > SQL Editor > New Query

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null default '',
  company_name text default '',
  credits integer default 20,
  plan text default 'trial',
  is_paid boolean default false,
  trial_start timestamptz default now(),
  trial_end timestamptz default (now() + interval '14 days'),
  created_at timestamptz default now()
);

-- ============================================================
-- WATCHLIST ACCOUNTS
-- ============================================================
create table if not exists watchlist_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  company_name text not null,
  domain text not null,
  industry text default '',
  country text default '',
  hq_country text default '',
  employee_size text default '',
  priority text default 'medium',
  watch_hiring boolean default true,
  watch_pricing boolean default true,
  watch_compliance boolean default true,
  watch_leadership boolean default true,
  watch_expansion boolean default true,
  notes text default '',
  last_checked timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- WEB SIGNALS
-- ============================================================
create table if not exists web_signals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references watchlist_accounts on delete set null,
  account_name text not null,
  signal_type text not null,
  signal_strength text default 'medium',
  title text not null,
  summary text not null,
  proof_text text default '',
  proof_url text default '',
  country_hint text default '',
  recommended_action text default '',
  score integer default 5,
  is_actioned boolean default false,
  is_dismissed boolean default false,
  detected_at timestamptz default now()
);

-- ============================================================
-- DEALS
-- ============================================================
create table if not exists deals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  company_name text default '',
  contact_name text default '',
  contact_title text default '',
  value numeric default 0,
  currency text default 'INR',
  stage text default 'signal',
  country text default '',
  industry text default '',
  signal_trigger text default '',
  compliance_checked boolean default false,
  next_action text default '',
  probability integer default 10,
  close_date text default '',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- LEADS
-- ============================================================
create table if not exists leads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  company text not null,
  contact_name text default '',
  title text default '',
  email text default '',
  phone text default '',
  country text default '',
  industry text default '',
  status text default 'new',
  source text default 'manual',
  score integer default 5,
  notes text default '',
  created_at timestamptz default now()
);

-- ============================================================
-- COMPLIANCE SAVES
-- ============================================================
create table if not exists compliance_saves (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  country text not null,
  framework text default '',
  notes text default '',
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table watchlist_accounts enable row level security;
alter table web_signals enable row level security;
alter table deals enable row level security;
alter table leads enable row level security;
alter table compliance_saves enable row level security;

-- Profiles policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Watchlist policies
create policy "Users manage own watchlist" on watchlist_accounts for all using (auth.uid() = user_id);

-- Signals policies
create policy "Users manage own signals" on web_signals for all using (auth.uid() = user_id);

-- Deals policies
create policy "Users manage own deals" on deals for all using (auth.uid() = user_id);

-- Leads policies
create policy "Users manage own leads" on leads for all using (auth.uid() = user_id);

-- Compliance policies
create policy "Users manage own compliance" on compliance_saves for all using (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, company_name, trial_start, trial_end)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'company_name', ''),
    now(),
    now() + interval '14 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
