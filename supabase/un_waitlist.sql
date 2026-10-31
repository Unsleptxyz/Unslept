-- Unslept waitlist. Prefixed table so it can live in a shared Supabase project.
create table if not exists public.un_waitlist (
  id bigint generated always as identity primary key,
  email text not null,
  wallet text,
  created_at timestamptz not null default now(),
  constraint un_waitlist_email_unique unique (email),
  constraint un_waitlist_email_format check (position('@' in email) > 1 and length(email) <= 254),
  constraint un_waitlist_wallet_format check (wallet is null or wallet ~ '^0x[a-fA-F0-9]{40}$')
);

-- Only the server (service role) writes. No public access.
alter table public.un_waitlist enable row level security;
