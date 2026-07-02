-- Slide presentation history for the Slides feature.
create table if not exists public.slide_presentations (
    id uuid primary key,
    user_id text not null default 'default',
    title text not null default 'Untitled',
    topic text not null,
    slides jsonb not null default '[]'::jsonb,
    attachments jsonb not null default '[]'::jsonb,
    style jsonb,
    preset_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_slide_presentations_user_updated
    on public.slide_presentations (user_id, updated_at desc);

alter table public.slide_presentations enable row level security;

drop policy if exists "service role manages slide presentations" on public.slide_presentations;
create policy "service role manages slide presentations"
    on public.slide_presentations
    for all
    using (true)
    with check (true);
