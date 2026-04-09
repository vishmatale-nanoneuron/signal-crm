-- ============================================================
-- SIGNAL CRM — COMPLETE SUPABASE SCHEMA v2.0
-- Nanoneuron Services · signal.nanoneuron.ai
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table if not exists profiles (
  id              uuid        references auth.users on delete cascade primary key,
  name            text        not null default '',
  company_name    text        not null default '',
  phone           text        not null default '',
  avatar_url      text        not null default '',
  credits         integer     not null default 20,
  plan            text        not null default 'trial',   -- trial | starter | pro | enterprise
  is_paid         boolean     not null default false,
  is_active       boolean     not null default true,
  trial_start     timestamptz not null default now(),
  trial_end       timestamptz not null default (now() + interval '14 days'),
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_profiles_plan       on profiles(plan);
create index if not exists idx_profiles_is_paid    on profiles(is_paid);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table if not exists subscriptions (
  id                   uuid        default gen_random_uuid() primary key,
  user_id              uuid        references auth.users on delete cascade not null,
  plan                 text        not null default 'trial',
  status               text        not null default 'active',  -- active | canceled | expired | past_due
  billing_cycle        text        not null default 'monthly', -- monthly | annual
  amount               numeric     not null default 0,
  currency             text        not null default 'INR',
  payment_method       text        not null default 'trial',   -- razorpay | swift | neft | trial
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz,
  canceled_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on subscriptions(user_id);
create index if not exists idx_subscriptions_status  on subscriptions(status);

-- ============================================================
-- PAYMENT TRANSACTIONS — immutable audit trail
-- ============================================================
create table if not exists payment_transactions (
  id                   uuid        default gen_random_uuid() primary key,
  user_id              uuid        references auth.users on delete cascade not null,
  subscription_id      uuid        references subscriptions on delete set null,
  plan                 text        not null default '',
  amount               numeric     not null default 0,
  currency             text        not null default 'INR',
  status               text        not null default 'pending',  -- pending | success | failed | refunded
  payment_method       text        not null default '',
  razorpay_order_id    text        not null default '',
  razorpay_payment_id  text        not null default '',
  transaction_ref      text        not null default '',   -- SWIFT/NEFT UTR
  notes                text        not null default '',
  failure_reason       text        not null default '',
  created_at           timestamptz not null default now()
  -- No updated_at — transactions are immutable
);

create index if not exists idx_payment_txn_user_id    on payment_transactions(user_id);
create index if not exists idx_payment_txn_status     on payment_transactions(status);
create index if not exists idx_payment_txn_created_at on payment_transactions(created_at desc);

-- ============================================================
-- WATCHLIST ACCOUNTS — companies being monitored
-- ============================================================
create table if not exists watchlist_accounts (
  id               uuid        default gen_random_uuid() primary key,
  user_id          uuid        references auth.users on delete cascade not null,
  company_name     text        not null,
  domain           text        not null default '',
  industry         text        not null default '',
  country          text        not null default '',
  hq_country       text        not null default '',
  employee_size    text        not null default '',
  priority         text        not null default 'medium',  -- low | medium | high | critical
  watch_hiring     boolean     not null default true,
  watch_pricing    boolean     not null default true,
  watch_compliance boolean     not null default true,
  watch_leadership boolean     not null default true,
  watch_expansion  boolean     not null default true,
  notes            text        not null default '',
  last_checked     timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_watchlist_user_id on watchlist_accounts(user_id);
create index if not exists idx_watchlist_domain  on watchlist_accounts(domain);
create index if not exists idx_watchlist_country on watchlist_accounts(country);

-- ============================================================
-- TRACKED PAGES — web pages scraped per watchlist company
-- ============================================================
create table if not exists tracked_pages (
  id              uuid        default gen_random_uuid() primary key,
  account_id      uuid        references watchlist_accounts on delete cascade not null,
  page_type       text        not null default '',     -- careers | sitemap | pricing | products | policy
  url             text        not null default '',
  content_hash    text        not null default '',     -- MD5/SHA256 of last snapshot
  content_text    text        not null default '',
  country_keys    text        not null default '[]',   -- JSON array
  product_keys    text        not null default '[]',   -- JSON array
  job_count       integer     not null default 0,
  last_scanned_at timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_tracked_pages_account_id on tracked_pages(account_id);
create index if not exists idx_tracked_pages_type       on tracked_pages(account_id, page_type);

-- ============================================================
-- WEB SIGNALS — detected intelligence events
-- ============================================================
create table if not exists web_signals (
  id                  uuid        default gen_random_uuid() primary key,
  user_id             uuid        references auth.users on delete cascade not null,
  account_id          uuid        references watchlist_accounts on delete set null,
  account_name        text        not null default '',
  signal_type         text        not null default '',  -- hiring_spike | new_country_page | pricing_change | leadership_change | new_product | policy_update
  signal_strength     text        not null default 'medium',  -- low | medium | high | critical
  title               text        not null default '',
  summary             text        not null default '',
  proof_text          text        not null default '',
  proof_url           text        not null default '',
  country_hint        text        not null default '',
  recommended_action  text        not null default '',
  score               integer     not null default 5,
  is_actioned         boolean     not null default false,
  is_dismissed        boolean     not null default false,
  before_snapshot     text        not null default '',
  after_snapshot      text        not null default '',
  detected_at         timestamptz not null default now()
);

create index if not exists idx_signals_user_id        on web_signals(user_id);
create index if not exists idx_signals_detected_at    on web_signals(detected_at desc);
create index if not exists idx_signals_user_actioned  on web_signals(user_id, is_actioned);
create index if not exists idx_signals_user_strength  on web_signals(user_id, signal_strength);
create index if not exists idx_signals_signal_type    on web_signals(signal_type);

-- ============================================================
-- PAGE SNAPSHOTS — before/after evidence for signals
-- ============================================================
create table if not exists page_snapshots (
  id               uuid        default gen_random_uuid() primary key,
  signal_id        uuid        references web_signals on delete cascade not null,
  tracked_page_id  uuid        references tracked_pages on delete set null,
  before_content   text        not null default '',
  after_content    text        not null default '',
  change_type      text        not null default '',
  change_details   text        not null default '',
  snapshot_at      timestamptz not null default now()
);

create index if not exists idx_snapshots_signal_id on page_snapshots(signal_id);

-- ============================================================
-- DEALS — CRM pipeline
-- ============================================================
create table if not exists deals (
  id                  uuid        default gen_random_uuid() primary key,
  user_id             uuid        references auth.users on delete cascade not null,
  title               text        not null,
  company_name        text        not null default '',
  contact_name        text        not null default '',
  contact_title       text        not null default '',
  value               numeric     not null default 0,
  currency            text        not null default 'INR',
  stage               text        not null default 'signal',  -- signal | qualified | contacted | proposal | negotiation | won | lost
  country             text        not null default '',
  industry            text        not null default '',
  signal_trigger      text        not null default '',
  compliance_checked  boolean     not null default false,
  next_action         text        not null default '',
  probability         integer     not null default 10,
  close_date          text        not null default '',
  notes               text        not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_deals_user_id on deals(user_id);
create index if not exists idx_deals_stage   on deals(user_id, stage);
create index if not exists idx_deals_country on deals(country);

-- ============================================================
-- LEADS — prospect database
-- ============================================================
create table if not exists leads (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users on delete cascade not null,
  company       text        not null default '',
  contact_name  text        not null default '',
  title         text        not null default '',
  email         text        not null default '',
  phone         text        not null default '',
  country       text        not null default '',
  industry      text        not null default '',
  status        text        not null default 'new',    -- new | contacted | qualified | disqualified
  source        text        not null default 'manual', -- manual | web_signal | import | api
  score         integer     not null default 5,
  notes         text        not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists idx_leads_user_id on leads(user_id);
create index if not exists idx_leads_status  on leads(user_id, status);
create index if not exists idx_leads_country on leads(country);

-- ============================================================
-- COMPLIANCE SAVES — saved compliance check results
-- ============================================================
create table if not exists compliance_saves (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users on delete cascade not null,
  country     text        not null default '',
  framework   text        not null default '',
  channel     text        not null default 'email',  -- email | phone | linkedin | sms
  result      text        not null default 'allowed', -- allowed | warning | blocked
  notes       text        not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists idx_compliance_user_id on compliance_saves(user_id);
create index if not exists idx_compliance_country on compliance_saves(country);

-- ============================================================
-- SCRAPE JOBS — track website scan queue
-- ============================================================
create table if not exists scrape_jobs (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references auth.users on delete cascade not null,
  account_id   uuid        references watchlist_accounts on delete cascade not null,
  job_type     text        not null default 'full_scan',  -- full_scan | diff_scan | policy_scan
  status       text        not null default 'pending',    -- pending | processing | completed | failed
  started_at   timestamptz,
  finished_at  timestamptz,
  error_msg    text        not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists idx_scrape_jobs_user_id   on scrape_jobs(user_id);
create index if not exists idx_scrape_jobs_account   on scrape_jobs(account_id);
create index if not exists idx_scrape_jobs_status    on scrape_jobs(status);
create index if not exists idx_scrape_jobs_created   on scrape_jobs(created_at desc);

-- ============================================================
-- AUDIT LOGS — security + accountability trail
-- ============================================================
create table if not exists audit_logs (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references auth.users on delete set null,
  entity_type  text        not null default '',  -- deal | lead | signal | watchlist
  entity_id    uuid,
  action       text        not null default '',  -- create | update | delete | login | logout
  old_values   jsonb,
  new_values   jsonb,
  ip_address   text        not null default '',
  user_agent   text        not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_logs_user_id     on audit_logs(user_id);
create index if not exists idx_audit_logs_entity      on audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created_at  on audit_logs(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table profiles           enable row level security;
alter table subscriptions      enable row level security;
alter table payment_transactions enable row level security;
alter table watchlist_accounts enable row level security;
alter table tracked_pages      enable row level security;
alter table web_signals        enable row level security;
alter table page_snapshots     enable row level security;
alter table deals              enable row level security;
alter table leads              enable row level security;
alter table compliance_saves   enable row level security;
alter table scrape_jobs        enable row level security;
alter table audit_logs         enable row level security;

-- ── Profiles ─────────────────────────────────────────────────
drop policy if exists "profiles_select_own"  on profiles;
drop policy if exists "profiles_insert_own"  on profiles;
drop policy if exists "profiles_update_own"  on profiles;

create policy "profiles_select_own"  on profiles for select using (auth.uid() = id);
create policy "profiles_insert_own"  on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"  on profiles for update using (auth.uid() = id);

-- ── Subscriptions ─────────────────────────────────────────────
drop policy if exists "subs_own" on subscriptions;
create policy "subs_own" on subscriptions for all using (auth.uid() = user_id);

-- ── Payment Transactions ──────────────────────────────────────
drop policy if exists "txn_select_own"  on payment_transactions;
drop policy if exists "txn_insert_own"  on payment_transactions;
create policy "txn_select_own"  on payment_transactions for select using (auth.uid() = user_id);
create policy "txn_insert_own"  on payment_transactions for insert with check (auth.uid() = user_id);
-- No update/delete — transactions are immutable

-- ── Watchlist ─────────────────────────────────────────────────
drop policy if exists "watchlist_own" on watchlist_accounts;
create policy "watchlist_own" on watchlist_accounts for all using (auth.uid() = user_id);

-- ── Tracked Pages (via watchlist ownership) ───────────────────
drop policy if exists "tracked_pages_own" on tracked_pages;
create policy "tracked_pages_own" on tracked_pages for all using (
  exists (
    select 1 from watchlist_accounts wa
    where wa.id = tracked_pages.account_id
      and wa.user_id = auth.uid()
  )
);

-- ── Web Signals ───────────────────────────────────────────────
drop policy if exists "signals_own" on web_signals;
create policy "signals_own" on web_signals for all using (auth.uid() = user_id);

-- ── Page Snapshots (via signal ownership) ─────────────────────
drop policy if exists "snapshots_own" on page_snapshots;
create policy "snapshots_own" on page_snapshots for all using (
  exists (
    select 1 from web_signals ws
    where ws.id = page_snapshots.signal_id
      and ws.user_id = auth.uid()
  )
);

-- ── Deals ─────────────────────────────────────────────────────
drop policy if exists "deals_own" on deals;
create policy "deals_own" on deals for all using (auth.uid() = user_id);

-- ── Leads ─────────────────────────────────────────────────────
drop policy if exists "leads_own" on leads;
create policy "leads_own" on leads for all using (auth.uid() = user_id);

-- ── Compliance ────────────────────────────────────────────────
drop policy if exists "compliance_own" on compliance_saves;
create policy "compliance_own" on compliance_saves for all using (auth.uid() = user_id);

-- ── Scrape Jobs ───────────────────────────────────────────────
drop policy if exists "scrape_jobs_own" on scrape_jobs;
create policy "scrape_jobs_own" on scrape_jobs for all using (auth.uid() = user_id);

-- ── Audit Logs (read-only for owner) ─────────────────────────
drop policy if exists "audit_logs_select_own"  on audit_logs;
drop policy if exists "audit_logs_insert_own"  on audit_logs;
create policy "audit_logs_select_own" on audit_logs for select using (auth.uid() = user_id);
create policy "audit_logs_insert_own" on audit_logs for insert with check (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- ── Auto-create profile on Supabase Auth signup ──────────────
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, company_name, trial_start, trial_end)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'company_name', ''),
    now(),
    now() + interval '14 days'
  )
  on conflict (id) do nothing;

  -- Create default trial subscription
  insert into public.subscriptions (user_id, plan, status, billing_cycle, amount, payment_method)
  values (new.id, 'trial', 'active', 'monthly', 0, 'trial')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Auto-update updated_at timestamps ────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at     on profiles;
drop trigger if exists trg_subscriptions_updated_at on subscriptions;
drop trigger if exists trg_deals_updated_at         on deals;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger trg_subscriptions_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

create trigger trg_deals_updated_at
  before update on deals
  for each row execute function set_updated_at();

-- ── Deduct credits helper ─────────────────────────────────────
create or replace function deduct_credit(p_user_id uuid, p_amount integer default 1)
returns boolean
language plpgsql
security definer
as $$
declare
  v_credits integer;
begin
  select credits into v_credits from public.profiles where id = p_user_id for update;
  if v_credits is null or v_credits < p_amount then
    return false;
  end if;
  update public.profiles set credits = credits - p_amount where id = p_user_id;
  return true;
end;
$$;

-- ============================================================
-- STORAGE BUCKETS (run separately if needed)
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('exports', 'exports', false) on conflict do nothing;

-- ============================================================
-- VERIFICATION QUERY — run after migration to confirm tables
-- ============================================================
-- select table_name, row_security
-- from information_schema.tables
-- where table_schema = 'public'
-- order by table_name;
