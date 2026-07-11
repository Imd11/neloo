begin;
select plan(22);

select has_table('public', 'threads', 'threads exists');
select has_table('public', 'files', 'files exists');
select has_table('public', 'thread_files', 'thread_files exists');
select has_table('public', 'upload_sessions', 'upload_sessions exists');
select has_table('public', 'chat_messages', 'chat_messages exists');
select has_table('public', 'thread_seq', 'thread_seq exists');
select has_table('public', 'shared_conversations', 'shared_conversations exists');
select has_table('public', 'agents', 'agents exists');
select has_table('public', 'scheduled_triggers', 'scheduled_triggers exists');
select has_table('public', 'trigger_execution_logs', 'trigger_execution_logs exists');
select has_table('public', 'user_profiles', 'user_profiles exists');
select has_table('public', 'slide_presentations', 'slide_presentations exists');
select has_table('public', 'user_integrations', 'user_integrations exists');
select has_table('public', 'integration_action_logs', 'integration_action_logs exists');

select has_column('public', 'threads', 'langgraph_thread_id', 'threads.langgraph_thread_id exists');
select has_column('public', 'threads', 'model_id', 'threads.model_id exists');
select has_column('public', 'files', 'bucket', 'files.bucket exists');
select has_column('public', 'shared_conversations', 'target_ai_message_id', 'shared target exists');
select has_column('public', 'user_integrations', 'oauth_state', 'integration oauth_state exists');
select has_column('public', 'integration_action_logs', 'raw_result', 'action raw_result exists');

select ok((select relrowsecurity from pg_class where oid = 'public.threads'::regclass), 'threads RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.slide_presentations'::regclass), 'slides RLS enabled');

select * from finish();
rollback;
