-- 로드맵 1단계: 기반 (A1, A3, A4)
-- profiles, user_settings, push_tokens, app_config, diaries, diary_members, avatars 버킷
-- 기준: docs/spec.md '데이터 구조'
-- 오류는 raise exception '<오류 코드>'로 돌려주고, 앱은 src/copy/ko.ts errorCopy로 문구를 매핑한다.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- 공통: updated_at 자동 갱신
-- ─────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────────────────────────
-- app_config: min_version, terms_version, banned_words 등
-- ─────────────────────────────────────────────
create table public.app_config (
  key text primary key,
  value jsonb not null
);
alter table public.app_config enable row level security;
create policy app_config_read on public.app_config for select to anon, authenticated using (true);

insert into public.app_config (key, value) values
  ('min_version', '"1.0.0"'),
  ('terms_version', '"2026-11-25"'),
  ('banned_words', '[]');

-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 1~10자는 앱에서 grapheme 단위로 검증. DB는 남용 방지용 코드포인트 상한만 둔다
  nickname text not null check (char_length(nickname) between 1 and 100),
  avatar_type text not null default 'emoji' check (avatar_type in ('emoji', 'photo')),
  avatar_emoji text not null default '👑',
  avatar_path text,
  week_start smallint not null default 1 check (week_start in (0, 1)),
  terms_version text not null,
  terms_agreed_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────
-- user_settings
-- ─────────────────────────────────────────────
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_entry boolean not null default true,
  push_comment boolean not null default true,
  push_reaction boolean not null default true,
  push_membership boolean not null default true,
  reminder_on boolean not null default true,
  reminder_time time not null default '21:00',
  timezone text not null default 'UTC'
);

-- 사용자 현지 '오늘'. can_view_entry는 열람자, save_entry는 작성자 기준으로 부른다
create or replace function public.user_today(uid uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce(
    (select s.timezone from public.user_settings s where s.user_id = uid), 'UTC'))::date
$$;

-- ─────────────────────────────────────────────
-- push_tokens
-- ─────────────────────────────────────────────
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- diaries / diary_members
-- ─────────────────────────────────────────────
create table public.diaries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  cover_color text not null default 'cover_1'
    check (cover_color in ('cover_1','cover_2','cover_3','cover_4','cover_5','cover_6','cover_7','cover_8')),
  owner_id uuid not null references public.profiles (id),
  is_shared boolean not null,
  write_mode text not null default 'free' check (write_mode = 'free'),
  late_window_days smallint not null check (late_window_days in (1, 3, 7)),
  invite_code char(6) unique,
  max_members smallint not null default 10,
  created_date date not null,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint solo_diary_shape check (is_shared or (late_window_days = 7 and invite_code is null))
);
create trigger diaries_touch before update on public.diaries
  for each row execute function public.touch_updated_at();

create table public.diary_members (
  diary_id uuid not null references public.diaries (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  joined_date date not null,
  muted boolean not null default false,
  pinned boolean not null default false,
  primary key (diary_id, user_id)
);
create unique index diary_members_one_owner on public.diary_members (diary_id) where role = 'owner';
create index diary_members_user on public.diary_members (user_id);

-- RLS 재귀를 피하려고 멤버 판정은 security definer 함수로 한다
create or replace function public.is_member(d uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.diary_members m where m.diary_id = d and m.user_id = uid)
$$;

create or replace function public.is_active_user(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.status = 'active')
$$;

-- ─────────────────────────────────────────────
-- 금지어 검사 (닉네임·일기장 이름에만)
-- ─────────────────────────────────────────────
create or replace function public.has_banned_word(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.app_config c, jsonb_array_elements_text(c.value) w
    where c.key = 'banned_words' and length(w) > 0 and position(lower(w) in lower(t)) > 0
  )
$$;

-- ─────────────────────────────────────────────
-- 초대 코드 생성: 6자리, A~Z·2~9 중 O·I 제외
-- ─────────────────────────────────────────────
create or replace function public.gen_invite_code()
returns char(6) language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.diaries where invite_code = code);
  end loop;
  return code;
end $$;

-- ─────────────────────────────────────────────
-- create_diary RPC: 일기장 + 주인 멤버 + 초대 코드(함께 쓰기)
-- ─────────────────────────────────────────────
create or replace function public.create_diary(
  p_name text,
  p_cover_color text,
  p_is_shared boolean,
  p_late_window_days smallint default 3
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d_today date;
  new_id uuid;
begin
  if uid is null then raise exception 'not_member'; end if;
  if not public.is_active_user(uid) then raise exception 'suspended'; end if;
  if public.has_banned_word(p_name) then raise exception 'banned_word'; end if;

  d_today := public.user_today(uid);
  insert into public.diaries (name, cover_color, owner_id, is_shared, late_window_days, invite_code, created_date)
  values (
    btrim(p_name),
    p_cover_color,
    uid,
    p_is_shared,
    case when p_is_shared then p_late_window_days else 7 end,
    case when p_is_shared then public.gen_invite_code() else null end,
    d_today
  ) returning id into new_id;

  insert into public.diary_members (diary_id, user_id, role, joined_date)
  values (new_id, uid, 'owner', d_today);

  return new_id;
end $$;

-- ─────────────────────────────────────────────
-- complete_profile RPC [A4]
-- profiles(약관 동의 포함)·user_settings 생성 + 혼자 쓰기 "나의 공주일기" 자동 생성
-- 한 트랜잭션. 이미 프로필이 있으면 그대로 둔다(재시도 안전)
-- ─────────────────────────────────────────────
create or replace function public.complete_profile(
  p_nickname text,
  p_avatar_type text,
  p_avatar_emoji text,
  p_avatar_path text,
  p_terms_version text,
  p_terms_agreed_at timestamptz,
  p_timezone text,
  p_solo_diary_name text
) returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d_today date;
  diary_id uuid;
begin
  if uid is null then raise exception 'not_member'; end if;
  if exists (select 1 from public.profiles where id = uid) then return; end if;
  if public.has_banned_word(p_nickname) then raise exception 'banned_word'; end if;

  insert into public.user_settings (user_id, timezone)
  values (uid, coalesce(nullif(p_timezone, ''), 'UTC'))
  on conflict (user_id) do update set timezone = excluded.timezone;

  insert into public.profiles (id, nickname, avatar_type, avatar_emoji, avatar_path, terms_version, terms_agreed_at)
  values (uid, btrim(p_nickname), p_avatar_type, coalesce(p_avatar_emoji, '👑'), p_avatar_path, p_terms_version, p_terms_agreed_at);

  d_today := public.user_today(uid);
  insert into public.diaries (name, cover_color, owner_id, is_shared, late_window_days, invite_code, created_date)
  values (p_solo_diary_name, 'cover_1', uid, false, 7, null, d_today)
  returning id into diary_id;

  insert into public.diary_members (diary_id, user_id, role, joined_date)
  values (diary_id, uid, 'owner', d_today);
end $$;

-- ─────────────────────────────────────────────
-- touch_session RPC [A1]: 실행·포그라운드 복귀 시 timezone, last_seen_at(하루 1회까지) 갱신
-- 정지 여부와 약관 버전을 함께 돌려준다
-- ─────────────────────────────────────────────
create or replace function public.touch_session(p_timezone text)
returns table (has_profile boolean, status text, terms_version text)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_member'; end if;

  insert into public.user_settings (user_id, timezone)
  values (uid, coalesce(nullif(p_timezone, ''), 'UTC'))
  on conflict (user_id) do update set timezone = excluded.timezone;

  update public.profiles p set last_seen_at = now()
  where p.id = uid and p.last_seen_at < now() - interval '1 day';

  return query
    select true, p.status, p.terms_version from public.profiles p where p.id = uid
    union all
    select false, null::text, null::text
    where not exists (select 1 from public.profiles p2 where p2.id = uid);
end $$;

-- ─────────────────────────────────────────────
-- agree_terms RPC [A3]: 약관 개정 시 재동의
-- ─────────────────────────────────────────────
create or replace function public.agree_terms(p_terms_version text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_member'; end if;
  update public.profiles
     set terms_version = p_terms_version, terms_agreed_at = now()
   where id = auth.uid();
end $$;

-- ─────────────────────────────────────────────
-- RLS
-- 차단(blocks)은 10단계 마이그레이션에서 profiles 정책에 추가한다
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.push_tokens enable row level security;
alter table public.diaries enable row level security;
alter table public.diary_members enable row level security;

-- profiles: 본인 + 같은 일기장 멤버 읽기, 본인 행만 수정(생성은 complete_profile)
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from public.diary_members me
    join public.diary_members them on them.diary_id = me.diary_id
    where me.user_id = auth.uid() and them.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active_user())
  with check (id = auth.uid());
-- status·terms·last_seen은 서버만 바꾼다
revoke update on public.profiles from authenticated;
grant update (nickname, avatar_type, avatar_emoji, avatar_path, week_start) on public.profiles to authenticated;

-- user_settings, push_tokens: 본인
create policy user_settings_self on public.user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_tokens_self on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- diaries: 멤버 읽기, 주인 수정(생성은 create_diary)
create policy diaries_read on public.diaries for select to authenticated using (public.is_member(id));
create policy diaries_update on public.diaries for update to authenticated
  using (owner_id = auth.uid() and public.is_active_user())
  with check (owner_id = auth.uid());
revoke update on public.diaries from authenticated;
grant update (name, cover_color, late_window_days) on public.diaries to authenticated;

-- diary_members: 같은 일기장 멤버 읽기, muted·pinned는 본인 행만
create policy diary_members_read on public.diary_members for select to authenticated
  using (public.is_member(diary_id));
create policy diary_members_update_self on public.diary_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.diary_members from authenticated;
grant update (muted, pinned) on public.diary_members to authenticated;

-- RPC 실행 권한
revoke execute on function public.create_diary(text, text, boolean, smallint) from public, anon;
revoke execute on function public.complete_profile(text, text, text, text, text, timestamptz, text, text) from public, anon;
revoke execute on function public.touch_session(text) from public, anon;
revoke execute on function public.agree_terms(text) from public, anon;
grant execute on function public.agree_terms(text) to authenticated;
grant execute on function public.create_diary(text, text, boolean, smallint) to authenticated;
grant execute on function public.complete_profile(text, text, text, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.touch_session(text) to authenticated;

-- ─────────────────────────────────────────────
-- Storage: avatars 버킷 — {user_id}.jpg, 로그인 사용자 읽기, 본인만 쓰기
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg')
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
