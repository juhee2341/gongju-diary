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

describe('3단계 [D1][D2]', () => {
  let diary = '';
  let today = '';
  const entryId = crypto.randomUUID();
  const path = (n: number, thumb = false) => `${diary}/${entryId}/${n}${thumb ? '_thumb' : ''}.jpg`;

  beforeAll(async () => {
    const list = (await a.rpc('my_diaries')).data as Array<{ id: string; is_shared: boolean }>;
    diary = list.find((d) => d.is_shared)!.id;
    const { data } = await a.from('user_settings').select('timezone').single();
    today = new Intl.DateTimeFormat('en-CA', { timeZone: data!.timezone }).format(new Date());
  });

  it('사진 업로드(원본+썸네일) → save_entry → 리본·오늘 N명', async () => {
    for (const p of [path(1), path(1, true)]) {
      expect((await a.storage.from('entry-photos').upload(p, JPG, { contentType: 'image/jpeg', upsert: true })).error).toBeNull();
    }
    // 다른 사람은 남의 일기 경로에 못 올림(멤버 아님)
    const other = await b.storage.from('entry-photos').upload(`${diary}/${entryId}/2.jpg`, JPG, { contentType: 'image/jpeg' });
    expect(other.error?.message).toMatch(/row-level security/);

    const r = await a.rpc('save_entry', {
      p_id: entryId,
      p_diary: diary,
      p_date: today,
      p_emotion: 'love',
      p_content: '실서버에서 쓴 첫 일기',
      p_photo_paths: [path(1)],
      p_device_today: today,
    });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ id: entryId, is_late: false, edited: false, photo_paths: [path(1)] });

    const d = ((await a.rpc('my_diaries')).data as Array<{ id: string; wrote_today: boolean; today_count: number }>).find(
      (x) => x.id === diary,
    )!;
    expect(d).toMatchObject({ wrote_today: true, today_count: 1 });
  });

  it('T15 같은 날짜 다시 → entry_exists, T17 4자 → too_short', async () => {
    const dup = await a.rpc('save_entry', {
      p_id: crypto.randomUUID(), p_diary: diary, p_date: today, p_emotion: 'sad', p_content: '두 번째 저장 시도', p_photo_paths: [], p_device_today: today,
    });
    expect(dup.error?.message).toBe('entry_exists');
    const short = await a.rpc('save_entry', {
      p_id: crypto.randomUUID(), p_diary: diary, p_date: today, p_emotion: 'sad', p_content: '네글자다', p_photo_paths: [], p_device_today: today,
    });
    expect(short.error?.message).toBe('too_short');
  });

  it('작성자는 사진 서명 URL을 받고, 다른 사람은 일기·사진을 못 봄', async () => {
    const own = await a.storage.from('entry-photos').createSignedUrl(path(1, true), 60);
    expect(own.error).toBeNull();
    expect((await b.from('entries').select('id').eq('id', entryId)).data).toEqual([]);
    expect((await b.storage.from('entry-photos').createSignedUrl(path(1), 60)).error).not.toBeNull();
  });

  it('삭제 → 같은 날짜 다시 쓰기 가능, 열림 기록 유지', async () => {
    expect((await a.from('entries').delete({ count: 'exact' }).eq('id', entryId)).count).toBe(1);
    await a.storage.from('entry-photos').remove([path(1), path(1, true)]);
    const unlocks = await a.from('entry_unlocks').select('entry_date').eq('diary_id', diary);
    expect(unlocks.data).toEqual([{ entry_date: today }]);
    const again = await a.rpc('save_entry', {
      p_id: crypto.randomUUID(), p_diary: diary, p_date: today, p_emotion: 'calm', p_content: '지우고 다시 쓴 일기', p_photo_paths: [], p_device_today: today,
    });
    expect(again.error).toBeNull();
  });
});

describe('5단계 [B3][B4][E2]', () => {
  let diary = '';
  let code = '';
  let c: SupabaseClient;
  let cId = '';

  beforeAll(async () => {
    const list = (await a.rpc('my_diaries')).data as Array<{ id: string; is_shared: boolean; invite_code: string; name: string }>;
    const d = list.find((x) => x.is_shared && x.name === '새 이름')!;
    diary = d.id;
    code = d.invite_code;
    c = mk();
    cId = (await c.auth.signInAnonymously()).data.user!.id;
    await c.rpc('complete_profile', profileArgs('공주C', 'Asia/Seoul'));
  });

  it('코드 찾기 → 요청 → 주인 목록에 보임 → 승인 → 멤버', async () => {
    const found = (await c.rpc('find_diary_by_code', { p_code: code.toLowerCase() })).data;
    expect(found).toMatchObject({ status: 'ok', diary_id: diary, owner_nickname: '공주A' });
    expect((await c.rpc('request_join', { p_code: code })).error).toBeNull();
    expect((await c.rpc('my_join_requests')).data).toMatchObject([{ diary_id: diary, status: 'pending' }]);
    expect((await c.from('diaries').select('id').eq('id', diary)).data).toEqual([]);

    const incoming = (await a.rpc('diary_join_requests', { p_diary: diary })).data as Array<{ id: string; user_id: string }>;
    const req = incoming.find((r) => r.user_id === cId)!;
    expect((await b.rpc('decide_request', { p_request: req.id, p_approve: true })).error?.message).toBe('not_member');
    expect((await a.rpc('decide_request', { p_request: req.id, p_approve: true })).error).toBeNull();
    const mine = (await c.rpc('my_diaries')).data as Array<{ id: string; role: string }>;
    expect(mine.find((x) => x.id === diary)?.role).toBe('member');
  });

  it('멤버가 쓴 일기가 주인의 보관 화면에 잡히고, 내보내기하면 사라짐', async () => {
    const { data } = await c.from('user_settings').select('timezone').single();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: data!.timezone }).format(new Date());
    expect((await c.rpc('save_entry', { p_id: crypto.randomUUID(), p_diary: diary, p_date: today, p_emotion: 'sad', p_content: 'C의 비밀 일기', p_photo_paths: [], p_device_today: today })).error).toBeNull();
    const meta = (await a.rpc('diary_entries_meta', { p_diary: diary, p_from: today, p_to: today })).data as Array<{ author_id: string }>;
    expect(meta.some((m) => m.author_id === cId)).toBe(true);

    expect((await a.rpc('remove_member', { p_diary: diary, p_user: cId })).error).toBeNull();
    const after = (await a.rpc('diary_entries_meta', { p_diary: diary, p_from: today, p_to: today })).data as Array<{ author_id: string }>;
    expect(after.some((m) => m.author_id === cId)).toBe(false);
    expect(((await c.rpc('my_diaries')).data as Array<{ id: string }>).some((x) => x.id === diary)).toBe(false);
  });
});

describe('6단계 열람 규칙 — T1·T2 실서버(Storage 포함, 기술 검증 3번)', () => {
  it('친구 일기와 사진은 내가 그날 쓰기 전엔 잠기고, 쓰면 열린다', async () => {
    const d = (await a.rpc('create_diary', { p_name: '열람 규칙', p_cover_color: 'cover_4', p_is_shared: true, p_late_window_days: 3 })).data as string;
    const code = ((await a.rpc('my_diaries')).data as Array<{ id: string; invite_code: string }>).find((x) => x.id === d)!.invite_code;
    const f = mk();
    await f.auth.signInAnonymously();
    await f.rpc('complete_profile', profileArgs('친구', 'Asia/Seoul'));
    await f.rpc('find_diary_by_code', { p_code: code });
    await f.rpc('request_join', { p_code: code });
    const req = ((await a.rpc('diary_join_requests', { p_diary: d })).data as Array<{ id: string }>)[0]!;
    await a.rpc('decide_request', { p_request: req.id, p_approve: true });

    const tz = (await a.from('user_settings').select('timezone').single()).data!.timezone as string;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    const fe = crypto.randomUUID();
    const photo = `${d}/${fe}/1.jpg`;
    await f.storage.from('entry-photos').upload(photo, JPG, { contentType: 'image/jpeg' });
    await f.storage.from('entry-photos').upload(photo.replace('.jpg', '_thumb.jpg'), JPG, { contentType: 'image/jpeg' });
    expect((await f.rpc('save_entry', { p_id: fe, p_diary: d, p_date: today, p_emotion: 'love', p_content: '친구의 오늘', p_photo_paths: [photo], p_device_today: today })).error).toBeNull();

    // T1: 잠김 — 본문도 사진도 안 됨, entry_status는 locked
    expect((await a.from('entries').select('id').eq('id', fe)).data).toEqual([]);
    expect((await a.storage.from('entry-photos').createSignedUrl(photo, 60)).error).not.toBeNull();
    expect(((await a.rpc('entry_status', { p_entry: fe })).data as { status: string }).status).toBe('locked');

    // T2: 내가 쓰면 열림
    await a.rpc('save_entry', { p_id: crypto.randomUUID(), p_diary: d, p_date: today, p_emotion: 'happy', p_content: '나도 오늘 썼어요', p_photo_paths: [], p_device_today: today });
    expect((await a.from('entries').select('content').eq('id', fe)).data).toEqual([{ content: '친구의 오늘' }]);
    expect((await a.storage.from('entry-photos').createSignedUrl(photo, 60)).error).toBeNull();
    expect(((await a.rpc('entry_status', { p_entry: fe })).data as { status: string }).status).toBe('viewable');
  });
});
