-- ============================================================
-- SIGNAL CRM — v2.0 WORLD-CLASS SCHEMA MIGRATION
-- Run AFTER combined_schema.sql
-- Adds: contacts, accounts, activities, tasks, pipelines,
--       sequences, notifications, ai_insights
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- trigram search on text fields

-- ============================================================
-- sig_accounts — Company / Account management
-- ============================================================
create table if not exists sig_accounts (
  id            text        primary key default gen_random_uuid()::text,
  user_id       text        references sig_users(id) on delete cascade not null,
  name          text        not null,
  domain        text        not null default '',
  industry      text        not null default '',
  country       text        not null default '',
  city          text        not null default '',
  employees     text        not null default '',   -- '1-10','11-50','51-200','201-500','500+'
  revenue_range text        not null default '',   -- '<$1M','$1M-$10M',etc.
  phone         text        not null default '',
  linkedin      text        not null default '',
  website       text        not null default '',
  stage         text        not null default 'prospect',  -- prospect|customer|partner|churned
  health_score  integer     not null default 75,   -- 0-100 AI-computed
  churn_risk    float       not null default 0.1,  -- 0-1
  arr           float       not null default 0,    -- Annual Recurring Revenue (INR)
  tags          text        not null default '[]', -- JSON array of strings
  notes         text        not null default '',
  assigned_to   text        references sig_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_sig_accounts_user_id on sig_accounts(user_id);
create index if not exists idx_sig_accounts_stage   on sig_accounts(user_id, stage);
create index if not exists idx_sig_accounts_country on sig_accounts(country);
create index if not exists idx_sig_accounts_name_trgm on sig_accounts using gin (name gin_trgm_ops);

-- ============================================================
-- sig_contacts — People / Contact management
-- ============================================================
create table if not exists sig_contacts (
  id              text        primary key default gen_random_uuid()::text,
  user_id         text        references sig_users(id) on delete cascade not null,
  account_id      text        references sig_accounts(id) on delete set null,
  deal_id         text        references sig_deals(id) on delete set null,
  first_name      text        not null default '',
  last_name       text        not null default '',
  email           text        not null default '',
  phone           text        not null default '',
  title           text        not null default '',
  department      text        not null default '',
  linkedin        text        not null default '',
  twitter         text        not null default '',
  country         text        not null default '',
  timezone        text        not null default '',
  language        text        not null default 'en',
  lead_score      integer     not null default 50,  -- 0-100 AI score
  health_score    integer     not null default 75,  -- 0-100 relationship health
  stage           text        not null default 'prospect', -- prospect|mql|sql|opportunity|customer|churned
  source          text        not null default 'manual',   -- manual|signal|import|form|linkedin
  tags            text        not null default '[]',
  notes           text        not null default '',
  is_unsubscribed boolean     not null default false,
  last_contacted  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_sig_contacts_user_id    on sig_contacts(user_id);
create index if not exists idx_sig_contacts_account_id on sig_contacts(account_id);
create index if not exists idx_sig_contacts_stage      on sig_contacts(user_id, stage);
create index if not exists idx_sig_contacts_email      on sig_contacts(user_id, email);
create index if not exists idx_sig_contacts_score      on sig_contacts(user_id, lead_score desc);
create index if not exists idx_sig_contacts_name_trgm  on sig_contacts using gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- ============================================================
-- sig_activities — Unified interaction timeline
-- ============================================================
create table if not exists sig_activities (
  id            text        primary key default gen_random_uuid()::text,
  user_id       text        references sig_users(id) on delete cascade not null,
  contact_id    text        references sig_contacts(id) on delete set null,
  account_id    text        references sig_accounts(id) on delete set null,
  deal_id       text        references sig_deals(id) on delete set null,
  type          text        not null default 'note',      -- call|email|meeting|note|linkedin|whatsapp|demo
  direction     text        not null default 'outbound',  -- inbound|outbound
  title         text        not null default '',
  body          text        not null default '',
  outcome       text        not null default '',          -- connected|voicemail|no_answer|meeting_booked|demo_done|replied|opened
  duration_secs integer     not null default 0,
  scheduled_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_sig_activities_user_id    on sig_activities(user_id);
create index if not exists idx_sig_activities_contact_id on sig_activities(contact_id);
create index if not exists idx_sig_activities_deal_id    on sig_activities(deal_id);
create index if not exists idx_sig_activities_created_at on sig_activities(user_id, created_at desc);
create index if not exists idx_sig_activities_type       on sig_activities(user_id, type);

-- ============================================================
-- sig_tasks — Follow-up task management
-- ============================================================
create table if not exists sig_tasks (
  id            text        primary key default gen_random_uuid()::text,
  user_id       text        references sig_users(id) on delete cascade not null,
  contact_id    text        references sig_contacts(id) on delete set null,
  account_id    text        references sig_accounts(id) on delete set null,
  deal_id       text        references sig_deals(id) on delete set null,
  title         text        not null,
  description   text        not null default '',
  priority      text        not null default 'medium',  -- low|medium|high|urgent
  status        text        not null default 'open',    -- open|in_progress|done|cancelled
  due_date      date,
  reminder_at   timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_sig_tasks_user_id   on sig_tasks(user_id);
create index if not exists idx_sig_tasks_status    on sig_tasks(user_id, status);
create index if not exists idx_sig_tasks_due_date  on sig_tasks(user_id, due_date);
create index if not exists idx_sig_tasks_priority  on sig_tasks(user_id, priority);
create index if not exists idx_sig_tasks_contact   on sig_tasks(contact_id);
create index if not exists idx_sig_tasks_deal      on sig_tasks(deal_id);

-- ============================================================
-- sig_pipelines — Multiple pipeline definitions
-- ============================================================
create table if not exists sig_pipelines (
  id            text        primary key default gen_random_uuid()::text,
  user_id       text        references sig_users(id) on delete cascade not null,
  name          text        not null,
  currency      text        not null default 'INR',
  is_default    boolean     not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_sig_pipelines_user_id on sig_pipelines(user_id);

-- ============================================================
-- sig_pipeline_stages — Custom stages per pipeline
-- ============================================================
create table if not exists sig_pipeline_stages (
  id            text        primary key default gen_random_uuid()::text,
  pipeline_id   text        references sig_pipelines(id) on delete cascade not null,
  name          text        not null,
  order_num     integer     not null default 0,
  probability   integer     not null default 50,
  color         text        not null default '#6366f1',
  created_at    timestamptz not null default now()
);

create index if not exists idx_sig_stages_pipeline_id on sig_pipeline_stages(pipeline_id);

-- ============================================================
-- sig_sequences — Email / outreach sequences
-- ============================================================
create table if not exists sig_sequences (
  id              text        primary key default gen_random_uuid()::text,
  user_id         text        references sig_users(id) on delete cascade not null,
  name            text        not null,
  description     text        not null default '',
  status          text        not null default 'draft',  -- draft|active|paused
  steps_count     integer     not null default 0,
  enrolled_count  integer     not null default 0,
  open_rate       float       not null default 0,
  reply_rate      float       not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_sig_sequences_user_id on sig_sequences(user_id);
create index if not exists idx_sig_sequences_status  on sig_sequences(user_id, status);

-- ============================================================
-- sig_sequence_steps — Individual steps in a sequence
-- ============================================================
create table if not exists sig_sequence_steps (
  id            text        primary key default gen_random_uuid()::text,
  sequence_id   text        references sig_sequences(id) on delete cascade not null,
  order_num     integer     not null default 1,
  type          text        not null default 'email',  -- email|wait|call|linkedin|task
  subject       text        not null default '',
  body          text        not null default '',
  delay_days    integer     not null default 1,
  created_at    timestamptz not null default now()
);

create index if not exists idx_sig_seq_steps_sequence on sig_sequence_steps(sequence_id, order_num);

-- ============================================================
-- sig_sequence_enrollments — Contacts enrolled in sequences
-- ============================================================
create table if not exists sig_sequence_enrollments (
  id            text        primary key default gen_random_uuid()::text,
  sequence_id   text        references sig_sequences(id) on delete cascade not null,
  contact_id    text        references sig_contacts(id) on delete cascade not null,
  status        text        not null default 'active',  -- active|paused|completed|unenrolled
  current_step  integer     not null default 0,
  started_at    timestamptz not null default now(),
  next_step_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (sequence_id, contact_id)
);

create index if not exists idx_sig_enrollments_sequence  on sig_sequence_enrollments(sequence_id);
create index if not exists idx_sig_enrollments_contact   on sig_sequence_enrollments(contact_id);
create index if not exists idx_sig_enrollments_status    on sig_sequence_enrollments(status);

-- ============================================================
-- sig_notifications — In-app notification feed
-- ============================================================
create table if not exists sig_notifications (
  id            text        primary key default gen_random_uuid()::text,
  user_id       text        references sig_users(id) on delete cascade not null,
  type          text        not null default 'info',  -- info|warning|success|signal|task_due|deal_moved
  title         text        not null,
  body          text        not null default '',
  entity_type   text        not null default '',      -- signal|deal|task|contact|account
  entity_id     text        not null default '',
  is_read       boolean     not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_sig_notifs_user_id    on sig_notifications(user_id);
create index if not exists idx_sig_notifs_unread     on sig_notifications(user_id, is_read) where is_read = false;
create index if not exists idx_sig_notifs_created_at on sig_notifications(user_id, created_at desc);

-- ============================================================
-- sig_ai_insights — Cached AI-generated insights
-- ============================================================
create table if not exists sig_ai_insights (
  id            text        primary key default gen_random_uuid()::text,
  user_id       text        references sig_users(id) on delete cascade not null,
  entity_type   text        not null default '',      -- contact|deal|account|pipeline
  entity_id     text        not null default '',
  insight_type  text        not null default '',      -- score|recommendation|risk|opportunity|forecast
  title         text        not null default '',
  body          text        not null default '',
  score         integer,
  confidence    float       default 0.8,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_sig_insights_user_id on sig_ai_insights(user_id);
create index if not exists idx_sig_insights_entity  on sig_ai_insights(entity_type, entity_id);
create index if not exists idx_sig_insights_type    on sig_ai_insights(user_id, insight_type);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
create or replace function sig_set_updated_at_v2()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_sig_accounts_updated_at  on sig_accounts;
drop trigger if exists trg_sig_contacts_updated_at  on sig_contacts;
drop trigger if exists trg_sig_tasks_updated_at     on sig_tasks;
drop trigger if exists trg_sig_sequences_updated_at on sig_sequences;

create trigger trg_sig_accounts_updated_at  before update on sig_accounts  for each row execute function sig_set_updated_at_v2();
create trigger trg_sig_contacts_updated_at  before update on sig_contacts  for each row execute function sig_set_updated_at_v2();
create trigger trg_sig_tasks_updated_at     before update on sig_tasks     for each row execute function sig_set_updated_at_v2();
create trigger trg_sig_sequences_updated_at before update on sig_sequences for each row execute function sig_set_updated_at_v2();

-- ============================================================
-- ROW LEVEL SECURITY (open — backend uses service_role)
-- ============================================================
alter table sig_accounts              enable row level security;
alter table sig_contacts              enable row level security;
alter table sig_activities            enable row level security;
alter table sig_tasks                 enable row level security;
alter table sig_pipelines             enable row level security;
alter table sig_pipeline_stages       enable row level security;
alter table sig_sequences             enable row level security;
alter table sig_sequence_steps        enable row level security;
alter table sig_sequence_enrollments  enable row level security;
alter table sig_notifications         enable row level security;
alter table sig_ai_insights           enable row level security;

drop policy if exists "sig_accounts_all"     on sig_accounts;
drop policy if exists "sig_contacts_all"     on sig_contacts;
drop policy if exists "sig_activities_all"   on sig_activities;
drop policy if exists "sig_tasks_all"        on sig_tasks;
drop policy if exists "sig_pipelines_all"    on sig_pipelines;
drop policy if exists "sig_stages_all"       on sig_pipeline_stages;
drop policy if exists "sig_sequences_all"    on sig_sequences;
drop policy if exists "sig_seq_steps_all"    on sig_sequence_steps;
drop policy if exists "sig_enrollments_all"  on sig_sequence_enrollments;
drop policy if exists "sig_notifs_all"       on sig_notifications;
drop policy if exists "sig_insights_all"     on sig_ai_insights;

create policy "sig_accounts_all"     on sig_accounts             for all using (true) with check (true);
create policy "sig_contacts_all"     on sig_contacts             for all using (true) with check (true);
create policy "sig_activities_all"   on sig_activities           for all using (true) with check (true);
create policy "sig_tasks_all"        on sig_tasks                for all using (true) with check (true);
create policy "sig_pipelines_all"    on sig_pipelines            for all using (true) with check (true);
create policy "sig_stages_all"       on sig_pipeline_stages      for all using (true) with check (true);
create policy "sig_sequences_all"    on sig_sequences            for all using (true) with check (true);
create policy "sig_seq_steps_all"    on sig_sequence_steps       for all using (true) with check (true);
create policy "sig_enrollments_all"  on sig_sequence_enrollments for all using (true) with check (true);
create policy "sig_notifs_all"       on sig_notifications        for all using (true) with check (true);
create policy "sig_insights_all"     on sig_ai_insights          for all using (true) with check (true);

-- ============================================================
-- VERIFY (run after migration)
-- ============================================================
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name like 'sig_%'
-- order by table_name;
--
-- New v2 tables:
--   sig_accounts, sig_activities, sig_ai_insights,
--   sig_contacts, sig_notifications, sig_pipeline_stages,
--   sig_pipelines, sig_sequence_enrollments,
--   sig_sequence_steps, sig_sequences, sig_tasks
