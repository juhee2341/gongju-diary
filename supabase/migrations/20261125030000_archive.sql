-- 로드맵 4단계: 보관 화면 (C1~C4) — 이슈 #3
-- 열람 판정을 함수 하나(entry_viewable)로 모은다. 6단계(#5)에서 이 함수만 열람 규칙 1~5로 바꾼다.

-- ─────────────────────────────────────────────
-- entry_viewable: 열람자 viewer가 (diary, date, author)의 일기를 볼 수 있는가
-- TODO(6단계 #5) 열람 규칙 1~5(열림 기록, 자동 공개, 참여 전 날짜, 차단)로 교체
-- 지금은 규칙 1(작성자 본인)만 — entries RLS(작성자 본인 읽기)와 일치
-- ─────────────────────────────────────────────
create or replace function public.entry_viewable(viewer uuid, p_diary uuid, p_date date, p_author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_author = viewer
$$;

-- ─────────────────────────────────────────────
-- diary_entries_meta RPC [C1~C4]
-- 기간 안의 일기를 작성자·날짜 단위로. 볼 수 있으면 id·감정·배지까지, 잠겼으면 작성자·날짜만
-- ─────────────────────────────────────────────
create or replace function public.diary_entries_meta(p_diary uuid, p_from date, p_to date)
returns table (
  entry_date date,
  author_id uuid,
  viewable boolean,
  entry_id uuid,
  emotion text,
  is_late boolean,
  edited boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.is_member(p_diary, uid) then raise exception 'not_member'; end if;
  if p_to - p_from > 400 then raise exception 'date_out_of_range'; end if;
  return query
    select e.entry_date, e.author_id, v.ok,
           case when v.ok then e.id end,
           case when v.ok then e.emotion end,
           case when v.ok then e.is_late end,
           case when v.ok then e.edited end
      from public.entries e
      cross join lateral (select public.entry_viewable(uid, e.diary_id, e.entry_date, e.author_id) as ok) v
     where e.diary_id = p_diary and e.entry_date between p_from and p_to
     order by e.entry_date, e.created_at;
end $$;

revoke execute on function public.diary_entries_meta(uuid, date, date) from public, anon;
grant execute on function public.diary_entries_meta(uuid, date, date) to authenticated;
revoke execute on function public.entry_viewable(uuid, uuid, date, uuid) from public, anon;

-- ─────────────────────────────────────────────
-- my_diaries: 멤버 정보에 참여일 추가(C1 "참여 전 날짜는 아바타 표시 안 함", C4 "아직 안 쓴 공주들")
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
    0 -- TODO(5단계 #4) pending_requests
  from me
  join public.diary_members m on m.user_id = me.uid
  join public.diaries d on d.id = m.diary_id
  order by m.pinned desc, d.last_activity_at desc
$$;
