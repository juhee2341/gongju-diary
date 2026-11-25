/**
 * Docker 없이 마이그레이션·RLS·RPC를 검증한다.
 * PGlite(임베디드 Postgres)에 Supabase의 auth/storage 스키마와 역할을 최소한으로 흉내 낸 뒤
 * supabase/migrations/*.sql을 순서대로 적용하고 authenticated 역할로 쿼리한다.
 * 실제 Supabase와 다를 수 있는 부분(Storage API, auth 내부)은 dev 프로젝트에서 다시 확인한다.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const MIGRATIONS = path.resolve(import.meta.dirname, '../migrations');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

let db: PGlite;

async function as<T = Record<string, unknown>>(uid: string, sql: string): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.uid', '${uid}', false);`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec('reset role;');
  }
}

const completeProfile = (nick: string, tz: string) =>
  `select complete_profile('${nick}','emoji','👸',null,'2026-11-25',now(),'${tz}','나의 공주일기')`;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text,
      owner_id text default nullif(current_setting('request.uid', true), ''));
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to authenticated, anon;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    grant all on storage.objects, storage.buckets to authenticated;
  `);
  for (const f of fs.readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));
  }
  await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);
}, 60_000);

describe('[A1] touch_session', () => {
  it('프로필 없으면 has_profile=false', async () => {
    const [row] = await as(A, `select * from touch_session('Asia/Seoul')`);
    expect(row).toMatchObject({ has_profile: false });
  });
});

describe('[A4] complete_profile', () => {
  it('프로필·설정·"나의 공주일기"를 만들고, 다시 불러도 중복 생성하지 않는다', async () => {
    await as(A, completeProfile('공주A', 'Asia/Seoul'));
    await as(A, completeProfile('공주A', 'Asia/Seoul'));
    const diaries = await as(A, `select name, is_shared, late_window_days, invite_code, cover_color from diaries`);
    expect(diaries).toEqual([
      { name: '나의 공주일기', is_shared: false, late_window_days: 7, invite_code: null, cover_color: 'cover_1' },
    ]);
    expect(await as(A, `select role from diary_members`)).toEqual([{ role: 'owner' }]);
    const [touch] = await as(A, `select * from touch_session('Asia/Seoul')`);
    expect(touch).toMatchObject({ has_profile: true, status: 'active', terms_version: '2026-11-25' });
  });

  it('다른 사용자의 프로필·일기장은 보이지 않는다', async () => {
    await as(B, completeProfile('공주B', 'America/Los_Angeles'));
    expect(await as(B, `select nickname from profiles`)).toEqual([{ nickname: '공주B' }]);
    expect(await as(B, `select count(*)::int as n from diaries`)).toEqual([{ n: 1 }]);
  });

  it('status·약관 컬럼은 직접 수정할 수 없고, 남의 행은 수정되지 않는다', async () => {
    await expect(as(B, `update profiles set status='suspended' where id='${B}'`)).rejects.toThrow(/permission denied/);
    expect(await as(B, `update profiles set nickname='x' where id='${A}' returning id`)).toEqual([]);
  });
});

describe('[B2] create_diary', () => {
  it('함께 쓰기는 6자리 초대 코드(O·I 제외), 다른 사람에게는 안 보임', async () => {
    await as(A, `select create_diary('우리 일기장','cover_3',true,3::smallint)`);
    const [d] = await as<{ late_window_days: number; ok: boolean }>(
      A,
      `select late_window_days, invite_code ~ '^[A-HJ-NP-Z2-9]{6}$' as ok from diaries where is_shared`,
    );
    expect(d).toEqual({ late_window_days: 3, ok: true });
    expect(await as(B, `select count(*)::int as n from diaries where is_shared`)).toEqual([{ n: 0 }]);
  });

  it('금지어가 있으면 banned_word', async () => {
    await db.exec(`update app_config set value='["나쁜말"]' where key='banned_words'`);
    await expect(as(A, `select create_diary('나쁜말 일기','cover_1',false,7::smallint)`)).rejects.toThrow('banned_word');
    await db.exec(`update app_config set value='[]' where key='banned_words'`);
  });
});

describe('[A3] agree_terms', () => {
  it('RPC로만 약관 버전 갱신', async () => {
    await as(A, `select agree_terms('2027-01-01')`);
    expect(await as(A, `select terms_version from profiles where id='${A}'`)).toEqual([{ terms_version: '2027-01-01' }]);
    await expect(as(A, `update profiles set terms_version='x' where id='${A}'`)).rejects.toThrow(/permission denied/);
  });
});

describe('[B1] my_diaries', () => {
  it('내 일기장만, 고정 먼저 정렬, 멤버 정보 포함', async () => {
    const rows = await as<{ name: string; role: string; member_count: number; members: Array<{ nickname: string }> }>(
      A,
      `select name, role, member_count, members from my_diaries()`,
    );
    expect(rows.map((r) => r.name).sort()).toEqual(['나의 공주일기', '우리 일기장']);
    expect(rows.every((r) => r.role === 'owner' && r.member_count === 1)).toBe(true);
    expect(rows[0]!.members[0]!.nickname).toBe('공주A');

    await as(A, `update diary_members set pinned = true where diary_id = (select id from diaries where name='나의 공주일기')`);
    const [first] = await as<{ name: string; pinned: boolean }>(A, `select name, pinned from my_diaries()`);
    expect(first).toEqual({ name: '나의 공주일기', pinned: true });
    expect(await as(B, `select name from my_diaries()`)).toEqual([{ name: '나의 공주일기' }]);
  });
});

describe('[E1] 일기장 설정', () => {
  let solo = '';
  let shared = '';
  beforeAll(async () => {
    const rows = await as<{ id: string; is_shared: boolean }>(A, `select id, is_shared from diaries`);
    solo = `'${rows.find((r) => !r.is_shared)!.id}'::uuid`;
    shared = `'${rows.find((r) => r.is_shared)!.id}'::uuid`;
  });

  it('이름·커버는 주인이 직접 수정, 금지어는 트리거로 거부', async () => {
    await as(A, `update diaries set name='  새 이름 ', cover_color='cover_5' where id=${shared}`);
    expect(await as(A, `select name, cover_color from diaries where id=${shared}`)).toEqual([
      { name: '새 이름', cover_color: 'cover_5' },
    ]);
    await as(A, `update diaries set name='우리 일기장' where id=${shared}`);
    await db.exec(`update app_config set value='["나쁜말"]' where key='banned_words'`);
    await expect(as(A, `update diaries set name='나쁜말' where id=${shared}`)).rejects.toThrow('banned_word');
    await expect(as(A, `update profiles set nickname='나쁜말공주' where id='${A}'`)).rejects.toThrow('banned_word');
    await db.exec(`update app_config set value='[]' where key='banned_words'`);
  });

  it('늦게 쓰기 기간은 RPC로만, 함께 쓰기·주인만', async () => {
    await expect(as(A, `update diaries set late_window_days=1 where id=${shared}`)).rejects.toThrow(/permission denied/);
    await as(A, `select set_late_window(${shared}, 7::smallint)`);
    expect(await as(A, `select late_window_days from diaries where id=${shared}`)).toEqual([{ late_window_days: 7 }]);
    await expect(as(A, `select set_late_window(${solo}, 1::smallint)`)).rejects.toThrow('not_member');
    await expect(as(A, `select set_late_window(${shared}, 5::smallint)`)).rejects.toThrow('date_out_of_range');
    await expect(as(B, `select set_late_window(${shared}, 1::smallint)`)).rejects.toThrow('not_member');
  });

  it('초대 코드 재발급', async () => {
    const [before] = await as<{ invite_code: string }>(A, `select invite_code from diaries where id=${shared}`);
    const [after] = await as<{ code: string }>(A, `select regenerate_invite_code(${shared}) as code`);
    expect(after!.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(after!.code).not.toBe(before!.invite_code);
    await expect(as(B, `select regenerate_invite_code(${shared})`)).rejects.toThrow('not_member');
  });

  it('혼자 쓰기 → 함께 쓰기 전환', async () => {
    const [r] = await as<{ code: string }>(A, `select convert_to_shared(${solo}, 3::smallint) as code`);
    expect(r!.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(await as(A, `select is_shared, late_window_days from diaries where id=${solo}`)).toEqual([
      { is_shared: true, late_window_days: 3 },
    ]);
  });

  it('muted·pinned는 본인 행만', async () => {
    await as(A, `update diary_members set muted=true where diary_id=${shared}`);
    expect(await as(A, `select muted from diary_members where diary_id=${shared}`)).toEqual([{ muted: true }]);
    await expect(as(A, `update diary_members set role='member' where diary_id=${shared}`)).rejects.toThrow(/permission denied/);
  });
});

describe('avatars 버킷', () => {
  it('본인 경로만 쓸 수 있다', async () => {
    expect(await as(A, `insert into storage.objects (bucket_id,name) values ('avatars','${A}.jpg') returning name`)).toEqual([
      { name: `${A}.jpg` },
    ]);
    await expect(as(A, `insert into storage.objects (bucket_id,name) values ('avatars','${B}.jpg')`)).rejects.toThrow(
      /row-level security/,
    );
  });
});

describe('[D1] save_entry — 3단계', () => {
  let diary = ''; // A의 함께 쓰기 일기장(기간 7일)
  const today = `public.user_today('${A}')`;
  const id = (n: number) => `'00000000-0000-4000-8000-00000000000${n}'::uuid`;
  const save = (n: number, date: string, content: string, photos = `'{}'::text[]`, deviceToday = today) =>
    `select id, is_late, edited from save_entry(${id(n)}, '${diary}'::uuid, ${date}, 'happy', '${content}', ${photos}, ${deviceToday})`;

  beforeAll(async () => {
    const [d] = await as<{ id: string }>(A, `select id from diaries where is_shared and late_window_days = 7`);
    diary = d!.id;
    // 참여일을 과거로 돌려 늦게 쓰기 범위를 확인할 수 있게 한다(테스트 전용)
    await db.exec(`update diary_members set joined_date = ${today} - 30 where diary_id = '${diary}'`);
  });

  it('오늘 일기 저장 + 열림 기록 + 오늘 작성 리본', async () => {
    expect(await as(A, save(1, today, '오늘은 좋은 날'))).toEqual([
      { id: '00000000-0000-4000-8000-000000000001', is_late: false, edited: false },
    ]);
    expect(await as(A, `select count(*)::int as n from entry_unlocks where diary_id='${diary}'`)).toEqual([{ n: 1 }]);
    const [row] = await as<{ wrote_today: boolean; today_count: number; recent_emotions: string[] }>(
      A,
      `select wrote_today, today_count, recent_emotions from my_diaries() where id='${diary}'`,
    );
    expect(row).toEqual({ wrote_today: true, today_count: 1, recent_emotions: ['happy'] });
  });

  it('T15 같은 날짜 두 번 → entry_exists', async () => {
    await expect(as(A, save(2, today, '다른 기기에서 저장'))).rejects.toThrow('entry_exists');
  });

  it('T17 사진 없이 4자 → too_short', async () => {
    await expect(as(A, save(3, `${today} - 1`, '네글자다'))).rejects.toThrow('too_short');
  });

  it('T4 기간 안 늦은 일기, T5 기간 밖 거부, 미래 거부', async () => {
    expect(await as(A, save(3, `${today} - 7`, '일주일 전 일기'))).toEqual([
      { id: '00000000-0000-4000-8000-000000000003', is_late: true, edited: false },
    ]);
    await expect(as(A, save(4, `${today} - 8`, '여드레 전 일기'))).rejects.toThrow('date_out_of_range');
    await expect(as(A, save(4, `${today} + 1`, '내일 일기예요'))).rejects.toThrow('date_out_of_range');
  });

  it('기기 날짜가 이틀 이상 다르면 device_date_invalid', async () => {
    await expect(as(A, save(4, today, '기기 날짜 이상', `'{}'::text[]`, `${today} + 2`))).rejects.toThrow('device_date_invalid');
  });

  it('수정은 edited=true, 날짜 유지', async () => {
    expect(await as(A, save(1, `${today} - 1`, '고쳐 쓴 오늘 일기'))).toEqual([
      { id: '00000000-0000-4000-8000-000000000001', is_late: false, edited: true },
    ]);
    expect(await as(A, `select entry_date = ${today} as same from entries where id=${id(1)}`)).toEqual([{ same: true }]);
  });

  it('사진만 있는 일기, 사진 경로는 {diary}/{entry}/n.jpg만', async () => {
    const good = `array['${diary}/00000000-0000-4000-8000-000000000005/1.jpg']`;
    expect((await as(A, save(5, `${today} - 2`, '', good))).length).toBe(1);
    const bad = `array['${diary}/other/1.jpg']`;
    await expect(as(A, save(6, `${today} - 3`, '', bad))).rejects.toThrow('entry_not_found');
  });

  it('남의 일기는 읽기·수정·삭제 불가, 멤버 아니면 저장 불가', async () => {
    expect(await as(B, `select count(*)::int as n from entries`)).toEqual([{ n: 0 }]);
    await expect(as(B, save(1, today, '남의 일기 고치기'))).rejects.toThrow('not_member');
    expect(await as(B, `delete from entries where id=${id(1)} returning id`)).toEqual([]);
    await expect(as(A, `insert into entries (id, diary_id, author_id, entry_date, emotion, content) values (gen_random_uuid(), '${diary}', '${A}', ${today} - 4, 'sad', '직접 넣기')`)).rejects.toThrow(/permission denied/);
  });

  it('T3 삭제해도 열림은 유지, 같은 날짜 다시 쓰기 가능', async () => {
    expect((await as(A, `delete from entries where id=${id(1)} returning id`)).length).toBe(1);
    expect(await as(A, `select count(*)::int as n from entry_unlocks where diary_id='${diary}' and entry_date=${today}`)).toEqual([{ n: 1 }]);
    expect((await as(A, save(7, today, '다시 쓴 오늘 일기'))).length).toBe(1);
  });

  it('entry-photos: 멤버만 업로드, 일기가 생기면 작성자만', async () => {
    const path = (n: number) => `${diary}/00000000-0000-4000-8000-00000000000${n}/1.jpg`;
    expect(await as(A, `insert into storage.objects (bucket_id,name) values ('entry-photos','${path(9)}') returning name`)).toHaveLength(1);
    await expect(as(B, `insert into storage.objects (bucket_id,name) values ('entry-photos','${path(8)}')`)).rejects.toThrow(/row-level security/);
    await expect(as(A, `insert into storage.objects (bucket_id,name) values ('entry-photos','${diary}/x/1.jpg')`)).rejects.toThrow(/row-level security/);
    expect(await as(B, `select count(*)::int as n from storage.objects where bucket_id='entry-photos'`)).toEqual([{ n: 0 }]);
  });
});

describe('[C1~C4] diary_entries_meta — 4단계', () => {
  let diary = '';
  const today = `public.user_today('${A}')`;
  beforeAll(async () => {
    const [d] = await as<{ id: string }>(A, `select id from diaries where is_shared and late_window_days = 7`);
    diary = d!.id;
    // 참여 기능(5단계) 전이라 테스트에서 직접 멤버로 넣는다
    await db.exec(`insert into diary_members (diary_id, user_id, role, joined_date) values ('${diary}', '${B}', 'member', ${today} - 30)`);
    await as(
      B,
      `select save_entry('00000000-0000-4000-8000-0000000000b1'::uuid, '${diary}'::uuid, public.user_today('${B}'), 'sad', 'B가 쓴 비밀 일기', '{}'::text[], public.user_today('${B}'))`,
    );
  });

  it('내 일기는 감정까지, 남의 일기는 작성자·날짜만(잠김)', async () => {
    const rows = await as<{ author_id: string; viewable: boolean; entry_id: string | null; emotion: string | null }>(
      A,
      `select author_id, viewable, entry_id, emotion from diary_entries_meta('${diary}', ${today} - 10, ${today} + 1) order by author_id`,
    );
    const mine = rows.filter((r) => r.author_id === A);
    const theirs = rows.filter((r) => r.author_id === B);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.viewable && r.entry_id && r.emotion)).toBe(true);
    expect(theirs).toEqual([{ author_id: B, viewable: false, entry_id: null, emotion: null }]);
  });

  it('멤버 아니면 not_member, 기간이 400일 넘으면 거부', async () => {
    const [solo] = await as<{ id: string }>(A, `select id from diaries where late_window_days = 3`);
    await expect(as(B, `select * from diary_entries_meta('${solo!.id}', ${today} - 1, ${today})`)).rejects.toThrow('not_member');
    await expect(as(A, `select * from diary_entries_meta('${diary}', ${today} - 500, ${today})`)).rejects.toThrow('date_out_of_range');
  });

  it('my_diaries 멤버 순서: 나 → 주인 → 참여순, 참여일 포함', async () => {
    const [row] = await as<{ members: Array<{ user_id: string; joined_date: string }> }>(
      B,
      `select members from my_diaries() where id='${diary}'`,
    );
    expect(row!.members.map((m) => m.user_id)).toEqual([B, A]);
    expect(row!.members[0]!.joined_date).toBeTruthy();
  });
});

describe('[B3][B4][E2] 공유 — 5단계', () => {
  const C = '33333333-3333-3333-3333-333333333333';
  let diary = '';
  let code = '';
  beforeAll(async () => {
    await db.exec(`insert into auth.users values ('${C}')`);
    await as(C, completeProfile('공주C', 'Asia/Seoul'));
    const [d] = await as<{ id: string; invite_code: string }>(A, `select id, invite_code from diaries where is_shared and late_window_days = 7`);
    diary = d!.id;
    code = d!.invite_code;
  });

  it('없는 코드는 code_invalid, 10회째 60초 잠금(T18)', async () => {
    for (let i = 1; i <= 9; i++) {
      const [r] = await as<{ f: { status: string } }>(C, `select find_diary_by_code('ZZZZZ${i}') as f`);
      expect(r!.f.status).toBe('code_invalid');
    }
    const [tenth] = await as<{ f: { status: string; locked_seconds: number } }>(C, `select find_diary_by_code('ZZZZZZ') as f`);
    expect(tenth!.f.status).toBe('code_locked');
    expect(tenth!.f.locked_seconds).toBeGreaterThan(50);
    const [still] = await as<{ f: { status: string } }>(C, `select find_diary_by_code('${code}') as f`);
    expect(still!.f.status).toBe('code_locked');
    await db.exec(`update code_failures set locked_until = now() - interval '1 second' where user_id = '${C}'`);
  });

  it('맞는 코드: 소문자도 미리보기, 요청 → 대기 중, 중복 요청 불가', async () => {
    const [r] = await as<{ f: Record<string, unknown> }>(C, `select find_diary_by_code('${code.toLowerCase()}') as f`);
    expect(r!.f).toMatchObject({ status: 'ok', diary_id: diary, owner_nickname: '공주A', member_count: 2 });
    await as(C, `select request_join('${code}')`);
    const [again] = await as<{ f: { status: string } }>(C, `select find_diary_by_code('${code}') as f`);
    expect(again!.f.status).toBe('request_pending');
    await expect(as(C, `select request_join('${code}')`)).rejects.toThrow('request_pending');
    expect(await as(C, `select name, status from my_join_requests()`)).toEqual([{ name: '우리 일기장', status: 'pending' }]);
  });

  it('멤버가 아니라 일기장 본문은 못 읽고, 주인만 요청 목록을 본다', async () => {
    expect(await as(C, `select count(*)::int as n from diaries where id='${diary}'`)).toEqual([{ n: 0 }]);
    expect((await as(A, `select nickname from diary_join_requests('${diary}')`))).toEqual([{ nickname: '공주C' }]);
    await expect(as(B, `select * from diary_join_requests('${diary}')`)).rejects.toThrow('not_member');
    const [cnt] = await as<{ pending_requests: number }>(A, `select pending_requests from my_diaries() where id='${diary}'`);
    expect(cnt!.pending_requests).toBe(1);
  });

  it('거절 → 24시간 재요청 불가, 다시 승인 흐름', async () => {
    const [req] = await as<{ id: string }>(A, `select id from diary_join_requests('${diary}')`);
    await as(A, `select decide_request('${req!.id}', false)`);
    await expect(as(A, `select decide_request('${req!.id}', true)`)).rejects.toThrow('request_closed');
    const [cool] = await as<{ f: { status: string } }>(C, `select find_diary_by_code('${code}') as f`);
    expect(cool!.f.status).toBe('reject_cooldown');
    await db.exec(`update join_requests set decided_at = now() - interval '25 hours' where id = '${req!.id}'`);
    await as(C, `select request_join('${code}')`);
    const [req2] = await as<{ id: string }>(A, `select id from diary_join_requests('${diary}')`);
    await as(A, `select decide_request('${req2!.id}', true)`);
    const [m] = await as<{ role: string; joined_date: string }>(C, `select role, joined_date from diary_members where diary_id='${diary}' and user_id='${C}'`);
    expect(m!.role).toBe('member');
    const [already] = await as<{ f: { status: string } }>(C, `select find_diary_by_code('${code}') as f`);
    expect(already!.f.status).toBe('already_member');
  });

  it('취소는 요청자만, 대기 중일 때만', async () => {
    const D = '44444444-4444-4444-4444-444444444444';
    await db.exec(`insert into auth.users values ('${D}')`);
    await as(D, completeProfile('공주D', 'Asia/Seoul'));
    const [r] = await as<{ id: string }>(D, `select request_join('${code}') as id`);
    await expect(as(C, `select cancel_request('${r!.id}')`)).rejects.toThrow('request_closed');
    await as(D, `select cancel_request('${r!.id}')`);
    await expect(as(D, `select cancel_request('${r!.id}')`)).rejects.toThrow('request_closed');
  });

  it('T19 10명이면 승인 불가(diary_full)', async () => {
    const E = '55555555-5555-5555-5555-555555555555';
    await db.exec(`insert into auth.users values ('${E}')`);
    await as(E, completeProfile('공주E', 'Asia/Seoul'));
    const [r] = await as<{ id: string }>(E, `select request_join('${code}') as id`);
    await db.exec(`update diaries set max_members = 3 where id='${diary}'`);
    await expect(as(A, `select decide_request('${r!.id}', true)`)).rejects.toThrow('diary_full');
    const [f] = await as<{ f: { status: string } }>(E, `select find_diary_by_code('${code}') as f`);
    expect(f!.f.status).toBe('request_pending');
    await db.exec(`update diaries set max_members = 10 where id='${diary}'`);
  });

  it('내보내기: 그 사람 일기·열림 기록 삭제, 이전 멤버로 표시', async () => {
    await as(
      C,
      `select save_entry('00000000-0000-4000-8000-0000000000c1'::uuid, '${diary}'::uuid, public.user_today('${C}'), 'happy', 'C가 쓴 일기예요', array['${diary}/00000000-0000-4000-8000-0000000000c1/1.jpg'], public.user_today('${C}'))`,
    );
    await expect(as(B, `select remove_member('${diary}', '${C}')`)).rejects.toThrow('not_member');
    await expect(as(A, `select remove_member('${diary}', '${A}')`)).rejects.toThrow('not_member');
    const [r] = await as<{ photos: string[] }>(A, `select remove_member('${diary}', '${C}') as photos`);
    expect(r!.photos).toEqual([`${diary}/00000000-0000-4000-8000-0000000000c1/1.jpg`]);
    expect(await db.query(`select count(*)::int as n from entries where author_id='${C}' and diary_id='${diary}'`).then((x) => x.rows)).toEqual([{ n: 0 }]);
    expect(await db.query(`select count(*)::int as n from entry_unlocks where user_id='${C}' and diary_id='${diary}'`).then((x) => x.rows)).toEqual([{ n: 0 }]);
    await as(C, `select request_join('${code}')`);
    const reqs = await as<{ nickname: string; former_member: boolean }>(A, `select nickname, former_member from diary_join_requests('${diary}') order by nickname`);
    expect(reqs).toContainEqual({ nickname: '공주C', former_member: true });
  });
});
