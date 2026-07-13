-- Add real accounts, backend sessions, organisation codes, and account usage tracking.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  password_salt text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists auth_sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent text,
  revoked_at timestamptz
);

create table if not exists organisation_codes (
  code_hash text primary key,
  label text not null,
  is_active boolean not null default true,
  max_users integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists user_organisation_codes (
  user_id uuid not null references users(id) on delete cascade,
  code_hash text not null references organisation_codes(code_hash) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, code_hash)
);

create table if not exists account_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  receipt_ref text unique not null,
  transaction_ref text unique not null,
  plan_id text not null references subscription_plans(id),
  amount_rwf integer not null check (amount_rwf > 0),
  status text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  gpt5_daily_minutes integer not null default 0 check (gpt5_daily_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists account_daily_model_usage (
  user_id uuid not null references users(id) on delete cascade,
  usage_date date not null,
  model_id text not null references ai_models(id),
  used_ms bigint not null default 0 check (used_ms >= 0),
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date, model_id)
);

alter table pending_subscriptions add column if not exists user_id uuid references users(id) on delete set null;
alter table entitlements add column if not exists user_id uuid references users(id) on delete set null;
alter table model_requests add column if not exists user_id uuid references users(id) on delete set null;
alter table payment_events add column if not exists user_id uuid references users(id) on delete set null;

create index if not exists idx_auth_sessions_user_id on auth_sessions(user_id);
create index if not exists idx_auth_sessions_expires_at on auth_sessions(expires_at);
create index if not exists idx_users_email on users(email);
create index if not exists idx_account_entitlements_user_id on account_entitlements(user_id);
create index if not exists idx_account_entitlements_expires_at on account_entitlements(expires_at);
create index if not exists idx_account_daily_model_usage_date on account_daily_model_usage(usage_date);
