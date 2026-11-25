/** [D2] 리액션·댓글 데이터 */
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { COMMENT_PAGE } from '@/constants/policy';
import type { Reaction } from '@/constants/reactions';
import { AppError, rpc, supabase, toErrorCode } from '@/lib/supabase';
import { normalizeSingleLine } from '@/lib/text';

export type ReactionRow = { user_id: string; reaction: Reaction };
export type Comment = { id: string; entry_id: string; author_id: string; content: string; created_at: string };

export const reactionKeys = {
  reactions: (entryId: string) => ['reactions', entryId] as const,
  comments: (entryId: string) => ['comments', entryId] as const,
};

export function useReactions(entryId: string) {
  return useQuery({
    queryKey: reactionKeys.reactions(entryId),
    queryFn: async () => {
      const { data, error } = await supabase.from('reactions').select('user_id, reaction').eq('entry_id', entryId);
      if (error) throw new AppError(toErrorCode(error));
      return (data ?? []) as ReactionRow[];
    },
  });
}

/** 최근 COMMENT_PAGE개 먼저, "이전 댓글 보기"로 COMMENT_PAGE개씩. 화면에는 오래된 순 */
export function useComments(entryId: string) {
  return useInfiniteQuery({
    queryKey: reactionKeys.comments(entryId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase.from('comments').select('*').eq('entry_id', entryId).order('created_at', { ascending: false }).limit(COMMENT_PAGE);
      if (pageParam) q = q.lt('created_at', pageParam);
      const { data, error } = await q;
      if (error) throw new AppError(toErrorCode(error));
      return (data ?? []) as Comment[];
    },
    getNextPageParam: (last) => (last.length === COMMENT_PAGE ? last[last.length - 1]!.created_at : null),
  });
}

export const setReaction = (entryId: string, reaction: Reaction | null) =>
  rpc('set_reaction', { p_entry: entryId, p_reaction: reaction });

export const addComment = (entryId: string, content: string) =>
  rpc<Comment>('add_comment', { p_entry: entryId, p_content: normalizeSingleLine(content) });

export async function deleteComment(id: string): Promise<void> {
  const { error, count } = await supabase.from('comments').delete({ count: 'exact' }).eq('id', id);
  if (error) throw new AppError(toErrorCode(error));
  if (count === 0) throw new AppError('entry_not_found');
}

export function useInvalidateReactions() {
  const qc = useQueryClient();
  return (entryId: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: reactionKeys.reactions(entryId) }),
      qc.invalidateQueries({ queryKey: reactionKeys.comments(entryId) }),
      qc.invalidateQueries({ queryKey: ['archive'] }),
    ]);
}
