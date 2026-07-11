begin;
select plan(13);

select is(
  (
    select count(*)::integer
    from unnest(array[
      'app_identities', 'threads', 'files', 'thread_files', 'upload_sessions',
      'agents', 'scheduled_triggers', 'trigger_execution_logs', 'user_profiles',
      'shared_conversations', 'slide_presentations', 'user_integrations',
      'integration_action_logs', 'chat_messages', 'thread_seq'
    ]) as item(table_name)
    where has_table_privilege('anon', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE')
  ),
  0,
  'anon has no user-table CRUD privileges'
);

select is(
  (
    select count(*)::integer
    from unnest(array[
      'app_identities', 'threads', 'files', 'thread_files', 'upload_sessions',
      'agents', 'scheduled_triggers', 'trigger_execution_logs', 'user_profiles',
      'shared_conversations', 'slide_presentations', 'user_integrations',
      'integration_action_logs', 'chat_messages', 'thread_seq'
    ]) as item(table_name)
    where has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE')
  ),
  0,
  'authenticated has no user-table CRUD privileges'
);

select is(
  (
    select count(*)::integer
    from unnest(array[
      'app_identities', 'threads', 'files', 'thread_files', 'upload_sessions',
      'agents', 'scheduled_triggers', 'trigger_execution_logs', 'user_profiles',
      'shared_conversations', 'slide_presentations', 'user_integrations',
      'integration_action_logs', 'chat_messages', 'thread_seq'
    ]) as item(table_name)
    where has_table_privilege('service_role', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE')
  ),
  15,
  'service role can manage every user table'
);

select ok(has_table_privilege('service_role', 'storage.objects', 'SELECT,INSERT,UPDATE,DELETE'), 'service role can manage storage objects');

insert into storage.objects(bucket_id, name)
values ('data-analyst-files', 'rls-fixture.txt');

set local role anon;
select is((select count(*)::integer from storage.objects where name = 'rls-fixture.txt'), 0, 'anon cannot list storage objects');
select throws_ok(
  $$insert into storage.objects(bucket_id, name) values ('data-analyst-files', 'anon-write.txt')$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'anon cannot insert storage objects'
);
reset role;

set local role authenticated;
select is((select count(*)::integer from storage.objects where name = 'rls-fixture.txt'), 0, 'authenticated cannot list storage objects');
select lives_ok($$delete from storage.objects where name = 'rls-fixture.txt'$$, 'authenticated delete is filtered by RLS');
reset role;

select is((select count(*)::integer from storage.objects where name = 'rls-fixture.txt'), 1, 'browser role cannot remove storage objects');

select is((select count(*)::integer from pg_policies where schemaname = 'storage' and roles && array['anon', 'authenticated']::name[]), 0, 'no browser storage policies');
select is((select count(*)::integer from storage.buckets where public), 0, 'all storage buckets are private');
select is((select count(*)::integer from storage.buckets where id in ('data-analyst-files', 'data-analyst-generated', 'data-analyst-images')), 3, 'runtime storage buckets exist');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and (qual = 'true' or with_check = 'true')), 0, 'no unconditional user-data policies');

select * from finish();
rollback;
