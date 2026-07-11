do $$
declare
  item record;
begin
  for item in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'app_identities', 'threads', 'files', 'thread_files', 'upload_sessions',
        'chat_messages', 'thread_seq', 'shared_conversations', 'agents',
        'scheduled_triggers', 'trigger_execution_logs', 'user_profiles',
        'slide_presentations', 'user_integrations', 'integration_action_logs'
      )
  loop
    execute format('drop policy %I on %I.%I', item.policyname, item.schemaname, item.tablename);
  end loop;

  for item in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy %I on %I.%I', item.policyname, item.schemaname, item.tablename);
  end loop;
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

revoke all on storage.objects, storage.buckets from anon, authenticated;
grant select, insert, update, delete on storage.objects, storage.buckets to service_role;

insert into storage.buckets(id, name, public, file_size_limit)
values
  ('data-analyst-files', 'data-analyst-files', false, 52428800),
  ('data-analyst-generated', 'data-analyst-generated', false, 52428800),
  ('data-analyst-images', 'data-analyst-images', false, 52428800)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit;
