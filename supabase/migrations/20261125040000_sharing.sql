-- 로드맵 5단계: 공유 — 초대 코드 참여, 참여 요청 승인/거절, 멤버 관리 (B3, B4, E2) — 이슈 #4
-- 정책 상수: CODE_FAIL_LIMIT 10회/60초, REQUEST_EXPIRE 30일, REJECT_COOLDOWN 24시간, REJECT_DISPLAY 7일

-- ─────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────
create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diaries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','expired')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index join_requests_one_pending on public.join_requests (diary_id, user_id) where status = 'pending';
create index join_requests_diary_status on public.join_requests (diary_id, status);
create index join_requests_user on public.join_requests (user_id, created_at desc);

create table public.member_history (
  diary_id uuid not null references public.diaries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('left','removed')),
  created_at timestamptz not null default now()
);
create index member_history_diary_user on public.member_history (diary_id, user_id);

-- 초대 코드 실패 횟수(CODE_FAIL_LIMIT)
create table public.code_failures (
  user_id uuid primary key references auth.users (id) on delete cascade,
  fail_count int not null default 0,
  locked_until timestamptz
);

alter table public.join_requests enable row level security;
alter table public.member_history enable row level security;
alter table public.code_failures enable row level security;

-- join_requests: 요청자 본인, 그 일기장 주인 읽기. 쓰기는 RPC로만
create policy join_requests_read on public.join_requests for select to authenticated
  using (user_id = auth.uid() or public.is_owner(diary_id));
revoke insert, update, delete on public.join_requests from authenticated;
-- member_history, code_failures: 클라이언트 접근 없음(RPC만)
revoke all on public.member_history from authenticated, anon;
revoke all on public.code_failures from authenticated, anon;

-- 30일 지난 대기 요청은 만료로 본다(스케줄 작업 전에도 판정이 맞도록)
create or replace function public.expire_stale_requests(p_diary uuid default null, p_user uuid default null)
returns void language sql security definer set search_path = public as $$
  update public.join_requests
     set status = 'expired', decided_at = now()
   where status = 'pending'
     and created_at < now() - interval '30 days'
     and (p_diary is null or diary_id = p_diary)
     and (p_user is null or user_id = p_user)
$$;

-- ─────────────────────────────────────────────
-- 코드 실패 처리: 10회째 실패하면 60초 잠금, 잠금이 풀리면 다시 0부터
-- ─────────────────────────────────────────────
create or replace function public.code_locked_seconds(uid uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(greatest(0, ceil(extract(epoch from (f.locked_until - now()))))::int, 0)
    from public.code_failures f where f.user_id = uid
$$;

create or replace function public.record_code_failure(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.code_failures (user_id, fail_count) values (uid, 1)
  on conflict (user_id) do update
    set fail_count = case when public.code_failures.fail_count + 1 >= 10 then 0 else public.code_failures.fail_count + 1 end,
        locked_until = case when public.code_failures.fail_count + 1 >= 10 then now() + interval '60 seconds'
                            else public.code_failures.locked_until end;
end $$;

-- ─────────────────────────────────────────────
-- find_diary_by_code [B3]: 미리보기 + 현재 상태
-- 없는 코드·혼자 쓰기·옛 코드는 모두 code_invalid(실패 1회), 잠금 중이면 code_locked
-- 예외로 끝내면 실패 기록이 롤백되므로, 실패는 status로 돌려준다
-- status: ok / already_member / request_pending / diary_full / reject_cooldown / code_invalid / code_locked
-- TODO(10단계 #9) 차단 관계인 주인의 일기장도 code_invalid
-- ─────────────────────────────────────────────
create or replace function public.find_diary_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  code text := upper(btrim(coalesce(p_code, '')));
  d public.diaries;
  owner public.profiles;
  cnt int;
  pending uuid;
  locked int;
  v_status text := 'ok';
begin
  if uid is null then raise exception 'not_member'; end if;
  if not public.is_active_user(uid) then raise exception 'suspended'; end if;

  locked := public.code_locked_seconds(uid);
  if locked > 0 then return jsonb_build_object('status', 'code_locked', 'locked_seconds', locked); end if;

  select * into d from public.diaries where invite_code = code and is_shared;
  if d.id is null then
    perform public.record_code_failure(uid);
    locked := public.code_locked_seconds(uid);
    return jsonb_build_object('status', case when locked > 0 then 'code_locked' else 'code_invalid' end, 'locked_seconds', locked);
  end if;
  update public.code_failures set fail_count = 0 where user_id = uid;

  perform public.expire_stale_requests(d.id, uid);
  select * into owner from public.profiles where id = d.owner_id;
  select count(*) into cnt from public.diary_members where diary_id = d.id;
  select id into pending from public.join_requests where diary_id = d.id and user_id = uid and status = 'pending';

  if public.is_member(d.id, uid) then v_status := 'already_member';
  elsif pending is not null then v_status := 'request_pending';
  elsif cnt >= d.max_members then v_status := 'diary_full';
  elsif exists (select 1 from public.join_requests r where r.diary_id = d.id and r.user_id = uid
                  and r.status = 'rejected' and r.decided_at > now() - interval '24 hours') then v_status := 'reject_cooldown';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'diary_id', d.id,
    'name', d.name,
    'cover_color', d.cover_color,
    'owner_nickname', owner.nickname,
    'owner_avatar_type', owner.avatar_type,
    'owner_avatar_emoji', owner.avatar_emoji,
    'owner_avatar_path', owner.avatar_path,
    'member_count', cnt,
    'max_members', d.max_members,
    'request_id', pending
  );
end $$;

-- ─────────────────────────────────────────────
-- request_join [B3]: 참여 요청 만들기
-- ─────────────────────────────────────────────
create or replace function public.request_join(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  info jsonb;
  st text;
  new_id uuid;
begin
  -- 앱은 항상 find_diary_by_code(실패 횟수 기록)를 먼저 부르고, ok일 때만 요청한다
  info := public.find_diary_by_code(p_code);
  st := info ->> 'status';
  if st <> 'ok' then raise exception '%', st; end if;
  insert into public.join_requests (diary_id, user_id) values ((info ->> 'diary_id')::uuid, uid)
  returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception 'request_pending';
end $$;

-- ─────────────────────────────────────────────
-- cancel_request [B4]: 요청자만, 대기 중일 때만
-- ─────────────────────────────────────────────
create or replace function public.cancel_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.join_requests;
begin
  select * into r from public.join_requests where id = p_request for update;
  if r.id is null or r.user_id <> auth.uid() then raise exception 'request_closed'; end if;
  if r.status = 'approved' then raise exception 'already_member'; end if;
  if r.status <> 'pending' then raise exception 'request_closed'; end if;
  update public.join_requests set status = 'cancelled', decided_at = now() where id = p_request;
end $$;

-- ─────────────────────────────────────────────
-- my_join_requests [B4, B1 대기 띠]: 내가 보낸 요청(대기 중 + 7일 안의 거절·만료)
-- 아직 멤버가 아니라 diaries를 못 읽으므로 이름·커버를 함께 돌려준다
-- ─────────────────────────────────────────────
create or replace function public.my_join_requests()
returns table (id uuid, diary_id uuid, name text, cover_color text, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform public.expire_stale_requests(null, auth.uid());
  return query
    select r.id, r.diary_id, d.name, d.cover_color, r.status, r.created_at
      from public.join_requests r join public.diaries d on d.id = r.diary_id
     where r.user_id = auth.uid()
       and (r.status = 'pending' or (r.status in ('rejected','expired') and r.decided_at > now() - interval '7 days'))
     order by r.created_at desc;
end $$;

-- ─────────────────────────────────────────────
-- diary_join_requests [E2]: 주인이 받은 대기 요청 + "이전 멤버" 표시
-- TODO(10단계 #9) blocked(차단한 사용자) 표시
-- ─────────────────────────────────────────────
create or replace function public.diary_join_requests(p_diary uuid)
returns table (id uuid, user_id uuid, nickname text, avatar_type text, avatar_emoji text, avatar_path text,
               created_at timestamptz, former_member boolean, blocked boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_diary) then raise exception 'not_member'; end if;
  perform public.expire_stale_requests(p_diary, null);
  return query
    select r.id, p.id, p.nickname, p.avatar_type, p.avatar_emoji, p.avatar_path, r.created_at,
           exists (select 1 from public.member_history h where h.diary_id = p_diary and h.user_id = r.user_id),
           false
      from public.join_requests r join public.profiles p on p.id = r.user_id
     where r.diary_id = p_diary and r.status = 'pending'
     order by r.created_at;
end $$;

-- ─────────────────────────────────────────────
-- decide_request [E2]: 승인 시 인원 확인 후 멤버 추가(참여일 = 요청자 현지 날짜)
-- TODO(8단계 #7) join_approved / join_rejected / member_joined 알림
-- ─────────────────────────────────────────────
create or replace function public.decide_request(p_request uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.join_requests;
  d public.diaries;
  cnt int;
begin
  select * into r from public.join_requests where id = p_request for update;
  if r.id is null then raise exception 'request_closed'; end if;
  if not public.is_owner(r.diary_id) then raise exception 'not_member'; end if;
  if not public.is_active_user() then raise exception 'suspended'; end if;
  if r.status = 'pending' and r.created_at < now() - interval '30 days' then
    update public.join_requests set status = 'expired', decided_at = now() where id = p_request;
    raise exception 'request_closed';
  end if;
  if r.status <> 'pending' then raise exception 'request_closed'; end if;

  if not p_approve then
    update public.join_requests set status = 'rejected', decided_at = now() where id = p_request;
    return;
  end if;

  select * into d from public.diaries where id = r.diary_id for update;
  select count(*) into cnt from public.diary_members where diary_id = d.id;
  if cnt >= d.max_members then raise exception 'diary_full'; end if;

  insert into public.diary_members (diary_id, user_id, role, joined_date)
  values (d.id, r.user_id, 'member', public.user_today(r.user_id))
  on conflict do nothing;
  update public.join_requests set status = 'approved', decided_at = now() where id = p_request;
end $$;

-- ─────────────────────────────────────────────
-- remove_member [E2]: 내보내기. spec '삭제 처리 순서' 1~4를 한 트랜잭션에서
-- 1 entries(→ 달린 댓글·리액션 cascade) 2 남의 일기에 남긴 댓글·리액션(7단계 테이블) 3 entry_unlocks
-- 4 diary_members 삭제 + member_history
-- 돌려주는 사진 경로는 5(Storage 삭제) 대상.
-- TODO(9단계 #8) Edge Function으로 옮겨 서비스 권한으로 사진 삭제, member_removed/member_left 알림
-- ─────────────────────────────────────────────
create or replace function public.remove_member(p_diary uuid, p_user uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  photos text[];
begin
  if not public.is_owner(p_diary) then raise exception 'not_member'; end if;
  if not public.is_active_user() then raise exception 'suspended'; end if;
  if p_user = auth.uid() then raise exception 'not_member'; end if;
  if not public.is_member(p_diary, p_user) then raise exception 'not_member'; end if;

  select coalesce(array_agg(p), '{}') into photos
    from public.entries e, unnest(e.photo_paths) p
   where e.diary_id = p_diary and e.author_id = p_user;

  delete from public.entries where diary_id = p_diary and author_id = p_user;
  delete from public.entry_unlocks where diary_id = p_diary and user_id = p_user;
  delete from public.diary_members where diary_id = p_diary and user_id = p_user;
  insert into public.member_history (diary_id, user_id, reason) values (p_diary, p_user, 'removed');
  return photos;
end $$;

-- ─────────────────────────────────────────────
-- my_diaries: 주인이면 대기 요청 수
-- ─────────────────────────────────────────────
create or replace function public.my_diaries()
returns table (
  id uuid, name text, cover_color text, is_shared boolean, late_window_days smallint, invite_code text,
  owner_id uuid, created_date date, last_activity_at timestamptz, role text, pinned boolean, muted boolean,
  joined_date date, member_count int, members jsonb, wrote_today boolean, today_count int,
  recent_emotions text[], pending_requests int
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
              'avatar_emoji', p.avatar_emoji, 'avatar_path', p.avatar_path, 'role', x.role,
              'joined_date', x.joined_date)
            order by (x.user_id = me.uid) desc, (x.role = 'owner') desc, x.joined_at), '[]'::jsonb)
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
    case when m.role = 'owner' then
      (select count(*)::int from public.join_requests r
        where r.diary_id = d.id and r.status = 'pending' and r.created_at > now() - interval '30 days')
    else 0 end
  from me
  join public.diary_members m on m.user_id = me.uid
  join public.diaries d on d.id = m.diary_id
  order by m.pinned desc, d.last_activity_at desc
$$;

-- 실행 권한
do $$
declare f text;
begin
  foreach f in array array[
    'find_diary_by_code(text)', 'request_join(text)', 'cancel_request(uuid)', 'my_join_requests()',
    'diary_join_requests(uuid)', 'decide_request(uuid, boolean)', 'remove_member(uuid, uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['expire_stale_requests(uuid, uuid)', 'code_locked_seconds(uuid)', 'record_code_failure(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
