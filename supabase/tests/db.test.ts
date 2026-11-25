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
