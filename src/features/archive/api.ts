/**
 * 보관 화면 데이터 (C1~C4)
 * diary_entries_meta: 볼 수 있는 일기는 id·감정·배지, 잠긴 일기는 작성자·날짜만(서버가 판정)
 */
import { useQuery } from '@tanstack/react-query';
import type { Emotion } from '@/constants/emotions';
import type { Entry } from '@/features/entry/api';
import { AppError, rpc, supabase, toErrorCode } from '@/lib/supabase';

export type EntryMeta = {
  entry_date: string;
  author_id: string;
  viewable: boolean;
  entry_id: string | null;
  emotion: Emotion | null;
  is_late: boolean | null;
  edited: boolean | null;
};

export const archiveKeys = {
  meta: (diaryId: string, from: string, to: string) => ['archive', 'meta', diaryId, from, to] as const,
  entries: (ids: string[]) => ['archive', 'entries', ...ids] as const,
  all: ['archive'] as const,
};

export function useEntriesMeta(diaryId: string, from: string, to: string) {
  return useQuery({
    queryKey: archiveKeys.meta(diaryId, from, to),
    queryFn: () => rpc<EntryMeta[]>('diary_entries_meta', { p_diary: diaryId, p_from: from, p_to: to }),
    placeholderData: (prev) => prev,
  });
}

/** 볼 수 있는 일기의 본문·사진(서버 RLS가 다시 걸러 준다) */
export function useEntriesByIds(ids: string[]) {
  return useQuery({
    queryKey: archiveKeys.entries(ids),
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('entries').select('*').in('id', ids);
      if (error) throw new AppError(toErrorCode(error));
      return (data ?? []) as Entry[];
    },
  });
}

/** 날짜별·작성자별 색인 */
export function indexMeta(rows: EntryMeta[] | undefined) {
  const byDate = new Map<string, EntryMeta[]>();
  for (const r of rows ?? []) {
    const list = byDate.get(r.entry_date) ?? [];
    list.push(r);
    byDate.set(r.entry_date, list);
  }
  const find = (date: string, author: string) => byDate.get(date)?.find((r) => r.author_id === author);
  return { byDate, find };
}
