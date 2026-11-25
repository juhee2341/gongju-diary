/**
 * 일기장 데이터 (B1, B2, E1)
 * 서버 오류는 AppError(code)로 올라오고, 화면에서 errorCopy로 문구를 보여준다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CoverColorKey, LateWindowDays } from '@/constants/policy';
import { queryKeys } from '@/lib/query';
import { AppError, rpc, supabase, toErrorCode } from '@/lib/supabase';
import { normalizeSingleLine } from '@/lib/text';

export type MemberPreview = {
  user_id: string;
  nickname: string;
  avatar_type: 'emoji' | 'photo';
  avatar_emoji: string;
  avatar_path: string | null;
  role: 'owner' | 'member';
};

export type MyDiary = {
  id: string;
  name: string;
  cover_color: CoverColorKey;
  is_shared: boolean;
  late_window_days: number;
  invite_code: string | null;
  owner_id: string;
  created_date: string;
  last_activity_at: string;
  role: 'owner' | 'member';
  pinned: boolean;
  muted: boolean;
  joined_date: string;
  member_count: number;
  members: MemberPreview[];
  wrote_today: boolean;
  today_count: number;
  recent_emotions: string[];
  pending_requests: number;
};

/** [B1] 내 일기장 목록(고정 먼저, 최근 활동순) */
export function useMyDiaries() {
  return useQuery({
    queryKey: queryKeys.myDiaries,
    queryFn: () => rpc<MyDiary[]>('my_diaries'),
  });
}

/** [C1, E1] 일기장 하나. 목록 캐시를 함께 쓰고, 없으면 "사라진 일기장" */
export function useDiary(id: string) {
  const q = useMyDiaries();
  const diary = q.data?.find((d) => d.id === id);
  return { ...q, diary, missing: q.isSuccess && !diary };
}

function useInvalidateDiaries() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.myDiaries });
}

export type CreateDiaryInput = {
  name: string;
  coverColor: CoverColorKey;
  isShared: boolean;
  lateWindowDays: LateWindowDays;
};

/** [B2] 일기장 만들기 → 새 id */
export function useCreateDiary() {
  const invalidate = useInvalidateDiaries();
  return useMutation({
    mutationFn: (input: CreateDiaryInput) =>
      rpc<string>('create_diary', {
        p_name: normalizeSingleLine(input.name),
        p_cover_color: input.coverColor,
        p_is_shared: input.isShared,
        p_late_window_days: input.lateWindowDays,
      }),
    onSuccess: invalidate,
  });
}

async function update(table: 'diaries' | 'diary_members', values: Record<string, unknown>, match: Record<string, string>) {
  try {
    const { error, count } = await supabase.from(table).update(values, { count: 'exact' }).match(match);
    if (error) throw new AppError(toErrorCode(error));
    if (count === 0) throw new AppError('not_member');
  } catch (e) {
    throw e instanceof AppError ? e : new AppError(toErrorCode(e));
  }
}

/** [E1] 이름·커버 수정(주인) */
export function useUpdateDiary(id: string) {
  const invalidate = useInvalidateDiaries();
  return useMutation({
    mutationFn: (v: { name: string; coverColor: CoverColorKey }) =>
      update('diaries', { name: normalizeSingleLine(v.name), cover_color: v.coverColor }, { id }),
    onSuccess: invalidate,
  });
}

/** [E1] 늦게 쓰기 기간(주인, 함께 쓰기) */
export function useSetLateWindow(id: string) {
  const invalidate = useInvalidateDiaries();
  return useMutation({
    mutationFn: (days: LateWindowDays) => rpc('set_late_window', { p_diary: id, p_days: days }),
    onSuccess: invalidate,
  });
}

/** [E1] 초대 코드 재발급 */
export function useRegenerateCode(id: string) {
  const invalidate = useInvalidateDiaries();
  return useMutation({
    mutationFn: () => rpc<string>('regenerate_invite_code', { p_diary: id }),
    onSuccess: invalidate,
  });
}

/** [E1] 혼자 쓰기 → 함께 쓰기 */
export function useConvertToShared(id: string) {
  const invalidate = useInvalidateDiaries();
  return useMutation({
    mutationFn: (days: LateWindowDays) => rpc<string>('convert_to_shared', { p_diary: id, p_days: days }),
    onSuccess: invalidate,
  });
}

/** [B1, E1] 내 멤버 행의 pinned·muted(본인 행만) */
export function useSetMemberFlags() {
  const invalidate = useInvalidateDiaries();
  return useMutation({
    mutationFn: async (v: { diaryId: string; userId: string; pinned?: boolean; muted?: boolean }) => {
      const values: Record<string, boolean> = {};
      if (v.pinned !== undefined) values.pinned = v.pinned;
      if (v.muted !== undefined) values.muted = v.muted;
      await update('diary_members', values, { diary_id: v.diaryId, user_id: v.userId });
    },
    onSuccess: invalidate,
  });
}
