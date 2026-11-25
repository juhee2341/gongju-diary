/**
 * 일기 데이터 (D1, D2)
 * 저장 순서(screens.md D1): entry id 생성 → 사진 변환 → entry-photos 업로드 → save_entry → 임시저장 삭제
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import type { Emotion } from '@/constants/emotions';
import { PHOTO_URL_SECONDS } from '@/constants/policy';
import { readAsArrayBuffer } from '@/lib/image';
import { queryKeys } from '@/lib/query';
import { AppError, rpc, supabase, toErrorCode } from '@/lib/supabase';
import { normalizeBody } from '@/lib/text';

export type Entry = {
  id: string;
  diary_id: string;
  author_id: string;
  entry_date: string;
  emotion: Emotion;
  content: string;
  photo_paths: string[];
  is_late: boolean;
  edited: boolean;
  created_at: string;
  updated_at: string;
};

const BUCKET = 'entry-photos';

export const newEntryId = () => Crypto.randomUUID();

/** {diary}/{entry}/{n}.jpg ↔ {n}_thumb.jpg */
export const photoPath = (diaryId: string, entryId: string, n: number) => `${diaryId}/${entryId}/${n}.jpg`;
export const thumbPath = (path: string) => path.replace(/\.jpg$/, '_thumb.jpg');

export const entryKeys = {
  one: (id: string) => ['entry', id] as const,
  myDates: (diaryId: string) => ['entry', 'my-dates', diaryId] as const,
  mine: (diaryId: string) => ['entry', 'mine', diaryId] as const,
};

/** [D2] 일기 하나(열람 규칙은 서버 RLS가 판단, 못 보면 null) */
export function useEntry(id: string | undefined) {
  return useQuery({
    queryKey: entryKeys.one(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('entries').select('*').eq('id', id!).maybeSingle();
      if (error) throw new AppError(toErrorCode(error));
      return data as Entry | null;
    },
  });
}

/** [D2] 직접 진입 시 열림/잠김/삭제 구분 */
export type EntryStatus = { status: 'viewable' | 'locked' | 'missing'; diary_id?: string; entry_date?: string };
export function useEntryStatus(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['entry', 'status', id ?? ''],
    enabled: !!id && enabled,
    queryFn: () => rpc<EntryStatus>('entry_status', { p_entry: id! }),
  });
}

/** [D1] 이 일기장에서 내가 이미 쓴 날짜 */
export function useMyEntryDates(diaryId: string, userId: string | null) {
  return useQuery({
    queryKey: entryKeys.myDates(diaryId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('id, entry_date')
        .eq('diary_id', diaryId)
        .eq('author_id', userId!);
      if (error) throw new AppError(toErrorCode(error));
      return (data ?? []) as Array<{ id: string; entry_date: string }>;
    },
  });
}

/** 비공개 버킷이라 서명 URL로 표시. 목록엔 썸네일, 원본은 D2에서만 */
export function usePhotoUrls(paths: string[], thumb: boolean) {
  const targets = thumb ? paths.map(thumbPath) : paths;
  return useQuery({
    queryKey: ['photo-urls', ...targets],
    enabled: targets.length > 0,
    staleTime: (PHOTO_URL_SECONDS / 2) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(targets, PHOTO_URL_SECONDS);
      if (error) throw new AppError(toErrorCode(error));
      return data.map((d) => d.signedUrl ?? null);
    },
  });
}

/** 업로드할 사진: 이미 올라간 경로(수정 모드) 또는 기기 파일 */
export type PhotoItem =
  | { kind: 'remote'; path: string }
  | { kind: 'local'; full: string; thumb: string };

export type UploadResult = { ok: true; paths: string[] } | { ok: false; failed: number[] };

/**
 * 사진을 1~3번 슬롯 순서대로 올린다. 기존 경로를 다른 번호로 옮겨야 하면 새 번호로 복사한다.
 * 실패한 사진 인덱스를 돌려주고, 일기 저장은 모두 성공했을 때만 한다(T16).
 */
export async function uploadPhotos(
  diaryId: string,
  entryId: string,
  items: PhotoItem[],
  onProgress: (done: number) => void,
): Promise<UploadResult> {
  const storage = supabase.storage.from(BUCKET);
  const download = async (path: string) => {
    const dl = await storage.download(path);
    if (dl.error) throw dl.error;
    return dl.data.arrayBuffer();
  };

  // 1) 번호가 바뀌는 기존 사진은 쓰기 전에 모두 읽어 둔다(1↔2 교환 시 덮어쓰기 방지)
  const buffers: Array<{ full: ArrayBuffer; thumb: ArrayBuffer } | null> = [];
  const failed: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const target = photoPath(diaryId, entryId, i + 1);
    try {
      if (item.kind === 'remote' && item.path === target) buffers.push(null);
      else if (item.kind === 'remote') buffers.push({ full: await download(item.path), thumb: await download(thumbPath(item.path)) });
      else buffers.push({ full: await readAsArrayBuffer(item.full), thumb: await readAsArrayBuffer(item.thumb) });
    } catch {
      buffers.push(null);
      failed.push(i);
    }
  }

  // 2) 슬롯 번호대로 쓴다
  const paths: string[] = [];
  let done = 0;
  for (let i = 0; i < items.length; i++) {
    const target = photoPath(diaryId, entryId, i + 1);
    const buf = buffers[i];
    if (!failed.includes(i) && buf) {
      try {
        const a = await storage.upload(target, buf.full, { contentType: 'image/jpeg', upsert: true });
        if (a.error) throw a.error;
        const b = await storage.upload(thumbPath(target), buf.thumb, { contentType: 'image/jpeg', upsert: true });
        if (b.error) throw b.error;
      } catch {
        failed.push(i);
      }
    }
    paths.push(target);
    done += 1;
    onProgress(done);
  }
  return failed.length ? { ok: false, failed: [...new Set(failed)].sort() } : { ok: true, paths };
}

export type SaveEntryInput = {
  id: string;
  diaryId: string;
  date: string;
  emotion: Emotion;
  content: string;
  photoPaths: string[];
  deviceToday: string;
};

export async function saveEntry(input: SaveEntryInput): Promise<Entry> {
  return rpc<Entry>('save_entry', {
    p_id: input.id,
    p_diary: input.diaryId,
    p_date: input.date,
    p_emotion: input.emotion,
    p_content: normalizeBody(input.content),
    p_photo_paths: input.photoPaths,
    p_device_today: input.deviceToday,
  });
}

/** 저장 후 빠진 사진 파일 정리(수정 모드). 실패해도 ORPHAN_CLEANUP이 정리 */
export async function removePhotoFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await supabase.storage.from(BUCKET).remove(paths.flatMap((p) => [p, thumbPath(p)]));
}

/** [D2] 삭제: 행 삭제 후 사진 정리. 열림 기록은 유지(서버) */
export async function deleteEntry(entry: Entry): Promise<void> {
  try {
    const { error, count } = await supabase.from('entries').delete({ count: 'exact' }).eq('id', entry.id);
    if (error) throw new AppError(toErrorCode(error));
    if (count === 0) throw new AppError('entry_not_found');
  } catch (e) {
    throw e instanceof AppError ? e : new AppError(toErrorCode(e));
  }
  await removePhotoFiles(entry.photo_paths).catch(() => undefined);
}

/** 저장·삭제 뒤 갱신할 쿼리 */
export function useInvalidateEntries() {
  const qc = useQueryClient();
  return (diaryId: string, entryId?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.myDiaries }),
      qc.invalidateQueries({ queryKey: entryKeys.myDates(diaryId) }),
      qc.invalidateQueries({ queryKey: entryKeys.mine(diaryId) }),
      qc.invalidateQueries({ queryKey: ['archive'] }),
      entryId ? qc.invalidateQueries({ queryKey: entryKeys.one(entryId) }) : Promise.resolve(),
    ]);
}
