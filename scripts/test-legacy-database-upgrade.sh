#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_URL="${SUPABASE_TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
TEST_DB="neloo_legacy_upgrade_test"
TEST_URL="${ADMIN_URL%/*}/${TEST_DB}"

cleanup() {
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "drop database if exists ${TEST_DB} with (force);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "create database ${TEST_DB};" >/dev/null

psql "$TEST_URL" -v ON_ERROR_STOP=1 <<'SQL'
create extension if not exists pgcrypto;
do $$ begin
  create role anon;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role authenticated;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role service_role;
exception when duplicate_object then null;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text not null
);
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
insert into auth.users(id, email)
values ('11111111-1111-4111-8111-111111111111', 'fixture@example.test');
SQL

legacy_files=(
  backend/supabase/migrations/001_create_tables.sql
  backend/supabase/migrations/002_storage_policies.sql
  backend/supabase/migrations/002_update_files_schema.sql
  backend/supabase/migrations/003_add_file_types.sql
  backend/supabase/migrations/004_add_threads_unique_constraint.sql
  backend/supabase/migrations/005_add_thread_mode.sql
  backend/supabase/migrations/006_add_thread_model_id.sql
  backend/supabase/migrations/007_add_shared_conversations.sql
  backend/supabase/migrations/008_create_slide_presentations.sql
  backend/supabase/migrations/20260120_user_integrations.sql
  backend/supabase/migrations/20260120_integration_action_logs.sql
  backend/supabase/migrations/20260120_integration_action_logs_update.sql
  backend/migrations/001_chat_messages.sql
  backend/migrations/002_message_branching.sql
  backend/migrations/002_persist_chat_message_rpc.sql
  backend/migrations/003_oauth_state.sql
  backend/migrations/004_fix_action_logs_fields.sql
  backend/migrations/create_upload_sessions.sql
  supabase/migrations/20260131_agents_system.sql
  supabase/migrations/20260201_add_favorite_count.sql
  supabase/migrations/202602010001_user_profiles.sql
  supabase/migrations/20260702_create_slide_presentations.sql
)

for file in "${legacy_files[@]}"; do
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -f "$ROOT/$file" >/dev/null
done

psql "$TEST_URL" -v ON_ERROR_STOP=1 <<'SQL'
insert into public.threads(id, user_id, title, langgraph_thread_id)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Legacy fixture',
  'legacy-thread'
);
insert into public.files(id, user_id, filename, original_filename, storage_path, file_type)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'fixture.txt',
  'fixture.txt',
  'fixture/fixture.txt',
  'uploaded'
);
SQL

psql "$TEST_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/supabase/migrations/20260712090000_canonical_schema.sql" >/dev/null

psql "$TEST_URL" -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  thread_count integer;
  file_count integer;
begin
  select count(*) into thread_count
    from public.threads where langgraph_thread_id = 'legacy-thread';
  select count(*) into file_count
    from public.files where filename = 'fixture.txt';
  if thread_count <> 1 or file_count <> 1 then
    raise exception 'legacy data was not preserved (threads=%, files=%)', thread_count, file_count;
  end if;
end;
$$;
select 'legacy upgrade OK';
SQL
