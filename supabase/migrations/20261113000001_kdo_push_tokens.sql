-- Device Expo push tokens. Users manage only their own rows.
-- Assignment alerts are sent by the notify-assignment Edge Function.

create table if not exists public.kdo_push_tokens (
  token text not null
    check (char_length(btrim(token)) >= 16 and char_length(token) <= 255),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (token)
);

create index if not exists kdo_push_tokens_user_idx
  on public.kdo_push_tokens (user_id);

alter table public.kdo_push_tokens enable row level security;
alter table public.kdo_push_tokens force row level security;

revoke all on table public.kdo_push_tokens from anon, authenticated, public;
grant select, insert, update, delete on table public.kdo_push_tokens to authenticated;

create policy kdo_push_tokens_select_own
  on public.kdo_push_tokens for select to authenticated
  using ((select auth.uid()) = user_id);

create policy kdo_push_tokens_insert_own
  on public.kdo_push_tokens for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy kdo_push_tokens_update_own
  on public.kdo_push_tokens for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy kdo_push_tokens_delete_own
  on public.kdo_push_tokens for delete to authenticated
  using ((select auth.uid()) = user_id);
