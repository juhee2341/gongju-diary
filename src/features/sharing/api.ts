/** 공유 데이터 (B3, B4, E2) */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CoverColorKey } from '@/constants/policy';
import { queryKeys } from '@/lib/query';
import { rpc } from '@/lib/supabase';

export type FindStatus =
  | 'ok'
  | 'already_member'
  | 'request_pending'
  | 'diary_full'
  | 'reject_cooldown'
  | 'code_invalid'
  | 'code_locked';

export type DiaryPreview = {
  status: FindStatus;
  locked_seconds?: number;
  diary_id?: string;
  name?: string;
  cover_color?: CoverColorKey;
  owner_nickname?: string;
  owner_avatar_type?: 'emoji' | 'photo';
  owner_avatar_emoji?: string;
  owner_avatar_path?: string | null;
  member_count?: number;
  max_members?: number;
  request_id?: string | null;
};

export type MyRequest = {
  id: string;
  diary_id: string;
  name: string;
  cover_color: CoverColorKey;
  status: 'pending' | 'rejected' | 'expired';
  created_at: string;
};

export type IncomingRequest = {
  id: string;
  user_id: string;
  nickname: string;
  avatar_type: 'emoji' | 'photo';
  avatar_emoji: string;
  avatar_path: string | null;
  created_at: string;
  former_member: boolean;
  blocked: boolean;
};

export const sharingKeys = {
  mine: ['join-requests', 'mine'] as const,
  incoming: (diaryId: string) => ['join-requests', 'incoming', diaryId] as const,
};

export const findDiaryByCode = (code: string) => rpc<DiaryPreview>('find_diary_by_code', { p_code: code });
export const requestJoin = (code: string) => rpc<string>('request_join', { p_code: code });
export const cancelRequest = (id: string) => rpc('cancel_request', { p_request: id });
export const decideRequest = (id: string, approve: boolean) => rpc('decide_request', { p_request: id, p_approve: approve });
/** 돌려받는 사진 경로는 9단계(#8) Edge Function에서 서비스 권한으로 지운다 */
export const removeMember = (diaryId: string, userId: string) =>
  rpc<string[]>('remove_member', { p_diary: diaryId, p_user: userId });

/** [B4, B1 대기 띠] */
export function useMyJoinRequests() {
  return useQuery({ queryKey: sharingKeys.mine, queryFn: () => rpc<MyRequest[]>('my_join_requests') });
}

/** [E2] 주인만 */
export function useIncomingRequests(diaryId: string, enabled: boolean) {
  return useQuery({
    queryKey: sharingKeys.incoming(diaryId),
    enabled,
    queryFn: () => rpc<IncomingRequest[]>('diary_join_requests', { p_diary: diaryId }),
  });
}

export function useInvalidateSharing() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['join-requests'] }),
      qc.invalidateQueries({ queryKey: queryKeys.myDiaries }),
      qc.invalidateQueries({ queryKey: ['archive'] }),
    ]);
}
