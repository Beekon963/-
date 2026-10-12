-- LIFE RANKED 用のテーブル。Supabase の SQL Editor に貼り付けて「Run」を押すだけ。
-- 全データを1つのテーブルに保存し、行レベルセキュリティで「自分のデータしか読めない」ようにしている。

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  type       text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create index if not exists records_user_updated_idx on public.records (user_id, updated_at);

alter table public.records enable row level security;

drop policy if exists "records are private" on public.records;
create policy "records are private" on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 更新時刻はサーバーの時計で付ける（同期の差分取得に使う）
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch
  before insert or update on public.records
  for each row execute function public.records_touch();
