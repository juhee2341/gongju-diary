/**
 * dev Supabase 실서버 E2E. `pnpm test:live`로만 실행한다(.env 필요).
 * 익명 사용자를 새로 만들어 앱과 같은 경로(supabase-js)로 RPC·RLS·Storage를 확인한다.
 * 테스트가 만든 사용자는 dev 서버에 남는다(ANON_PURGE 대상이 아니므로 주기적으로 정리).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const envFile = path.resolve(import.meta.dirname, '../../../.env');
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

const mk = () =>
  createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });

const profileArgs = (nickname: string, tz: string) => ({
  p_nickname: nickname,
  p_avatar_type: 'emoji',
  p_avatar_emoji: '👸',
  p_avatar_path: null,
  p_terms_version: '2026-11-25',
  p_terms_agreed_at: new Date().toISOString(),
  p_timezone: tz,
  p_solo_diary_name: '나의 공주일기',
});

// 1×1 JPEG
const JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z',
  'base64',
);

let a: SupabaseClient;
let b: SupabaseClient;
let aId = '';
let bId = '';

beforeAll(async () => {
  a = mk();
  b = mk();
  const ra = await a.auth.signInAnonymously();
  const rb = await b.auth.signInAnonymously();
  expect(ra.error).toBeNull();
  expect(rb.error).toBeNull();
  aId = ra.data.user!.id;
  bId = rb.data.user!.id;
}, 30_000);

describe('1단계 [A1][A4]', () => {
  it('프로필 없음 → complete_profile → 프로필·"나의 공주일기"', async () => {
    const before = await a.rpc('touch_session', { p_timezone: 'Asia/Seoul' });
    expect(before.data).toEqual([{ has_profile: false, status: null, terms_version: null }]);
    expect((await a.rpc('complete_profile', profileArgs('공주A', 'Asia/Seoul'))).error).toBeNull();
    expect((await b.rpc('complete_profile', profileArgs('공주B', 'America/Los_Angeles'))).error).toBeNull();
    const after = await a.rpc('touch_session', { p_timezone: 'Asia/Seoul' });
    expect(after.data?.[0]).toMatchObject({ has_profile: true, status: 'active' });
    const diaries = await a.from('diaries').select('name, is_shared, late_window_days');
    expect(diaries.data).toEqual([{ name: '나의 공주일기', is_shared: false, late_window_days: 7 }]);
  });

  it('RLS: 남의 프로필 안 보임, status 직접 수정 불가', async () => {
    expect((await b.from('profiles').select('nickname')).data).toEqual([{ nickname: '공주B' }]);
    const r = await b.from('profiles').update({ status: 'suspended' }).eq('id', bId);
    expect(r.error?.message).toMatch(/permission denied/);
  });

  it('avatars: 본인 경로만 쓰기', async () => {
    const own = await a.storage.from('avatars').upload(`${aId}.jpg`, JPG, { contentType: 'image/jpeg', upsert: true });
    expect(own.error).toBeNull();
    const other = await a.storage.from('avatars').upload(`${bId}.jpg`, JPG, { contentType: 'image/jpeg', upsert: true });
    expect(other.error?.message).toMatch(/row-level security/);
    expect((await b.storage.from('avatars').download(`${aId}.jpg`)).error).toBeNull();
  });
});

describe('2단계 [B1][B2][E1]', () => {
  let shared = '';
  it('함께 쓰기 일기장 만들기 + my_diaries', async () => {
    const r = await a.rpc('create_diary', {
      p_name: '우리 일기장',
      p_cover_color: 'cover_3',
      p_is_shared: true,
      p_late_window_days: 3,
    });
    expect(r.error).toBeNull();
    shared = r.data as string;
    const list = (await a.rpc('my_diaries')).data as Array<{ id: string; invite_code: string | null; member_count: number }>;
    const d = list.find((x) => x.id === shared)!;
    expect(d.invite_code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(d.member_count).toBe(1);
  });

  it('이름·커버 직접 수정, 기간은 RPC로만', async () => {
    const u = await a.from('diaries').update({ name: '새 이름', cover_color: 'cover_5' }, { count: 'exact' }).eq('id', shared);
    expect(u.count).toBe(1);
    const direct = await a.from('diaries').update({ late_window_days: 1 }).eq('id', shared);
    expect(direct.error?.message).toMatch(/permission denied/);
    expect((await a.rpc('set_late_window', { p_diary: shared, p_days: 7 })).error).toBeNull();
    expect((await b.rpc('set_late_window', { p_diary: shared, p_days: 1 })).error?.message).toBe('not_member');
  });

  it('코드 재발급, 혼자 → 함께 전환, 고정 정렬', async () => {
    expect((await a.rpc('regenerate_invite_code', { p_diary: shared })).data).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const list = (await a.rpc('my_diaries')).data as Array<{ id: string; is_shared: boolean; name: string; pinned: boolean }>;
    const solo = list.find((d) => !d.is_shared)!.id;
    expect((await a.rpc('convert_to_shared', { p_diary: solo, p_days: 3 })).data).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    await a.from('diary_members').update({ pinned: true }).match({ diary_id: solo, user_id: aId });
    const ordered = (await a.rpc('my_diaries')).data as Array<{ id: string; pinned: boolean }>;
    expect(ordered[0]).toMatchObject({ id: solo, pinned: true });
  });
});
