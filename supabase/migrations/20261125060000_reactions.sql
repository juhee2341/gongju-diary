-- 로드맵 7단계: 반응 — 댓글·리액션 (D2) — 이슈 #6
-- 읽기는 일기가 열람 규칙(can_view_entry)을 통과할 때만. 쓰기는 RPC로만.
-- TODO(10단계 #9) 차단 관계·신고한 댓글 숨김

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  content text not null check (char_length(btrim(content)) between 1 and 200), -- 앱은 grapheme 100자
  created_at timestamptz not null default now()
);
create index comments_entry_created on public.comments (entry_id, created_at);
create index comments_author_created on public.comments (author_id, created_at desc);

create table public.reactions (
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  reaction text not null check (reaction in ('heart','crown','laugh','hug','wow','sparkle')),
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);
create index reactions_entry on public.reactions (entry_id);

alter table public.comments enable row level security;
alter table public.reactions enable row level security;

create policy comments_read on public.comments for select to authenticated
  using (public.can_view_entry(entry_id));
-- 삭제: 댓글 작성자 또는 그 일기 작성자
create policy comments_delete on public.comments for delete to authenticated
  using (
    public.is_active_user() and (
      author_id = auth.uid()
      or exists (select 1 from public.entries e where e.id = entry_id and e.author_id = auth.uid())
    )
  );
revoke insert, update on public.comments from authenticated;

create policy reactions_read on public.reactions for select to authenticated
  using (public.can_view_entry(entry_id));
revoke insert, update, delete on public.reactions from authenticated;

-- ─────────────────────────────────────────────
-- add_comment [D2]: 볼 수 있는 일기에만, COMMENT_RATE(같은 사람 5초에 1개)
-- TODO(8단계 #7) comment_created 알림
-- ─────────────────────────────────────────────
create or replace function public.add_comment(p_entry uuid, p_content text)
returns public.comments language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  body text := btrim(coalesce(p_content, ''));
  e public.entries;
  c public.comments;
begin
  if uid is null then raise exception 'not_member'; end if;
  if not public.is_active_user(uid) then raise exception 'suspended'; end if;
  select * into e from public.entries where id = p_entry;
  if e.id is null then raise exception 'entry_not_found'; end if;
  if not public.is_member(e.diary_id, uid) then raise exception 'not_member'; end if;
  if not public.entry_viewable(uid, e.diary_id, e.entry_date, e.author_id) then raise exception 'entry_not_found'; end if;
  if body = '' then raise exception 'too_short'; end if;
  if exists (select 1 from public.comments x where x.author_id = uid and x.created_at > now() - interval '5 seconds') then
    raise exception 'rate_limited';
  end if;
  insert into public.comments (entry_id, author_id, content) values (p_entry, uid, body) returning * into c;
  update public.diaries set last_activity_at = now() where id = e.diary_id;
  return c;
end $$;

-- ─────────────────────────────────────────────
-- set_reaction [D2]: 1인 1개. null이면 취소, 다른 걸 주면 교체
-- TODO(8단계 #7) reaction_created 알림(본인 반응 제외, 묶음)
-- ─────────────────────────────────────────────
create or replace function public.set_reaction(p_entry uuid, p_reaction text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e public.entries;
begin
  if uid is null then raise exception 'not_member'; end if;
  if not public.is_active_user(uid) then raise exception 'suspended'; end if;
  select * into e from public.entries where id = p_entry;
  if e.id is null then raise exception 'entry_not_found'; end if;
  if not public.is_member(e.diary_id, uid) then raise exception 'not_member'; end if;
  if not public.entry_viewable(uid, e.diary_id, e.entry_date, e.author_id) then raise exception 'entry_not_found'; end if;
  if p_reaction is null then
    delete from public.reactions where entry_id = p_entry and user_id = uid;
  else
    insert into public.reactions (entry_id, user_id, reaction) values (p_entry, uid, p_reaction)
    on conflict (entry_id, user_id) do update set reaction = excluded.reaction, created_at = now();
  end if;
end $$;

-- ─────────────────────────────────────────────
-- diary_entries_meta: 볼 수 있는 일기에 리액션 수·댓글 수(C4 카드 하단)
-- ─────────────────────────────────────────────
drop function public.diary_entries_meta(uuid, date, date);
create or replace function public.diary_entries_meta(p_diary uuid, p_from date, p_to date)
returns table (
  entry_date date, author_id uuid, viewable boolean, entry_id uuid, emotion text,
  is_late boolean, edited boolean, reaction_count int, comment_count int
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
           case when v.ok then e.edited end,
           case when v.ok then (select count(*)::int from public.reactions r where r.entry_id = e.id) end,
           case when v.ok then (select count(*)::int from public.comments c where c.entry_id = e.id) end
      from public.entries e
      cross join lateral (select public.entry_viewable(uid, e.diary_id, e.entry_date, e.author_id) as ok) v
     where e.diary_id = p_diary and e.entry_date between p_from and p_to
     order by e.entry_date, e.created_at;
end $$;

-- ─────────────────────────────────────────────
-- remove_member: 삭제 순서 2번(다른 일기에 남긴 그 사람의 댓글·리액션) 추가
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

  delete from public.entries where diary_id = p_diary and author_id = p_user;                -- 1
  delete from public.comments c using public.entries e
   where c.entry_id = e.id and e.diary_id = p_diary and c.author_id = p_user;                  -- 2
  delete from public.reactions r using public.entries e
   where r.entry_id = e.id and e.diary_id = p_diary and r.user_id = p_user;                    -- 2
  delete from public.entry_unlocks where diary_id = p_diary and user_id = p_user;              -- 3
  delete from public.diary_members where diary_id = p_diary and user_id = p_user;              -- 4
  insert into public.member_history (diary_id, user_id, reason) values (p_diary, p_user, 'removed');
  return photos;
end $$;

revoke execute on function public.add_comment(uuid, text) from public, anon;
revoke execute on function public.set_reaction(uuid, text) from public, anon;
revoke execute on function public.diary_entries_meta(uuid, date, date) from public, anon;
grant execute on function public.add_comment(uuid, text) to authenticated;
grant execute on function public.set_reaction(uuid, text) to authenticated;
grant execute on function public.diary_entries_meta(uuid, date, date) to authenticated;
