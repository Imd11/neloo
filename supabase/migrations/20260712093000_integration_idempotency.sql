alter table public.integration_action_logs
  add column if not exists run_id text,
  add column if not exists reserved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.integration_action_logs
set status = 'success'
where status = 'success_no_id';

update public.integration_action_logs
set idempotency_key = encode(
  digest(user_id::text || ':' || idempotency_key, 'sha256'),
  'hex'
)
where idempotency_key is not null
  and idempotency_key !~ '^[0-9a-f]{64}$';

alter table public.integration_action_logs
  drop constraint if exists integration_action_logs_status_check;
alter table public.integration_action_logs
  add constraint integration_action_logs_status_check
  check (status in ('pending', 'success', 'failed'));
alter table public.integration_action_logs
  drop constraint if exists integration_action_logs_idempotency_key_check;
alter table public.integration_action_logs
  add constraint integration_action_logs_idempotency_key_check
  check (idempotency_key is null or idempotency_key ~ '^[0-9a-f]{64}$');

create unique index if not exists integration_action_logs_user_idempotency_unique
  on public.integration_action_logs(user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.reserve_integration_action(
  p_user_id uuid,
  p_thread_id text,
  p_run_id text,
  p_app_name text,
  p_action text,
  p_params_hash text,
  p_idempotency_key text
) returns table (
  created boolean,
  status text,
  result_id varchar,
  raw_result jsonb,
  reserved_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation public.integration_action_logs%rowtype;
  was_created boolean;
begin
  insert into public.integration_action_logs(
    user_id,
    thread_id,
    run_id,
    app_name,
    action,
    params_hash,
    idempotency_key,
    status,
    reserved_at,
    updated_at
  ) values (
    p_user_id,
    p_thread_id,
    p_run_id,
    lower(p_app_name),
    upper(p_action),
    p_params_hash,
    p_idempotency_key,
    'pending',
    now(),
    now()
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null
  do nothing
  returning * into reservation;

  was_created := found;
  if not was_created then
    select * into strict reservation
    from public.integration_action_logs as logs
    where logs.user_id = p_user_id and logs.idempotency_key = p_idempotency_key;
  end if;

  return query select
    was_created,
    reservation.status::text,
    reservation.result_id,
    reservation.raw_result,
    reservation.reserved_at,
    reservation.updated_at;
end;
$$;

revoke all on function public.reserve_integration_action(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_integration_action(uuid, text, text, text, text, text, text)
  to service_role;
