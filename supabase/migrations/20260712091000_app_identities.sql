create table if not exists public.app_identities (
  id uuid primary key,
  identity_type text not null check (identity_type in ('guest', 'supabase')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

insert into public.app_identities(id, identity_type)
select owner_id, 'supabase'
from (
  select user_id as owner_id from public.threads
  union select user_id from public.files
  union select user_id from public.agents where user_id is not null
  union select user_id from public.scheduled_triggers where user_id is not null
  union select user_id from public.shared_conversations
  union select id from public.user_profiles
  union select user_id from public.user_integrations
  union select user_id from public.integration_action_logs
) owners
where owner_id is not null
on conflict (id) do nothing;

do $$
declare
  invalid_upload_ids text;
  invalid_slide_ids text;
begin
  select string_agg(distinct user_id, ', ' order by user_id)
    into invalid_upload_ids
    from public.upload_sessions
    where user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  select string_agg(distinct user_id, ', ' order by user_id)
    into invalid_slide_ids
    from public.slide_presentations
    where user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  if invalid_upload_ids is not null or invalid_slide_ids is not null then
    raise exception 'Cannot migrate invalid app identities (upload_sessions: %, slide_presentations: %)',
      coalesce(invalid_upload_ids, 'none'), coalesce(invalid_slide_ids, 'none');
  end if;
end;
$$;

insert into public.app_identities(id, identity_type)
select user_id::uuid, 'guest' from public.upload_sessions
union
select user_id::uuid, 'guest' from public.slide_presentations
on conflict (id) do nothing;

drop policy if exists upload_sessions_user_policy on public.upload_sessions;
alter table public.upload_sessions alter column user_id type uuid using user_id::uuid;
alter table public.slide_presentations alter column user_id drop default;
alter table public.slide_presentations alter column user_id type uuid using user_id::uuid;

do $$
declare
  item record;
begin
  for item in
    select conrelid::regclass as table_name, conname
    from pg_constraint
    where contype = 'f'
      and confrelid = 'auth.users'::regclass
      and conrelid in (
        'public.threads'::regclass,
        'public.files'::regclass,
        'public.agents'::regclass,
        'public.scheduled_triggers'::regclass,
        'public.shared_conversations'::regclass,
        'public.user_profiles'::regclass
      )
  loop
    execute format('alter table %s drop constraint %I', item.table_name, item.conname);
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'threads_app_identity_fkey' and conrelid = 'public.threads'::regclass) then
    alter table public.threads add constraint threads_app_identity_fkey foreign key (user_id) references public.app_identities(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'files_app_identity_fkey' and conrelid = 'public.files'::regclass) then
    alter table public.files add constraint files_app_identity_fkey foreign key (user_id) references public.app_identities(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'agents_app_identity_fkey' and conrelid = 'public.agents'::regclass) then
    alter table public.agents add constraint agents_app_identity_fkey foreign key (user_id) references public.app_identities(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scheduled_triggers_app_identity_fkey' and conrelid = 'public.scheduled_triggers'::regclass) then
    alter table public.scheduled_triggers add constraint scheduled_triggers_app_identity_fkey foreign key (user_id) references public.app_identities(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shared_conversations_app_identity_fkey' and conrelid = 'public.shared_conversations'::regclass) then
    alter table public.shared_conversations add constraint shared_conversations_app_identity_fkey foreign key (user_id) references public.app_identities(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_app_identity_fkey' and conrelid = 'public.user_profiles'::regclass) then
    alter table public.user_profiles add constraint user_profiles_app_identity_fkey foreign key (id) references public.app_identities(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'upload_sessions_app_identity_fkey' and conrelid = 'public.upload_sessions'::regclass) then
    alter table public.upload_sessions add constraint upload_sessions_app_identity_fkey foreign key (user_id) references public.app_identities(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'slide_presentations_app_identity_fkey' and conrelid = 'public.slide_presentations'::regclass) then
    alter table public.slide_presentations add constraint slide_presentations_app_identity_fkey foreign key (user_id) references public.app_identities(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_integrations_app_identity_fkey' and conrelid = 'public.user_integrations'::regclass) then
    alter table public.user_integrations add constraint user_integrations_app_identity_fkey foreign key (user_id) references public.app_identities(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'integration_action_logs_app_identity_fkey' and conrelid = 'public.integration_action_logs'::regclass) then
    alter table public.integration_action_logs add constraint integration_action_logs_app_identity_fkey foreign key (user_id) references public.app_identities(id) on delete cascade;
  end if;
end;
$$;

create index if not exists idx_app_identities_last_seen on public.app_identities(last_seen_at);
create index if not exists idx_slide_presentations_user_id on public.slide_presentations(user_id);

alter table public.app_identities enable row level security;
revoke all on public.app_identities from anon, authenticated;
grant all on public.app_identities to service_role;
