-- Alert webhooks registered from /app/developers. Written by the web API with the service role,
-- read by the monitor. The secret signs deliveries (HMAC-SHA256); keep this table service-role only.
create table if not exists public.un_webhooks (
  id bigint generated always as identity primary key,
  owner text not null,
  url text not null,
  events text[] not null,
  low_balance_threshold numeric(38, 0) not null,
  secret text not null,
  created_at timestamptz not null default now(),
  constraint un_webhooks_owner_url unique (owner, url),
  constraint un_webhooks_https check (url like 'https://%')
);
alter table public.un_webhooks enable row level security;

-- Delivery log, used for retries and to avoid duplicate alerts.
create table if not exists public.un_webhook_deliveries (
  id bigint generated always as identity primary key,
  webhook_id bigint not null references public.un_webhooks(id) on delete cascade,
  event_key text not null,
  status int,
  attempts int not null default 0,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint un_webhook_deliveries_once unique (webhook_id, event_key)
);
alter table public.un_webhook_deliveries enable row level security;

-- Protocol alerts already sent to the ops channel (dedupe across monitor runs).
create table if not exists public.un_ops_alerts (
  key text primary key,
  severity text not null,
  text text not null,
  created_at timestamptz not null default now()
);
alter table public.un_ops_alerts enable row level security;
