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
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
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
