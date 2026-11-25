/**
 * [D2] 댓글: "댓글 {N}" + 오래된 순 목록(아바타·닉네임·내용·시간), "이전 댓글 보기",
 * 입력(0/100, 보내기). 길게 누르기: 내 댓글이거나 내 일기에 달린 댓글이면 삭제
 * TODO(10단계 #9) 남의 댓글 길게 누르기 → 신고·차단
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { COMMENT_MAX_CHARS, MIN_TOUCH } from '@/constants/policy';
import { errorCopy, fill, ko } from '@/copy/ko';
import type { MemberPreview } from '@/features/diary/api';
import { MemberAvatar } from '@/features/diary/MemberAvatar';
import { useOnline } from '@/hooks/useOnline';
import { confirm } from '@/lib/confirm';
import { formatTime } from '@/lib/date';
import { AppError } from '@/lib/supabase';
import { clampGraphemes, graphemeLength, normalizeSingleLine } from '@/lib/text';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { addComment, deleteComment, useComments, useInvalidateReactions } from './reactions';

type Props = { entryId: string; entryAuthorId: string; myId: string | null; members: MemberPreview[] };

export function Comments({ entryId, entryAuthorId, myId, members }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const q = useComments(entryId);
  const invalidate = useInvalidateReactions();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const all = (q.data?.pages.flat() ?? []).slice().reverse();
  const count = graphemeLength(normalizeSingleLine(text));

  const send = async () => {
    setSending(true);
    try {
      await addComment(entryId, text);
      setText('');
      await invalidate(entryId);
    } catch (e) {
      toast(errorCopy[e instanceof AppError ? e.code : 'network']);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: ko.entry.deleteCommentTitle, ok: ko.entry.delete, destructive: true }))) return;
    try {
      await deleteComment(id);
      await invalidate(entryId);
    } catch (e) {
      toast(errorCopy[e instanceof AppError ? e.code : 'network']);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text }]}>{fill(ko.entry.comments, { N: all.length + (q.hasNextPage ? '+' : '') })}</Text>
      {q.hasNextPage && (
        <Pressable accessibilityRole="button" onPress={() => void q.fetchNextPage()} style={styles.older}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{ko.entry.olderComments}</Text>
        </Pressable>
      )}
      {all.length === 0 && !q.isLoading && <Text style={{ color: colors.textSub }}>{ko.entry.firstComment}</Text>}
      {all.map((c) => {
        const author = members.find((m) => m.user_id === c.author_id);
        const canDelete = c.author_id === myId || entryAuthorId === myId;
        return (
          <Pressable
            key={c.id}
            onLongPress={canDelete ? () => void remove(c.id) : undefined}
            accessibilityHint={canDelete ? ko.entry.deleteComment : undefined}
            style={styles.comment}
          >
            <MemberAvatar member={author} size={28} />
            <View style={styles.body}>
              <View style={styles.meta}>
                <Text style={[styles.nick, { color: colors.text }]}>{author?.nickname ?? ko.common.leftAuthor}</Text>
                <Text style={{ color: colors.textSub, fontSize: fontSize.caption }}>{formatTime(c.created_at)}</Text>
              </View>
              <Text style={{ color: colors.text }}>{c.content}</Text>
            </View>
          </Pressable>
        );
      })}

      <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            const r = clampGraphemes(t, COMMENT_MAX_CHARS);
            setText(r.value);
            if (r.truncated) toast(fill(ko.common.maxChars, { N: COMMENT_MAX_CHARS }));
          }}
          placeholder={ko.entry.commentPlaceholder}
          placeholderTextColor={colors.textSub}
          accessibilityLabel={ko.entry.commentPlaceholder}
          style={[styles.input, { color: colors.text }]}
        />
        <Text style={{ color: colors.textSub, fontSize: fontSize.caption }}>{fill(ko.write.counter, { N: count, MAX: COMMENT_MAX_CHARS })}</Text>
        <Button
          label={ko.entry.send}
          onPress={() => void send()}
          disabled={count === 0}
          loading={sending}
          blocked={!online}
          onBlockedPress={() => toast(ko.common.offline)}
          style={styles.send}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  title: { fontSize: fontSize.body, fontWeight: '800' },
  older: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  comment: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  body: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nick: { fontWeight: '700', fontSize: fontSize.caption + 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.card, paddingLeft: spacing.md, paddingRight: spacing.xs },
  input: { flex: 1, minHeight: MIN_TOUCH, fontSize: fontSize.body },
  send: { minHeight: MIN_TOUCH - spacing.xs, paddingHorizontal: spacing.md },
});
