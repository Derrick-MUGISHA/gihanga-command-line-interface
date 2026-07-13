-- Upskillsafrica AI backend schema for Neon/Postgres.
-- Stores subscription plans, payment references, entitlements, model catalog,
-- daily GPT-5 quota usage, and audit events.

create extension if not exists pgcrypto;

create table if not exists subscription_plans (
  id text primary key,
  name text not null,
  amount_rwf integer not null check (amount_rwf > 0),
  duration_minutes integer not null check (duration_minutes > 0),
  gpt5_daily_minutes integer not null default 0 check (gpt5_daily_minutes >= 0),
  is_active boolean not null default true,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_models (
  id text primary key,
  display_name text not null,
  source text not null check (source in ('azure_models', 'openrouter')),
  provider_model_id text not null,
  deployment text,
  version text,
  price_tier text not null check (price_tier in ('free', 'premium')),
  capabilities text[] not null default array[]::text[],
  is_active boolean not null default true,
  is_gpt5 boolean not null default false,
  daily_quota_required boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pending_subscriptions (
  transaction_ref text primary key,
  plan_id text not null references subscription_plans(id),
  phone text not null,
  amount_rwf integer not null check (amount_rwf > 0),
  status text not null default 'pending',
  payment_provider text not null default 'paypack',
  payment_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entitlements (
  receipt_ref text primary key,
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

create table if not exists daily_model_usage (
  receipt_ref text not null references entitlements(receipt_ref) on delete cascade,
  usage_date date not null,
  model_id text not null references ai_models(id),
  used_ms bigint not null default 0 check (used_ms >= 0),
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (receipt_ref, usage_date, model_id)
);

create table if not exists model_requests (
  id uuid primary key default gen_random_uuid(),
  receipt_ref text references entitlements(receipt_ref) on delete set null,
  model_id text references ai_models(id) on delete set null,
  source text not null,
  status text not null,
  elapsed_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  transaction_ref text not null,
  event_kind text not null default 'unknown',
  status text not null default 'unknown',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_entitlements_expires_at on entitlements(expires_at);
create index if not exists idx_entitlements_status on entitlements(status);
create index if not exists idx_pending_subscriptions_status on pending_subscriptions(status);
create index if not exists idx_daily_model_usage_date on daily_model_usage(usage_date);
create index if not exists idx_model_requests_created_at on model_requests(created_at);
create index if not exists idx_payment_events_transaction_ref on payment_events(transaction_ref);

insert into subscription_plans (id, name, amount_rwf, duration_minutes, gpt5_daily_minutes, description)
values
  ('thirty_minutes', 'Upskillsafrica AI 30 Minutes', 3000, 30, 30, '3000 RWF starts 30 minutes of Upskillsafrica AI access.'),
  ('hourly', 'Upskillsafrica AI Hour', 5000, 60, 60, '5000 RWF starts one hour of Upskillsafrica AI access.'),
  ('twelve_days', 'Upskillsafrica AI 12 Days', 20000, 17280, 120, '20000 RWF gives 12 days. gpt-5 is limited; use other models for the rest of the day.'),
  ('monthly', 'Upskillsafrica AI Monthly', 53000, 43200, 300, '53000 RWF gives 30 days with gpt-5 limited to 5 hours/day.')
on conflict (id) do update set
  name = excluded.name,
  amount_rwf = excluded.amount_rwf,
  duration_minutes = excluded.duration_minutes,
  gpt5_daily_minutes = excluded.gpt5_daily_minutes,
  description = excluded.description,
  updated_at = now();

insert into ai_models (id, display_name, source, provider_model_id, deployment, version, price_tier, capabilities, is_gpt5, daily_quota_required, metadata)
values
  ('azure_models/gpt-5', 'Azure gpt-5 (premium)', 'azure_models', 'gpt-5', 'gpt-5', '2025-08-07', 'premium', array['chat','code','reasoning'], true, true, '{"deploymentType":"Global Standard","status":"Succeeded"}'::jsonb),
  ('azure_models/o3', 'Azure o3 (premium reasoning)', 'azure_models', 'o3', 'o3', '2025-04-16', 'premium', array['chat','code','reasoning'], false, false, '{"deploymentType":"Global Standard","status":"Succeeded"}'::jsonb),
  ('azure_models/gpt-4o-mini', 'Azure gpt-4o-mini (premium low-cost)', 'azure_models', 'gpt-4o-mini', 'gpt-4o-mini', '2024-07-18', 'premium', array['chat','code'], false, false, '{"deploymentType":"Global Standard","status":"Succeeded"}'::jsonb),
  ('openrouter/free', 'OpenRouter Free Models Router', 'openrouter', 'openrouter/free', null, null, 'free', array['chat','code'], false, false, '{}'::jsonb),
  ('openrouter/openai/gpt-oss-120b:free', 'OpenAI GPT OSS 120B (free)', 'openrouter', 'openai/gpt-oss-120b:free', null, null, 'free', array['chat','code'], false, false, '{}'::jsonb),
  ('openrouter/qwen/qwen3-next-80b-a3b-instruct:free', 'Qwen3 Next 80B A3B Instruct (free)', 'openrouter', 'qwen/qwen3-next-80b-a3b-instruct:free', null, null, 'free', array['chat','code'], false, false, '{}'::jsonb),
  ('openrouter/google/gemma-4-26b-a4b-it:free', 'Google Gemma 4 26B A4B IT (free)', 'openrouter', 'google/gemma-4-26b-a4b-it:free', null, null, 'free', array['chat'], false, false, '{}'::jsonb)
on conflict (id) do update set
  display_name = excluded.display_name,
  source = excluded.source,
  provider_model_id = excluded.provider_model_id,
  deployment = excluded.deployment,
  version = excluded.version,
  price_tier = excluded.price_tier,
  capabilities = excluded.capabilities,
  is_gpt5 = excluded.is_gpt5,
  daily_quota_required = excluded.daily_quota_required,
  metadata = excluded.metadata,
  updated_at = now();
