-- 로드맵 2단계: 일기장 (B1, B2, E1)
-- 기준: docs/spec.md '데이터 구조', docs/screens.md B1·B2·E1

-- ─────────────────────────────────────────────
-- 금지어: 닉네임·일기장 이름은 어떤 경로로 바뀌어도 서버에서 검사
-- ─────────────────────────────────────────────
create or replace function public.check_banned_diary_name()
returns trigger language plpgsql as $$
begin
  if public.has_banned_word(new.name) then raise exception 'banned_word'; end if;
  new.name := btrim(new.name);
  return new;
end $$;
create trigger diaries_banned_name before insert or update of name on public.diaries
  for each row execute function public.check_banned_diary_name();

create or replace function public.check_banned_nickname()
returns trigger language plpgsql as $$
begin
  if public.has_banned_word(new.nickname) then raise exception 'banned_word'; end if;
  new.nickname := btrim(new.nickname);
  return new;
end $$;
create trigger profiles_banned_nickname before insert or update of nickname on public.profiles
  for each row execute function public.check_banned_nickname();

-- ─────────────────────────────────────────────
-- 늦게 쓰기 기간은 RPC로만 바꾼다(기간을 늘릴 때 열림 기록 생성이 필요해서)
-- ─────────────────────────────────────────────
revoke update on public.diaries from authenticated;
grant update (name, cover_color) on public.diaries to authenticated;

-- 주인 판정
create or replace function public.is_owner(d uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.diaries x where x.id = d and x.owner_id = uid)
$$;

-- ─────────────────────────────────────────────
-- my_diaries RPC [B1]: 홈 카드에 필요한 값을 한 번에
-- 정렬: 고정 먼저, 그다음 last_activity_at 최신순(고정끼리도 같은 순서)
-- TODO(3단계) wrote_today·today_count·recent_emotions를 entries에서 계산
-- TODO(5단계) pending_requests를 join_requests에서 계산
-- TODO(10단계) 차단한 멤버를 members·today_count에서 제외
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
    false,
    0,
    '{}'::text[],
    0
  from public.diary_members m
  join public.diaries d on d.id = m.diary_id
  where m.user_id = auth.uid()
  order by m.pinned desc, d.last_activity_at desc
$$;

-- ─────────────────────────────────────────────
-- set_late_window RPC [E1]: 함께 쓰기 일기장, 주인만
-- TODO(6단계) 기간을 늘릴 때, 늘리기 전 자동 공개였던 날짜에 대해 멤버 전원의 entry_unlocks 생성(T7)
-- ─────────────────────────────────────────────
create or replace function public.set_late_window(p_diary uuid, p_days smallint)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.diaries;
begin
  select * into d from public.diaries where id = p_diary for update;
  if not found or not public.is_member(p_diary) then raise exception 'not_member'; end if;
  if not public.is_active_user() then raise exception 'suspended'; end if;
  if d.owner_id <> auth.uid() or not d.is_shared then raise exception 'not_member'; end if;
  if p_days not in (1, 3, 7) then raise exception 'date_out_of_range'; end if;
  update public.diaries set late_window_days = p_days where id = p_diary;
end $$;

-- ─────────────────────────────────────────────
-- regenerate_invite_code RPC [E1]: 주인만. 대기 중인 요청은 그대로
-- ─────────────────────────────────────────────
create or replace function public.regenerate_invite_code(p_diary uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  d public.diaries;
  code char(6);
begin
  select * into d from public.diaries where id = p_diary for update;
  if not found or not public.is_member(p_diary) then raise exception 'not_member'; end if;
  if not public.is_active_user() then raise exception 'suspended'; end if;
  if d.owner_id <> auth.uid() or not d.is_shared then raise exception 'not_member'; end if;
  code := public.gen_invite_code();
  update public.diaries set invite_code = code where id = p_diary;
  return code;
end $$;

-- ─────────────────────────────────────────────
-- convert_to_shared RPC [E1]: 혼자 쓰기 → 함께 쓰기만 가능
-- ─────────────────────────────────────────────
create or replace function public.convert_to_shared(p_diary uuid, p_days smallint)
returns text language plpgsql security definer set search_path = public as $$
declare
  d public.diaries;
  code char(6);
begin
  select * into d from public.diaries where id = p_diary for update;
  if not found or not public.is_member(p_diary) then raise exception 'not_member'; end if;
  if not public.is_active_user() then raise exception 'suspended'; end if;
  if d.owner_id <> auth.uid() then raise exception 'not_member'; end if;
  if d.is_shared then return d.invite_code; end if;
  if p_days not in (1, 3, 7) then raise exception 'date_out_of_range'; end if;
  code := public.gen_invite_code();
  update public.diaries set is_shared = true, late_window_days = p_days, invite_code = code where id = p_diary;
  return code;
end $$;

-- create_diary: 기간 값 검증 보강(함께 쓰기 1/3/7)
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
  if p_is_shared and p_late_window_days not in (1, 3, 7) then raise exception 'date_out_of_range'; end if;

  d_today := public.user_today(uid);
  insert into public.diaries (name, cover_color, owner_id, is_shared, late_window_days, invite_code, created_date)
  values (
    p_name,
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

revoke execute on function public.my_diaries() from public, anon;
revoke execute on function public.set_late_window(uuid, smallint) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
revoke execute on function public.convert_to_shared(uuid, smallint) from public, anon;
grant execute on function public.my_diaries() to authenticated;
grant execute on function public.set_late_window(uuid, smallint) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.convert_to_shared(uuid, smallint) to authenticated;
