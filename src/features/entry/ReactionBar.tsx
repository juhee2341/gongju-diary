/**
 * [D2] 리액션 바: 6종, 개수(0이면 숨김), 내가 누른 것은 primary 테두리
 * 탭: 추가 / 다른 것 = 교체 / 같은 것 = 취소. 길게 누르면 누른 사람 목록
 */
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { useToast } from '@/components/Toast';
import { MIN_TOUCH } from '@/constants/policy';
import { REACTION_ICONS, REACTIONS, type Reaction } from '@/constants/reactions';
import { errorCopy, fill, ko, reactionLabels } from '@/copy/ko';
import type { MemberPreview } from '@/features/diary/api';
import { MemberAvatar } from '@/features/diary/MemberAvatar';
import { AppError } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { setReaction, useInvalidateReactions, useReactions } from './reactions';

type Props = { entryId: string; myId: string | null; members: MemberPreview[] };

export function ReactionBar({ entryId, myId, members }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const q = useReactions(entryId);
  const invalidate = useInvalidateReactions();
  const [busy, setBusy] = useState(false);
  const [listFor, setListFor] = useState<Reaction | null>(null);
  const mine = q.data?.find((r) => r.user_id === myId)?.reaction ?? null;
  const count = (r: Reaction) => q.data?.filter((x) => x.reaction === r).length ?? 0;

  const press = async (r: Reaction) => {
    setBusy(true);
    void Haptics.selectionAsync().catch(() => undefined);
    try {
      await setReaction(entryId, mine === r ? null : r);
      await invalidate(entryId);
    } catch (e) {
      toast(errorCopy[e instanceof AppError ? e.code : 'network']);
    } finally {
      setBusy(false);
    }
  };

  const people = listFor ? (q.data ?? []).filter((x) => x.reaction === listFor).map((x) => members.find((m) => m.user_id === x.user_id)) : [];

  return (
    <View style={styles.row}>
      {REACTIONS.map((r) => {
        const n = count(r);
        const on = mine === r;
        return (
          <Pressable
            key={r}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={n ? fill(ko.entry.reactionCount, { 리액션: reactionLabels[r], N: n }) : reactionLabels[r]}
            accessibilityState={{ selected: on }}
            onPress={() => void press(r)}
            onLongPress={() => n > 0 && setListFor(r)}
            style={[styles.item, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : colors.surface }]}
          >
            <Text style={styles.icon}>{REACTION_ICONS[r]}</Text>
            {n > 0 && <Text style={[styles.count, { color: on ? colors.primary : colors.textSub }]}>{n}</Text>}
          </Pressable>
        );
      })}
      <BottomSheet visible={!!listFor} onClose={() => setListFor(null)} title={listFor ? fill(ko.entry.reactedBy, { 리액션: `${REACTION_ICONS[listFor]} ${reactionLabels[listFor]}` }) : ''}>
        {people.map((m, i) => (
          <View key={m?.user_id ?? i} style={styles.person}>
            <MemberAvatar member={m} size={28} />
            <Text style={{ color: colors.text }}>{m?.nickname ?? ko.common.leftAuthor}</Text>
          </View>
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH + spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  icon: { fontSize: fontSize.title },
  count: { fontSize: fontSize.caption, fontWeight: '700' },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
});
