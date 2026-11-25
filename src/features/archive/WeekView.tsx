/**
 * [C1] 주간 보기: 날짜 행 7개(week_start 기준), 멤버 아바타 + 상태 아이콘(열람자 기준)
 * 작성+열림 = 감정 / 작성+잠김 = 자물쇠 / 미작성 = 점선 원 / 참여 전 날짜 = 아바타 숨김
 * 혼자 쓰기: 감정 아이콘 + 본문 첫 줄
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EMOTION_ICONS } from '@/constants/emotions';
import { MIN_TOUCH, WEEK_AVATAR_SIZE, WEEK_MAX_AVATARS } from '@/constants/policy';
import { emotionLabels, fill, ko } from '@/copy/ko';
import type { MyDiary } from '@/features/diary/api';
import { MemberAvatar } from '@/features/diary/MemberAvatar';
import { addDays, dayOfWeek, weekDays, weekdayLabel, writableRange } from '@/lib/date';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { indexMeta, useEntriesByIds, useEntriesMeta } from './api';

type Props = { diary: MyDiary; today: string; start: string; myId: string };

export function WeekView({ diary, today, start, myId }: Props) {
  const { colors } = useTheme();
  const days = weekDays(start);
  const meta = useEntriesMeta(diary.id, start, addDays(start, 6));
  const { find } = indexMeta(meta.data);
  const range = writableRange(diary.joined_date, today, diary.late_window_days);
  const myIds = (meta.data ?? []).filter((r) => r.author_id === myId && r.entry_id).map((r) => r.entry_id!);
  const mine = useEntriesByIds(diary.is_shared ? [] : myIds);

  const shown = diary.members.slice(0, WEEK_MAX_AVATARS);
  const extra = diary.members.length - shown.length;

  return (
    <View style={styles.list}>
      {days.map((d) => {
        const future = d > today;
        const beforeCreated = d < diary.created_date;
        const disabled = future || beforeCreated;
        const myMeta = find(d, myId);
        const canWrite = !myMeta && d >= range.from && d < today;
        const isToday = d === today;
        return (
          <Pressable
            key={d}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            onPress={() => router.push({ pathname: '/home/diary/[id]/day/[date]', params: { id: diary.id, date: d } })}
            style={[
              styles.row,
              {
                backgroundColor: colors.surface,
                borderColor: isToday ? colors.primary : colors.border,
                borderWidth: isToday ? 2 : 1,
                opacity: disabled ? 0.4 : 1,
              },
            ]}
          >
            <View style={styles.dateCol}>
              <Text style={[styles.dayNum, { color: colors.text }]}>{Number(d.slice(8))}</Text>
              <Text style={[styles.dow, { color: colors.textSub }]}>{weekdayLabel(dayOfWeek(d))}</Text>
            </View>

            {diary.is_shared ? (
              <View style={styles.members}>
                {shown.map((m) => {
                  if (d < m.joined_date) return <View key={m.user_id} style={styles.cell} />;
                  const r = find(d, m.user_id);
                  const status = disabled
                    ? null
                    : r?.viewable && r.emotion
                      ? { icon: EMOTION_ICONS[r.emotion], label: emotionLabels[r.emotion] }
                      : r
                        ? { icon: '🔒', label: ko.diaryMain.statusLocked }
                        : { icon: '◌', label: ko.diaryMain.statusNotWritten };
                  return (
                    <View key={m.user_id} style={styles.cell} accessible accessibilityLabel={`${m.nickname}, ${status?.label ?? ''}`}>
                      <MemberAvatar member={m} size={WEEK_AVATAR_SIZE} />
                      <Text style={[styles.status, { color: colors.textSub }]}>{status?.icon ?? ' '}</Text>
                    </View>
                  );
                })}
                {extra > 0 && <Text style={[styles.extra, { color: colors.textSub }]}>{fill(ko.home.moreMembers, { N: extra })}</Text>}
              </View>
            ) : (
              <View style={styles.solo}>
                {myMeta?.emotion && (
                  <Text style={styles.soloEmo} accessibilityLabel={emotionLabels[myMeta.emotion]}>
                    {EMOTION_ICONS[myMeta.emotion]}
                  </Text>
                )}
                <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
                  {mine.data?.find((e) => e.id === myMeta?.entry_id)?.content.split('\n')[0] ?? ''}
                </Text>
              </View>
            )}

            {canWrite && (
              <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                <Text style={{ color: colors.primary, fontSize: fontSize.caption, fontWeight: '700' }}>{ko.diaryMain.canStillWrite}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, minHeight: MIN_TOUCH + spacing.xl },
  dateCol: { width: 36, alignItems: 'center' },
  dayNum: { fontSize: fontSize.body + 2, fontWeight: '800' },
  dow: { fontSize: fontSize.caption },
  members: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cell: { width: WEEK_AVATAR_SIZE + spacing.xs, alignItems: 'center' },
  status: { fontSize: fontSize.caption, marginTop: 2 },
  extra: { fontSize: fontSize.caption },
  solo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  soloEmo: { fontSize: fontSize.title },
  badge: { borderRadius: radius.chip, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
