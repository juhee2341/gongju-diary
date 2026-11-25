-- 로드맵 6단계: 공개 규칙 — 이슈 #5
-- 열람자 V가 일기장 X의 날짜 D 일기(작성자 A)를 볼 수 있는 조건: V가 X의 멤버이고 1~4 중 하나 + 5
--  1. A = V
--  2. V에게 (X, D) 열림 기록이 있다
--  3. D < V의 오늘 − LATE_WINDOW (자동 공개)
--  4. D < V의 참여일 (참여 전 기록은 바로 공개)
--  5. V와 A 사이에 차단 관계가 없다 — TODO(10단계 #9) blocks 테이블과 함께 추가
-- 사진(Storage)도 같은 조건을 따른다.

create or replace function public.entry_viewable(viewer uuid, p_diary uuid, p_date date, p_author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when viewer is null then false
    when p_author = viewer then true
    else exists (
      select 1
        from public.diary_members m
        join public.diaries d on d.id = m.diary_id
       where m.diary_id = p_diary and m.user_id = viewer
         and (
           exists (select 1 from public.entry_unlocks u
                    where u.diary_id = p_diary and u.user_id = viewer and u.entry_date = p_date)
           or p_date < public.user_today(viewer) - d.late_window_days
           or p_date < m.joined_date
         )
    )
  end
$$;

-- spec 서버 함수 이름: can_view_entry(entry)
create or replace function public.can_view_entry(p_entry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.entry_viewable(auth.uid(), e.diary_id, e.entry_date, e.author_id)
                     from public.entries e where e.id = p_entry), false)
$$;

-- entries 읽기: 작성자 본인 → 열람 규칙
drop policy entries_read_own on public.entries;
create policy entries_read on public.entries for select to authenticated
  using (public.entry_viewable(auth.uid(), diary_id, entry_date, author_id));

-- Storage 읽기: 경로의 entry_id로 같은 판정(기술 검증 3번)
create or replace function public.entry_photo_readable(object_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  entry uuid;
begin
  if object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/' then return false; end if;
  entry := split_part(object_name, '/', 2)::uuid;
  return public.can_view_entry(entry);
end $$;

-- ─────────────────────────────────────────────
-- entry_status [D2]: 알림·링크로 직접 들어왔을 때 열림/잠김/삭제 구분(잠김이면 C4로 보낸다)
-- ─────────────────────────────────────────────
create or replace function public.entry_status(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.entries;
begin
  select * into e from public.entries where id = p_entry;
  if e.id is null or not public.is_member(e.diary_id) then return jsonb_build_object('status', 'missing'); end if;
  return jsonb_build_object(
    'status', case when public.entry_viewable(auth.uid(), e.diary_id, e.entry_date, e.author_id) then 'viewable' else 'locked' end,
    'diary_id', e.diary_id,
    'entry_date', e.entry_date
  );
end $$;

-- ─────────────────────────────────────────────
-- set_late_window: 기간을 늘릴 때, 늘리기 전에 자동 공개였던 날짜가 다시 잠기지 않도록
-- 멤버마다(각자의 오늘 기준) [오늘 − 새 기간, 오늘 − 옛 기간 − 1] 날짜에 열림 기록을 만든다(T7)
-- 줄일 때는 자동 공개 판정(규칙 3)이 바로 넓어지므로 따로 할 일이 없다(T6)
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

  if p_days > d.late_window_days then
    insert into public.entry_unlocks (diary_id, user_id, entry_date)
    select p_diary, m.user_id, g::date
      from public.diary_members m
      cross join lateral generate_series(
        greatest(public.user_today(m.user_id) - p_days, m.joined_date),
        public.user_today(m.user_id) - d.late_window_days - 1,
        interval '1 day') g
     where m.diary_id = p_diary
    on conflict do nothing;
  end if;

  update public.diaries set late_window_days = p_days where id = p_diary;
end $$;

revoke execute on function public.can_view_entry(uuid) from public, anon;
grant execute on function public.can_view_entry(uuid) to authenticated;
revoke execute on function public.entry_status(uuid) from public, anon;
grant execute on function public.entry_status(uuid) to authenticated;
