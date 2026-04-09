-- ============================================================
-- SIGNAL CRM — DATABASE SCHEMA v3.0
-- All tables prefixed with sig_ to coexist with Nanoneuron CRM
-- in the same Supabase project.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- SIG_USERS — Signal CRM user accounts (own auth, not Supabase auth)
-- ============================================================
create table if not exists sig_users (
  id              text        primary key default gen_random_uuid()::text,
  email           text        not null unique,
  password_hash   text        not null,
  name            text        not null default '',
  company_name    text        not null default '',
  phone           text        not null default '',
  avatar_url      text        not null default '',
  credits         integer     not null default 20,
  plan            text        not null default 'trial',
  is_paid         boolean     not null default false,
  is_active       boolean     not null default true,
  is_verified     boolean     not null default true,
  trial_start     timestamptz not null default now(),
  trial_end       timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_sig_users_email   on sig_users(email);
create index if not exists idx_sig_users_plan    on sig_users(plan);
create index if not exists idx_sig_users_is_paid on sig_users(is_paid);

-- ============================================================
-- SIG_SUBSCRIPTIONS
-- ============================================================
create table if not exists sig_subscriptions (
  id                   text        primary key default gen_random_uuid()::text,
  user_id              text        references sig_users on delete cascade not null,
  plan                 text        not null default 'trial',
  status               text        not null default 'active',
  billing_cycle        text        not null default 'monthly',
  amount               numeric     not null default 0,
  currency             text        not null default 'INR',
  payment_method       text        not null default 'trial',
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz,
  canceled_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_sig_subs_user_id on sig_subscriptions(user_id);
create index if not exists idx_sig_subs_status  on sig_subscriptions(status);

-- ============================================================
-- SIG_PAYMENT_TRANSACTIONS — immutable audit trail
-- ============================================================
create table if not exists sig_payment_transactions (
  id                   text        primary key default gen_random_uuid()::text,
  user_id              text        references sig_users on delete cascade not null,
  subscription_id      text        references sig_subscriptions on delete set null,
  plan                 text        not null default '',
  amount               numeric     not null default 0,
  currency             text        not null default 'INR',
  status               text        not null default 'pending',
  payment_method       text        not null default '',
  razorpay_order_id    text        not null default '',
  razorpay_payment_id  text        not null default '',
  transaction_ref      text        not null default '',
  notes                text        not null default '',
  failure_reason       text        not null default '',
  created_at           timestamptz not null default now()
);

create index if not exists idx_sig_txn_user_id    on sig_payment_transactions(user_id);
create index if not exists idx_sig_txn_status     on sig_payment_transactions(status);
create index if not exists idx_sig_txn_created_at on sig_payment_transactions(created_at desc);

-- ============================================================
-- SIG_WATCHLIST_ACCOUNTS — companies being monitored
-- ============================================================
create table if not exists sig_watchlist_accounts (
  id               text        primary key default gen_random_uuid()::text,
  user_id          text        references sig_users on delete cascade not null,
  company_name     text        not null,
  domain           text        not null default '',
  industry         text        not null default '',
  country          text        not null default '',
  hq_country       text        not null default '',
  employee_size    text        not null default '',
  priority         text        not null default 'medium',
  watch_hiring     boolean     not null default true,
  watch_pricing    boolean     not null default true,
  watch_compliance boolean     not null default true,
  watch_leadership boolean     not null default true,
  watch_expansion  boolean     not null default true,
  notes            text        not null default '',
  last_checked     timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_sig_watchlist_user_id on sig_watchlist_accounts(user_id);
create index if not exists idx_sig_watchlist_domain  on sig_watchlist_accounts(domain);
create index if not exists idx_sig_watchlist_country on sig_watchlist_accounts(country);

-- ============================================================
-- SIG_TRACKED_PAGES
-- ============================================================
create table if not exists sig_tracked_pages (
  id              text        primary key default gen_random_uuid()::text,
  account_id      text        references sig_watchlist_accounts on delete cascade not null,
  page_type       text        not null default '',
  url             text        not null default '',
  content_hash    text        not null default '',
  content_text    text        not null default '',
  country_keys    text        not null default '[]',
  product_keys    text        not null default '[]',
  job_count       integer     not null default 0,
  last_scanned_at timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_sig_tracked_account_id on sig_tracked_pages(account_id);
create index if not exists idx_sig_tracked_type       on sig_tracked_pages(account_id, page_type);

-- ============================================================
-- SIG_WEB_SIGNALS — detected intelligence events
-- ============================================================
create table if not exists sig_web_signals (
  id                  text        primary key default gen_random_uuid()::text,
  user_id             text        references sig_users on delete cascade not null,
  account_id          text        references sig_watchlist_accounts on delete set null,
  account_name        text        not null default '',
  signal_type         text        not null default '',
  signal_strength     text        not null default 'medium',
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

create index if not exists idx_sig_signals_user_id       on sig_web_signals(user_id);
create index if not exists idx_sig_signals_detected_at   on sig_web_signals(detected_at desc);
create index if not exists idx_sig_signals_user_actioned on sig_web_signals(user_id, is_actioned);
create index if not exists idx_sig_signals_user_strength on sig_web_signals(user_id, signal_strength);
create index if not exists idx_sig_signals_type          on sig_web_signals(signal_type);

-- ============================================================
-- SIG_PAGE_SNAPSHOTS
-- ============================================================
create table if not exists sig_page_snapshots (
  id               text        primary key default gen_random_uuid()::text,
  signal_id        text        references sig_web_signals on delete cascade not null,
  tracked_page_id  text        references sig_tracked_pages on delete set null,
  before_content   text        not null default '',
  after_content    text        not null default '',
  change_type      text        not null default '',
  change_details   text        not null default '',
  snapshot_at      timestamptz not null default now()
);

create index if not exists idx_sig_snapshots_signal_id on sig_page_snapshots(signal_id);

-- ============================================================
-- SIG_DEALS — Signal CRM pipeline
-- ============================================================
create table if not exists sig_deals (
  id                  text        primary key default gen_random_uuid()::text,
  user_id             text        references sig_users on delete cascade not null,
  title               text        not null,
  company_name        text        not null default '',
  contact_name        text        not null default '',
  contact_title       text        not null default '',
  value               numeric     not null default 0,
  currency            text        not null default 'INR',
  stage               text        not null default 'signal',
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

create index if not exists idx_sig_deals_user_id on sig_deals(user_id);
create index if not exists idx_sig_deals_stage   on sig_deals(user_id, stage);
create index if not exists idx_sig_deals_country on sig_deals(country);

-- ============================================================
-- SIG_LEADS
-- ============================================================
create table if not exists sig_leads (
  id            text        primary key default gen_random_uuid()::text,
  user_id       text        references sig_users on delete cascade not null,
  company       text        not null default '',
  contact_name  text        not null default '',
  title         text        not null default '',
  email         text        not null default '',
  phone         text        not null default '',
  country       text        not null default '',
  industry      text        not null default '',
  status        text        not null default 'new',
  source        text        not null default 'manual',
  score         integer     not null default 5,
  notes         text        not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists idx_sig_leads_user_id on sig_leads(user_id);
create index if not exists idx_sig_leads_status  on sig_leads(user_id, status);
create index if not exists idx_sig_leads_country on sig_leads(country);

-- ============================================================
-- SIG_COMPLIANCE_SAVES
-- ============================================================
create table if not exists sig_compliance_saves (
  id          text        primary key default gen_random_uuid()::text,
  user_id     text        references sig_users on delete cascade not null,
  country     text        not null default '',
  framework   text        not null default '',
  channel     text        not null default 'email',
  result      text        not null default 'allowed',
  notes       text        not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists idx_sig_compliance_user_id on sig_compliance_saves(user_id);
create index if not exists idx_sig_compliance_country on sig_compliance_saves(country);

-- ============================================================
-- SIG_SCRAPE_JOBS
-- ============================================================
create table if not exists sig_scrape_jobs (
  id           text        primary key default gen_random_uuid()::text,
  user_id      text        references sig_users on delete cascade not null,
  account_id   text        references sig_watchlist_accounts on delete cascade not null,
  job_type     text        not null default 'full_scan',
  status       text        not null default 'pending',
  started_at   timestamptz,
  finished_at  timestamptz,
  error_msg    text        not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists idx_sig_scrape_jobs_user_id on sig_scrape_jobs(user_id);
create index if not exists idx_sig_scrape_jobs_account on sig_scrape_jobs(account_id);
create index if not exists idx_sig_scrape_jobs_status  on sig_scrape_jobs(status);

-- ============================================================
-- SIG_AUDIT_LOGS
-- ============================================================
create table if not exists sig_audit_logs (
  id           text        primary key default gen_random_uuid()::text,
  user_id      text        references sig_users on delete set null,
  entity_type  text        not null default '',
  entity_id    text,
  action       text        not null default '',
  old_values   jsonb,
  new_values   jsonb,
  ip_address   text        not null default '',
  user_agent   text        not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists idx_sig_audit_user_id    on sig_audit_logs(user_id);
create index if not exists idx_sig_audit_entity     on sig_audit_logs(entity_type, entity_id);
create index if not exists idx_sig_audit_created_at on sig_audit_logs(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table sig_users               enable row level security;
alter table sig_subscriptions       enable row level security;
alter table sig_payment_transactions enable row level security;
alter table sig_watchlist_accounts  enable row level security;
alter table sig_tracked_pages       enable row level security;
alter table sig_web_signals         enable row level security;
alter table sig_page_snapshots      enable row level security;
alter table sig_deals               enable row level security;
alter table sig_leads               enable row level security;
alter table sig_compliance_saves    enable row level security;
alter table sig_scrape_jobs         enable row level security;
alter table sig_audit_logs          enable row level security;

-- Signal CRM uses its own JWT auth (not Supabase auth.uid()).
-- RLS policies allow service_role to bypass, and restrict anon.
-- The FastAPI backend connects with service_role key → bypasses RLS.

drop policy if exists "sig_users_service_only"          on sig_users;
drop policy if exists "sig_subs_service_only"           on sig_subscriptions;
drop policy if exists "sig_txn_service_only"            on sig_payment_transactions;
drop policy if exists "sig_watchlist_service_only"      on sig_watchlist_accounts;
drop policy if exists "sig_tracked_service_only"        on sig_tracked_pages;
drop policy if exists "sig_signals_service_only"        on sig_web_signals;
drop policy if exists "sig_snapshots_service_only"      on sig_page_snapshots;
drop policy if exists "sig_deals_service_only"          on sig_deals;
drop policy if exists "sig_leads_service_only"          on sig_leads;
drop policy if exists "sig_compliance_service_only"     on sig_compliance_saves;
drop policy if exists "sig_scrape_service_only"         on sig_scrape_jobs;
drop policy if exists "sig_audit_service_only"          on sig_audit_logs;

-- Allow service_role (backend) full access; block anon/authenticated (no Supabase auth used)
create policy "sig_users_service_only"         on sig_users               for all using (true) with check (true);
create policy "sig_subs_service_only"          on sig_subscriptions        for all using (true) with check (true);
create policy "sig_txn_service_only"           on sig_payment_transactions  for all using (true) with check (true);
create policy "sig_watchlist_service_only"     on sig_watchlist_accounts   for all using (true) with check (true);
create policy "sig_tracked_service_only"       on sig_tracked_pages        for all using (true) with check (true);
create policy "sig_signals_service_only"       on sig_web_signals          for all using (true) with check (true);
create policy "sig_snapshots_service_only"     on sig_page_snapshots       for all using (true) with check (true);
create policy "sig_deals_service_only"         on sig_deals                for all using (true) with check (true);
create policy "sig_leads_service_only"         on sig_leads                for all using (true) with check (true);
create policy "sig_compliance_service_only"    on sig_compliance_saves     for all using (true) with check (true);
create policy "sig_scrape_service_only"        on sig_scrape_jobs          for all using (true) with check (true);
create policy "sig_audit_service_only"         on sig_audit_logs           for all using (true) with check (true);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamps
create or replace function sig_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sig_users_updated_at         on sig_users;
drop trigger if exists trg_sig_subscriptions_updated_at on sig_subscriptions;
drop trigger if exists trg_sig_deals_updated_at         on sig_deals;

create trigger trg_sig_users_updated_at
  before update on sig_users
  for each row execute function sig_set_updated_at();

create trigger trg_sig_subscriptions_updated_at
  before update on sig_subscriptions
  for each row execute function sig_set_updated_at();

create trigger trg_sig_deals_updated_at
  before update on sig_deals
  for each row execute function sig_set_updated_at();

-- Deduct credits helper
create or replace function sig_deduct_credit(p_user_id text, p_amount integer default 1)
returns boolean language plpgsql security definer as $$
declare
  v_credits integer;
begin
  select credits into v_credits from sig_users where id = p_user_id for update;
  if v_credits is null or v_credits < p_amount then
    return false;
  end if;
  update sig_users set credits = credits - p_amount where id = p_user_id;
  return true;
end;
$$;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name like 'sig_%'
-- order by table_name;
