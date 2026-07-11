create extension if not exists pgcrypto;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Task',
  langgraph_thread_id text,
  mode text not null default 'default',
  model_id text,
  parent_thread_id text,
  fork_target_ai_message_id text,
  fork_anchor_human_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint threads_mode_check check (mode in ('default', 'web-dev')),
  constraint threads_user_langgraph_unique unique (user_id, langgraph_thread_id)
);

alter table public.threads add column if not exists mode text not null default 'default';
alter table public.threads add column if not exists model_id text;
alter table public.threads add column if not exists parent_thread_id text;
alter table public.threads add column if not exists fork_target_ai_message_id text;
alter table public.threads add column if not exists fork_anchor_human_message_id text;
alter table public.threads add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.threads'::regclass
      and conname = 'threads_user_langgraph_unique'
  ) then
    alter table public.threads
      add constraint threads_user_langgraph_unique unique (user_id, langgraph_thread_id);
  end if;
end;
$$;

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  original_filename text,
  storage_path text not null,
  bucket text,
  download_url text,
  file_size bigint,
  content_type text,
  file_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint files_file_type_check
    check (file_type in ('uploaded', 'generated', 'chart', 'code'))
);

alter table public.files add column if not exists original_filename text;
alter table public.files add column if not exists bucket text;
alter table public.files add column if not exists download_url text;
alter table public.files add column if not exists updated_at timestamptz not null default now();
update public.files set original_filename = filename where original_filename is null;
alter table public.files drop constraint if exists files_file_type_check;
alter table public.files add constraint files_file_type_check
  check (file_type in ('uploaded', 'generated', 'chart', 'code'));

create table if not exists public.thread_files (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint thread_files_thread_file_unique unique (thread_id, file_id)
);

create table if not exists public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  filename text not null,
  expected_size integer not null,
  actual_size integer,
  storage_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'uploaded', 'committed', 'error')),
  committed boolean not null default false,
  thread_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  message_id text not null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  message_data jsonb not null,
  seq integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_messages_thread_message_unique unique (thread_id, message_id),
  constraint chat_messages_thread_seq_unique unique (thread_id, seq)
);

create table if not exists public.thread_seq (
  thread_id text primary key,
  next_seq integer not null default 1
);

create table if not exists public.shared_conversations (
  id uuid primary key default gen_random_uuid(),
  share_id text not null unique,
  thread_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_ai_message_id text,
  created_at timestamptz not null default now()
);
alter table public.shared_conversations add column if not exists target_ai_message_id text;

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'agent',
  description text not null,
  system_prompt text not null,
  tools jsonb not null default '["search_web"]'::jsonb,
  is_public boolean not null default false,
  usage_count integer not null default 0,
  favorite_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.agents add column if not exists favorite_count integer not null default 0;

create table if not exists public.scheduled_triggers (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  cron_expression text not null,
  timezone text not null default 'UTC',
  default_prompt text,
  notification_method text not null default 'in_app'
    check (notification_method in ('email', 'in_app', 'none')),
  enabled boolean not null default true,
  status text not null default 'idle'
    check (status in ('idle', 'dispatching', 'running')),
  last_run timestamptz,
  next_run timestamptz,
  missed_policy text not null default 'skip'
    check (missed_policy in ('skip', 'run_once')),
  created_at timestamptz not null default now()
);

create table if not exists public.trigger_execution_logs (
  id uuid primary key default gen_random_uuid(),
  trigger_id uuid not null references public.scheduled_triggers(id) on delete cascade,
  run_id text not null,
  thread_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'success', 'failed')),
  error_message text,
  constraint trigger_execution_logs_trigger_run_unique unique (trigger_id, run_id)
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.slide_presentations (
  id uuid primary key,
  user_id text not null,
  title text not null default 'Untitled',
  topic text not null,
  slides jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  style jsonb,
  preset_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  app_name varchar(50) not null,
  composio_connection_id varchar(255),
  status varchar(20) not null default 'pending',
  oauth_state text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_integrations_user_app_unique unique (user_id, app_name)
);
alter table public.user_integrations add column if not exists oauth_state text;

create table if not exists public.integration_action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  thread_id text,
  idempotency_key text,
  app_name varchar(50) not null,
  action varchar(255) not null,
  params_hash text,
  result_id varchar(255),
  result_url text,
  raw_result jsonb,
  status varchar(20) not null default 'success',
  error_message text,
  created_at timestamptz not null default now()
);
alter table public.integration_action_logs add column if not exists raw_result jsonb;
alter table public.integration_action_logs add column if not exists result_url text;
alter table public.integration_action_logs alter column idempotency_key type text;
alter table public.integration_action_logs alter column action type varchar(255);
alter table public.integration_action_logs alter column params_hash type text;

create index if not exists idx_threads_user_id on public.threads(user_id);
create index if not exists idx_threads_langgraph_id on public.threads(langgraph_thread_id);
create index if not exists idx_threads_parent_thread_id on public.threads(parent_thread_id);
create index if not exists idx_threads_model_id on public.threads(model_id);
create index if not exists idx_files_user_id on public.files(user_id);
create index if not exists idx_files_file_type on public.files(file_type);
create index if not exists idx_thread_files_thread_id on public.thread_files(thread_id);
create index if not exists idx_thread_files_file_id on public.thread_files(file_id);
create index if not exists idx_upload_sessions_user_id on public.upload_sessions(user_id);
create index if not exists idx_upload_sessions_cleanup on public.upload_sessions(committed, expires_at);
create index if not exists idx_chat_messages_thread_seq on public.chat_messages(thread_id, seq);
create index if not exists idx_shared_conversations_share_id on public.shared_conversations(share_id);
create index if not exists idx_agents_user on public.agents(user_id);
create index if not exists idx_agents_public on public.agents(is_public) where is_public;
create index if not exists idx_triggers_user on public.scheduled_triggers(user_id);
create index if not exists idx_triggers_next_run on public.scheduled_triggers(next_run) where enabled;
create index if not exists idx_logs_trigger on public.trigger_execution_logs(trigger_id);
create index if not exists idx_slide_presentations_user_updated on public.slide_presentations(user_id, updated_at desc);
create index if not exists idx_user_integrations_user on public.user_integrations(user_id);
create unique index if not exists idx_user_integrations_oauth_state
  on public.user_integrations(oauth_state) where oauth_state is not null;
create index if not exists idx_integration_action_logs_idem
  on public.integration_action_logs(user_id, idempotency_key);

drop trigger if exists update_threads_updated_at on public.threads;
create trigger update_threads_updated_at before update on public.threads
for each row execute function public.update_updated_at_column();
drop trigger if exists update_files_updated_at on public.files;
create trigger update_files_updated_at before update on public.files
for each row execute function public.update_updated_at_column();
drop trigger if exists update_agents_updated_at on public.agents;
create trigger update_agents_updated_at before update on public.agents
for each row execute function public.update_updated_at_column();

create or replace function public.persist_chat_message(
  p_thread_id text,
  p_message_id text,
  p_role text,
  p_message_data jsonb
) returns table (
  id uuid,
  thread_id text,
  message_id text,
  role text,
  seq integer,
  message_data jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
as $$
declare
  v_result record;
  v_next_seq integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_thread_id));
  select * into v_result
    from public.chat_messages as messages
    where messages.thread_id = p_thread_id and messages.message_id = p_message_id;
  if found then
    update public.chat_messages set message_data = p_message_data, updated_at = now()
      where public.chat_messages.thread_id = p_thread_id
        and public.chat_messages.message_id = p_message_id
      returning * into v_result;
    return query select
      v_result.id,
      v_result.thread_id,
      v_result.message_id,
      v_result.role,
      v_result.seq,
      v_result.message_data,
      v_result.created_at,
      v_result.updated_at;
    return;
  end if;
  select coalesce(max(seq) + 1, 1) into v_next_seq
    from public.chat_messages as messages where messages.thread_id = p_thread_id;
  insert into public.chat_messages(thread_id, message_id, role, message_data, seq)
    values (p_thread_id, p_message_id, p_role, p_message_data, v_next_seq)
    returning * into v_result;
  return query select
    v_result.id,
    v_result.thread_id,
    v_result.message_id,
    v_result.role,
    v_result.seq,
    v_result.message_data,
    v_result.created_at,
    v_result.updated_at;
end;
$$;

alter table public.threads enable row level security;
alter table public.files enable row level security;
alter table public.thread_files enable row level security;
alter table public.upload_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.thread_seq enable row level security;
alter table public.shared_conversations enable row level security;
alter table public.agents enable row level security;
alter table public.scheduled_triggers enable row level security;
alter table public.trigger_execution_logs enable row level security;
alter table public.user_profiles enable row level security;
alter table public.slide_presentations enable row level security;
alter table public.user_integrations enable row level security;
alter table public.integration_action_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.persist_chat_message(text, text, text, jsonb) to service_role;
