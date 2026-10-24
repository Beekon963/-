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

-- ---------- ロック画面の壁紙 ----------
-- アプリが作った壁紙の画像を置く場所。iPhone のショートカットがログインなしで取りに行けるよう公開にしている。
-- URL に推測できない文字列が入るので、URL を知っている人にしか見られない（アプリの設定で作り直せる）。
-- 書き込み・一覧・削除は、自分のフォルダ（ユーザー ID）だけ。

insert into storage.buckets (id, name, public)
values ('wallpapers', 'wallpapers', true)
on conflict (id) do nothing;

drop policy if exists "wallpapers: list own" on storage.objects;
create policy "wallpapers: list own" on storage.objects
  for select to authenticated
  using (bucket_id = 'wallpapers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wallpapers: add own" on storage.objects;
create policy "wallpapers: add own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wallpapers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wallpapers: replace own" on storage.objects;
create policy "wallpapers: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'wallpapers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'wallpapers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wallpapers: delete own" on storage.objects;
create policy "wallpapers: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wallpapers' and (storage.foldername(name))[1] = auth.uid()::text);
