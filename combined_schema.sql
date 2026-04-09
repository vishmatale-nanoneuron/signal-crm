-- ============================================================
-- NANONEURON — COMBINED DATABASE SCHEMA
-- Nanoneuron CRM (nn_ prefix) + Signal CRM (sig_ prefix)
-- One Supabase project, two products, zero conflicts.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================
-- ██████╗ ██████╗  ██████╗ ██████╗ ██╗   ██╗ ██████╗████████╗
-- ██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██║   ██║██╔════╝╚══██╔══╝
-- ██████╔╝██████╔╝██║   ██║██║  ██║██║   ██║██║        ██║
-- ██╔═══╝ ██╔══██╗██║   ██║██║  ██║██║   ██║██║        ██║
-- ██║     ██║  ██║╚██████╔╝██████╔╝╚██████╔╝╚██████╗   ██║
-- NANONEURON CRM TABLES (no prefix — original schema)
-- ============================================================

create table if not exists organizations (
  id                      uuid        primary key default gen_random_uuid(),
  name                    varchar(200) not null,
  slug                    varchar(200) unique not null,
  plan                    varchar(20)  default 'starter',
  stripe_customer_id      varchar(100),
  stripe_subscription_id  varchar(100),
  created_at              timestamptz  default now(),
  updated_at              timestamptz  default now()
);

create table if not exists users (
  id                    uuid        primary key default gen_random_uuid(),
  org_id                uuid        references organizations on delete cascade not null,
  email                 varchar(255) unique not null,
  password_hash         varchar(255) not null,
  first_name            varchar(100) not null,
  last_name             varchar(100) not null,
  role                  varchar(20)  default 'viewer',
  is_active             boolean      default true,
  failed_login_attempts integer      default 0,
  locked_until          timestamptz,
  last_login_at         timestamptz,
  created_at            timestamptz  default now(),
  updated_at            timestamptz  default now()
);

create index if not exists idx_users_email  on users(email);
create index if not exists idx_users_org_id on users(org_id);

create table if not exists sessions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references users on delete cascade not null,
  token      varchar(500) unique not null,
  ip_address varchar(50),
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists idx_sessions_token on sessions(token);

create table if not exists companies (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        references organizations on delete cascade not null,
  name        varchar(300) not null,
  website     varchar(500),
  industry    varchar(100),
  country     varchar(10)  not null,
  region      varchar(100) not null,
  risk_level  varchar(20)  default 'low',
  lead_score  integer      default 50,
  sentiment   float        default 0.75,
  churn_risk  float        default 0.05,
  created_at  timestamptz  default now(),
  updated_at  timestamptz  default now()
);

create index if not exists idx_companies_org_id  on companies(org_id);
create index if not exists idx_companies_country on companies(country);

create table if not exists contacts (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        references organizations on delete cascade not null,
  company_id  uuid        references companies on delete cascade not null,
  first_name  varchar(100) not null,
  last_name   varchar(100) not null,
  email       varchar(255) not null,
  phone       varchar(50),
  title       varchar(200),
  language    varchar(10)  default 'en',
  lead_score  integer      default 50,
  sentiment   float        default 0.75,
  created_at  timestamptz  default now()
);

create index if not exists idx_contacts_org_id     on contacts(org_id);
create index if not exists idx_contacts_company_id on contacts(company_id);

create table if not exists deals (
  id             uuid        primary key default gen_random_uuid(),
  org_id         uuid        references organizations on delete cascade not null,
  owner_id       uuid        references users not null,
  company_id     uuid        references companies not null,
  title          varchar(300) not null,
  value          float        not null default 0,
  currency       varchar(5)   default 'USD',
  stage          varchar(20)  default 'lead',
  probability    integer      default 20,
  legal_status   varchar(30)  default 'pending_review',
  product        varchar(200),
  country        varchar(10)  not null,
  region         varchar(100) not null,
  expected_close date,
  actual_close   date,
  notes          text,
  sentiment      float        default 0.75,
  churn_risk     float        default 0.05,
  nlp_language   varchar(10)  default 'en',
  created_at     timestamptz  default now(),
  updated_at     timestamptz  default now()
);

create index if not exists idx_deals_org_id  on deals(org_id);
create index if not exists idx_deals_stage   on deals(org_id, stage);
create index if not exists idx_deals_country on deals(country);

create table if not exists products (
  id                   uuid        primary key default gen_random_uuid(),
  org_id               uuid        references organizations on delete cascade not null,
  name                 varchar(200) not null,
  category             varchar(100) not null,
  icon                 varchar(20),
  description          text,
  mrr                  float        default 0,
  active_users         integer      default 0,
  countries_available  integer      default 0,
  security_level       varchar(50)  default 'AES-256',
  uptime               float        default 99.99,
  features             text[]       default '{}',
  is_active            boolean      default true,
  created_at           timestamptz  default now()
);

create table if not exists country_configs (
  id               uuid        primary key default gen_random_uuid(),
  org_id           uuid        references organizations on delete cascade not null,
  code             varchar(5)   not null,
  name             varchar(100) not null,
  region           varchar(100) not null,
  currency         varchar(10)  not null,
  data_center      varchar(200),
  risk_level       varchar(20)  default 'low',
  compliance_list  text[]       default '{}',
  gdpr_applicable  boolean      default false,
  clients          integer      default 0,
  revenue          float        default 0,
  deals            integer      default 0,
  lead_score       integer      default 70,
  sentiment        float        default 0.75,
  churn_risk       float        default 0.08,
  is_active        boolean      default true,
  created_at       timestamptz  default now()
);

create table if not exists audit_logs (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        references organizations not null,
  user_id     uuid        references users not null,
  action      varchar(100) not null,
  entity      varchar(100) not null,
  entity_id   uuid,
  details     jsonb,
  ip_address  varchar(50),
  status      varchar(30)  default 'completed',
  created_at  timestamptz  default now()
);

create index if not exists idx_audit_logs_org_id     on audit_logs(org_id);
create index if not exists idx_audit_logs_user_id    on audit_logs(user_id);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);

create table if not exists invoices (
  id                 uuid        primary key default gen_random_uuid(),
  org_id             uuid        references organizations on delete cascade not null,
  stripe_invoice_id  varchar(100),
  amount             float        not null,
  currency           varchar(5)   default 'USD',
  status             varchar(30)  default 'pending',
  pdf_url            text,
  created_at         timestamptz  default now()
);

-- ============================================================
-- ███████╗██╗ ██████╗ ███╗   ██╗ █████╗ ██╗
-- ██╔════╝██║██╔════╝ ████╗  ██║██╔══██╗██║
-- ███████╗██║██║  ███╗██╔██╗ ██║███████║██║
-- ╚════██║██║██║   ██║██║╚██╗██║██╔══██║██║
-- ███████║██║╚██████╔╝██║ ╚████║██║  ██║███████╗
-- SIGNAL CRM TABLES (sig_ prefix)
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
-- Nanoneuron tables: open (backend uses service_role)
-- Signal CRM tables: open (backend uses service_role)
-- ============================================================

alter table organizations         enable row level security;
alter table users                 enable row level security;
alter table sessions              enable row level security;
alter table companies             enable row level security;
alter table contacts              enable row level security;
alter table deals                 enable row level security;
alter table products              enable row level security;
alter table country_configs       enable row level security;
alter table audit_logs            enable row level security;
alter table invoices              enable row level security;

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

-- Nanoneuron CRM policies (service_role bypass)
drop policy if exists "nn_orgs_all"         on organizations;
drop policy if exists "nn_users_all"        on users;
drop policy if exists "nn_sessions_all"     on sessions;
drop policy if exists "nn_companies_all"    on companies;
drop policy if exists "nn_contacts_all"     on contacts;
drop policy if exists "nn_deals_all"        on deals;
drop policy if exists "nn_products_all"     on products;
drop policy if exists "nn_cc_all"           on country_configs;
drop policy if exists "nn_audit_all"        on audit_logs;
drop policy if exists "nn_invoices_all"     on invoices;

create policy "nn_orgs_all"      on organizations    for all using (true) with check (true);
create policy "nn_users_all"     on users            for all using (true) with check (true);
create policy "nn_sessions_all"  on sessions         for all using (true) with check (true);
create policy "nn_companies_all" on companies        for all using (true) with check (true);
create policy "nn_contacts_all"  on contacts         for all using (true) with check (true);
create policy "nn_deals_all"     on deals            for all using (true) with check (true);
create policy "nn_products_all"  on products         for all using (true) with check (true);
create policy "nn_cc_all"        on country_configs  for all using (true) with check (true);
create policy "nn_audit_all"     on audit_logs       for all using (true) with check (true);
create policy "nn_invoices_all"  on invoices         for all using (true) with check (true);

-- Signal CRM policies (service_role bypass)
drop policy if exists "sig_users_all"       on sig_users;
drop policy if exists "sig_subs_all"        on sig_subscriptions;
drop policy if exists "sig_txn_all"         on sig_payment_transactions;
drop policy if exists "sig_watchlist_all"   on sig_watchlist_accounts;
drop policy if exists "sig_tracked_all"     on sig_tracked_pages;
drop policy if exists "sig_signals_all"     on sig_web_signals;
drop policy if exists "sig_snapshots_all"   on sig_page_snapshots;
drop policy if exists "sig_deals_all"       on sig_deals;
drop policy if exists "sig_leads_all"       on sig_leads;
drop policy if exists "sig_compliance_all"  on sig_compliance_saves;
drop policy if exists "sig_scrape_all"      on sig_scrape_jobs;
drop policy if exists "sig_audit_all"       on sig_audit_logs;

create policy "sig_users_all"      on sig_users               for all using (true) with check (true);
create policy "sig_subs_all"       on sig_subscriptions        for all using (true) with check (true);
create policy "sig_txn_all"        on sig_payment_transactions  for all using (true) with check (true);
create policy "sig_watchlist_all"  on sig_watchlist_accounts   for all using (true) with check (true);
create policy "sig_tracked_all"    on sig_tracked_pages        for all using (true) with check (true);
create policy "sig_signals_all"    on sig_web_signals          for all using (true) with check (true);
create policy "sig_snapshots_all"  on sig_page_snapshots       for all using (true) with check (true);
create policy "sig_deals_all"      on sig_deals                for all using (true) with check (true);
create policy "sig_leads_all"      on sig_leads                for all using (true) with check (true);
create policy "sig_compliance_all" on sig_compliance_saves     for all using (true) with check (true);
create policy "sig_scrape_all"     on sig_scrape_jobs          for all using (true) with check (true);
create policy "sig_audit_all"      on sig_audit_logs           for all using (true) with check (true);

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Nanoneuron updated_at
create or replace function nn_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_nn_orgs_updated_at      on organizations;
drop trigger if exists trg_nn_users_updated_at     on users;
drop trigger if exists trg_nn_companies_updated_at on companies;
drop trigger if exists trg_nn_deals_updated_at     on deals;

create trigger trg_nn_orgs_updated_at      before update on organizations   for each row execute function nn_set_updated_at();
create trigger trg_nn_users_updated_at     before update on users           for each row execute function nn_set_updated_at();
create trigger trg_nn_companies_updated_at before update on companies       for each row execute function nn_set_updated_at();
create trigger trg_nn_deals_updated_at     before update on deals           for each row execute function nn_set_updated_at();

-- Signal CRM updated_at
create or replace function sig_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_sig_users_updated_at         on sig_users;
drop trigger if exists trg_sig_subscriptions_updated_at on sig_subscriptions;
drop trigger if exists trg_sig_deals_updated_at         on sig_deals;

create trigger trg_sig_users_updated_at         before update on sig_users          for each row execute function sig_set_updated_at();
create trigger trg_sig_subscriptions_updated_at before update on sig_subscriptions   for each row execute function sig_set_updated_at();
create trigger trg_sig_deals_updated_at         before update on sig_deals           for each row execute function sig_set_updated_at();

-- Signal CRM: deduct credits helper
create or replace function sig_deduct_credit(p_user_id text, p_amount integer default 1)
returns boolean language plpgsql security definer as $$
declare v_credits integer;
begin
  select credits into v_credits from sig_users where id = p_user_id for update;
  if v_credits is null or v_credits < p_amount then return false; end if;
  update sig_users set credits = credits - p_amount where id = p_user_id;
  return true;
end; $$;

-- ============================================================
-- VERIFY: run after migration
-- ============================================================
-- select table_name from information_schema.tables
-- where table_schema = 'public'
-- order by table_name;
--
-- Nanoneuron tables: audit_logs, companies, contacts, country_configs,
--                    deals, invoices, organizations, products, sessions, users
-- Signal CRM tables: sig_audit_logs, sig_compliance_saves, sig_deals,
--                    sig_leads, sig_page_snapshots, sig_payment_transactions,
--                    sig_scrape_jobs, sig_subscriptions, sig_tracked_pages,
--                    sig_users, sig_watchlist_accounts, sig_web_signals
