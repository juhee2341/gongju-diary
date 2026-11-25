-- 로드맵 3단계: 일기 작성 (D1, D2) — 이슈 #2
-- entries, entry_unlocks, save_entry, entry-photos 버킷, my_diaries 집계
-- 열람 규칙(can_view_entry)은 6단계(#5). 그 전까지 entries·사진 읽기는 작성자 본인만 허용해
-- 중간 단계에서도 남의 일기가 새지 않게 한다.

-- ─────────────────────────────────────────────
-- entries
-- ─────────────────────────────────────────────
create table public.entries (
  id uuid primary key,                       -- 앱에서 생성(사진 경로에 먼저 쓴다)
  diary_id uuid not null references public.diaries (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  entry_date date not null,
  emotion text not null check (emotion in
    ('happy','excited','proud','love','calm','soso','tired','sad','angry','worried')),
  content text not null default '' check (char_length(content) <= 600),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 3),
  is_late boolean not null default false,
  edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entries_one_per_day unique (diary_id, author_id, entry_date),
  constraint entries_has_body check (cardinality(photo_paths) >= 1 or btrim(content) <> '')
);
create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();
create index entries_diary_date on public.entries (diary_id, entry_date);
create index entries_author_date on public.entries (author_id, entry_date);

-- ─────────────────────────────────────────────
-- entry_unlocks: 열림 기록. 한 번 생기면 일기를 지워도 유지
-- ─────────────────────────────────────────────
create table public.entry_unlocks (
  diary_id uuid not null references public.diaries (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  entry_date date not null,
  created_at timestamptz not null default now(),
  primary key (diary_id, user_id, entry_date)
);
create index entry_unlocks_user_diary on public.entry_unlocks (user_id, diary_id);

alter table public.entries enable row level security;
alter table public.entry_unlocks enable row level security;

-- TODO(6단계 #5) 읽기를 can_view_entry로 넓힌다
create policy entries_read_own on public.entries for select to authenticated
  using (author_id = auth.uid());
create policy entries_delete_own on public.entries for delete to authenticated
  using (author_id = auth.uid() and public.is_active_user());
-- 생성·수정은 save_entry로만
revoke insert, update on public.entries from authenticated;

create policy entry_unlocks_read_own on public.entry_unlocks for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete on public.entry_unlocks from authenticated;

-- ─────────────────────────────────────────────
-- save_entry RPC [D1]
-- 작성 가능 날짜·서버 날짜 검증 → 저장 → 열림 기록
-- p_device_today: 앱이 계산한 오늘. 서버 계산과 하루 넘게 다르면 device_date_invalid
-- ─────────────────────────────────────────────
create or replace function public.save_entry(
  p_id uuid,
  p_diary uuid,
  p_date date,
  p_emotion text,
  p_content text,
  p_photo_paths text[],
  p_device_today date
) returns public.entries
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d public.diaries;
  m public.diary_members;
  server_today date;
  existing public.entries;
  body text := btrim(coalesce(p_content, ''));
  photos text[] := coalesce(p_photo_paths, '{}');
  result public.entries;
  path text;
  i int := 0;
begin
  if uid is null then raise exception 'not_member'; end if;
  if not public.is_active_user(uid) then raise exception 'suspended'; end if;

  select * into d from public.diaries where id = p_diary;
  select * into m from public.diary_members where diary_id = p_diary and user_id = uid;
  if d.id is null or m.user_id is null then raise exception 'not_member'; end if;

  server_today := public.user_today(uid);
  if p_device_today is null or abs(p_device_today - server_today) > 1 then
    raise exception 'device_date_invalid';
  end if;

  -- 사진 경로: {diary_id}/{entry_id}/{1~3}.jpg
  foreach path in array photos loop
    i := i + 1;
    if path !~ ('^' || p_diary::text || '/' || p_id::text || '/[1-3]\.jpg$') then
      raise exception 'entry_not_found';
    end if;
  end loop;
  -- 사진이 없으면 본문 5자 이상(앱은 grapheme, 서버는 코드포인트로 검사)
  if cardinality(photos) = 0 and char_length(body) < 5 then raise exception 'too_short'; end if;

  select * into existing from public.entries where id = p_id;

  if existing.id is not null then
    -- 수정: 작성자 본인, 날짜·일기장 변경 불가
    if existing.author_id <> uid or existing.diary_id <> p_diary then raise exception 'entry_not_found'; end if;
    update public.entries
       set emotion = p_emotion, content = body, photo_paths = photos, edited = true
     where id = p_id
    returning * into result;
    return result;
  end if;

  -- 새로 쓰기: 작성 가능 날짜 = max(참여일, 오늘 − LATE_WINDOW) ~ 오늘
  if p_date > server_today or p_date < greatest(m.joined_date, server_today - d.late_window_days) then
    raise exception 'date_out_of_range';
  end if;

  begin
    insert into public.entries (id, diary_id, author_id, entry_date, emotion, content, photo_paths, is_late)
    values (p_id, p_diary, uid, p_date, p_emotion, body, photos, p_date <> server_today)
    returning * into result;
  exception when unique_violation then
    raise exception 'entry_exists';
  end;

  insert into public.entry_unlocks (diary_id, user_id, entry_date)
  values (p_diary, uid, p_date)
  on conflict do nothing;

  update public.diaries set last_activity_at = now() where id = p_diary;
  return result;
end $$;

revoke execute on function public.save_entry(uuid, uuid, date, text, text, text[], date) from public, anon;
grant execute on function public.save_entry(uuid, uuid, date, text, text, text[], date) to authenticated;

-- ─────────────────────────────────────────────
-- my_diaries: 오늘 작성 리본, 오늘 N명, 혼자 쓰기 최근 감정 7개
-- "오늘"은 보는 사람의 현지 날짜
-- ─────────────────────────────────────────────
create or replace function public.my_diaries()
returns table (
  id uuid,
  name text,
  cover_color text,
  is_shared boolean,
  late_window_days smallint,
  invite_code text,
  owner_id uuid,
  created_date date,
  last_activity_at timestamptz,
  role text,
  pinned boolean,
  muted boolean,
  joined_date date,
  member_count int,
  members jsonb,
  wrote_today boolean,
  today_count int,
  recent_emotions text[],
  pending_requests int
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid, public.user_today(auth.uid()) as today)
  select
    d.id, d.name, d.cover_color, d.is_shared, d.late_window_days, d.invite_code::text,
    d.owner_id, d.created_date, d.last_activity_at,
    m.role, m.pinned, m.muted, m.joined_date,
    (select count(*)::int from public.diary_members x where x.diary_id = d.id),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'user_id', p.id, 'nickname', p.nickname, 'avatar_type', p.avatar_type,
              'avatar_emoji', p.avatar_emoji, 'avatar_path', p.avatar_path, 'role', x.role)
            order by (x.role = 'owner') desc, x.joined_at), '[]'::jsonb)
       from public.diary_members x join public.profiles p on p.id = x.user_id
      where x.diary_id = d.id),
    exists (select 1 from public.entries e
             where e.diary_id = d.id and e.author_id = me.uid and e.entry_date = me.today),
    (select count(*)::int from public.entries e
      where e.diary_id = d.id and e.entry_date = me.today),
    coalesce((select array_agg(x.emotion order by x.entry_date desc)
                from (select e.emotion, e.entry_date from public.entries e
                       where e.diary_id = d.id and e.author_id = me.uid
                       order by e.entry_date desc limit 7) x), '{}'::text[]),
    0 -- TODO(5단계 #4) pending_requests
  from me
  join public.diary_members m on m.user_id = me.uid
  join public.diaries d on d.id = m.diary_id
  order by m.pinned desc, d.last_activity_at desc
$$;

-- ─────────────────────────────────────────────
-- Storage: entry-photos — {diary_id}/{entry_id}/{1~3}.jpg, {1~3}_thumb.jpg
-- 쓰기: 그 일기장 멤버이고, 일기가 이미 있으면 작성자만(저장 전 업로드 허용)
-- 읽기: 업로드한 본인 또는 일기 작성자. TODO(6단계 #5) can_view_entry로 넓힌다
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('entry-photos', 'entry-photos', false)
on conflict (id) do nothing;

create or replace function public.entry_photo_writable(object_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  diary uuid;
  entry uuid;
  author uuid;
begin
  if object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[1-3](_thumb)?\.jpg$' then return false; end if;
  diary := split_part(object_name, '/', 1)::uuid;
  entry := split_part(object_name, '/', 2)::uuid;
  if not public.is_member(diary) or not public.is_active_user() then return false; end if;
  select e.author_id into author from public.entries e where e.id = entry;
  return author is null or author = auth.uid();
end $$;

create or replace function public.entry_photo_readable(object_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  entry uuid;
begin
  if object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/' then return false; end if;
  entry := split_part(object_name, '/', 2)::uuid;
  return exists (select 1 from public.entries e where e.id = entry and e.author_id = auth.uid());
end $$;

create policy entry_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-photos' and public.entry_photo_writable(name));
create policy entry_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'entry-photos' and public.entry_photo_writable(name))
  with check (bucket_id = 'entry-photos' and public.entry_photo_writable(name));
create policy entry_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'entry-photos' and public.entry_photo_writable(name));
create policy entry_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'entry-photos' and (owner_id = auth.uid()::text or public.entry_photo_readable(name)));
