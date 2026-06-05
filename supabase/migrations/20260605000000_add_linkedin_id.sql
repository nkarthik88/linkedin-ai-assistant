-- Add linkedin_id column to both account tables for anti-bypass tracking.
-- Graceful: column is nullable so existing rows are unaffected.

alter table extension_accounts
  add column if not exists linkedin_id text;

alter table users
  add column if not exists linkedin_id text;

create index if not exists idx_extension_accounts_linkedin_id
  on extension_accounts (linkedin_id)
  where linkedin_id is not null;

create index if not exists idx_users_linkedin_id
  on users (linkedin_id)
  where linkedin_id is not null;
