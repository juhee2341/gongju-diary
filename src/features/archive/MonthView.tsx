/**
 * [C2] 월간 캘린더: 날짜 칸에 내 감정(크게) + 작성한 멤버 수, 아래 "이번 달 내 감정" 막대
 * 내가 안 썼고 작성 가능 = 점선 원 / 자동 공개 = 흐린 점 / 오늘 = primary 원 / 미래·생성일 이전 = 흐리게
 * 잠긴 일기의 감정은 숫자 집계에만 반영(서버가 emotion을 주지 않음)
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EMOTION_ICONS, EMOTIONS, type Emotion } from '@/constants/emotions';
import { emotionLabels, fill, ko } from '@/copy/ko';
import type { MyDiary } from '@/features/diary/api';
import { isAutoPublic, lastDayOfMonth, monthGrid, weekdayLabel, weekdayOrder, writableRange, type YearMonth } from '@/lib/date';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { indexMeta, useEntriesMeta } from './api';

type Props = { diary: MyDiary; today: string; ym: YearMonth; weekStart: 0 | 1; myId: string };

export function MonthView({ diary, today, ym, weekStart, myId }: Props) {
  const { colors } = useTheme();
  const meta = useEntriesMeta(diary.id, `${ym}-01`, lastDayOfMonth(ym));
  const { byDate, find } = indexMeta(meta.data);
  const range = writableRange(diary.joined_date, today, diary.late_window_days);

  const counts = new Map<Emotion, number>();
  for (const r of meta.data ?? []) {
    if (r.author_id === myId && r.emotion) counts.set(r.emotion, (counts.get(r.emotion) ?? 0) + 1);
  }
  const bars = EMOTIONS.filter((e) => counts.get(e)).sort((a, b) => counts.get(b)! - counts.get(a)!);
  const max = Math.max(1, ...bars.map((e) => counts.get(e)!));

  return (
    <View style={styles.wrap}>
      <View style={styles.week}>
        {weekdayOrder(weekStart).map((dow) => (
          <Text key={dow} style={[styles.head, { color: colors.textSub }]}>
            {weekdayLabel(dow)}
          </Text>
        ))}
      </View>
      {monthGrid(ym, weekStart).map((week, i) => (
        <View key={i} style={styles.week}>
          {week.map((d, j) => {
            if (!d) return <View key={j} style={styles.cell} />;
            const disabled = d > today || d < diary.created_date;
            const mine = find(d, myId);
            const n = byDate.get(d)?.length ?? 0;
            const isToday = d === today;
            const mark = mine?.emotion
              ? EMOTION_ICONS[mine.emotion]
              : disabled
                ? ''
                : d >= range.from && d <= today
                  ? '◌'
                  : isAutoPublic(d, today, diary.late_window_days)
                    ? '·'
                    : '';
            return (
              <Pressable
                key={d}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`${Number(d.slice(8))}${mine?.emotion ? `, ${emotionLabels[mine.emotion]}` : ''}${diary.is_shared && n ? `, ${fill(ko.diaryMain.monthCount, { N: n })}` : ''}`}
                onPress={() => router.push({ pathname: '/home/diary/[id]/day/[date]', params: { id: diary.id, date: d } })}
                style={[styles.cell, { opacity: disabled ? 0.35 : 1 }]}
              >
                <View style={[styles.num, isToday && { backgroundColor: colors.primary }]}>
                  <Text style={{ color: isToday ? colors.onPrimary : colors.text, fontSize: fontSize.caption, fontWeight: '700' }}>
                    {Number(d.slice(8))}
                  </Text>
                </View>
                <Text style={[styles.mark, { color: colors.textSub }]}>{mark}</Text>
                {diary.is_shared && n > 0 && <Text style={[styles.count, { color: colors.textSub }]}>{n}</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={[styles.summary, { backgroundColor: colors.surface }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>{ko.diaryMain.monthEmotions}</Text>
        {bars.length === 0 ? (
          <Text style={{ color: colors.textSub }}>{ko.diaryMain.monthQuiet}</Text>
        ) : (
          bars.map((e) => (
            <View key={e} style={styles.barRow} accessible accessibilityLabel={`${emotionLabels[e]} ${fill(ko.diaryMain.timesCount, { N: counts.get(e)! })}`}>
              <Text style={styles.barIcon}>{EMOTION_ICONS[e]}</Text>
              <View style={[styles.barTrack, { backgroundColor: colors.background }]}>
                <View style={[styles.barFill, { width: `${(counts.get(e)! / max) * 100}%`, backgroundColor: colors.emotion[e] }]} />
              </View>
              <Text style={[styles.barNum, { color: colors.textSub }]}>{counts.get(e)}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  week: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', fontSize: fontSize.caption, paddingVertical: spacing.xs },
  cell: { flex: 1, minHeight: 64, alignItems: 'center', paddingTop: spacing.xs },
  num: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  mark: { fontSize: fontSize.title, lineHeight: fontSize.title + 6 },
  count: { position: 'absolute', right: 2, top: 2, fontSize: 10, fontWeight: '700' },
  summary: { marginTop: spacing.lg, borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm },
  summaryTitle: { fontSize: fontSize.body, fontWeight: '800' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barIcon: { width: 28, fontSize: fontSize.title - 2 },
  barTrack: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  barNum: { width: 24, textAlign: 'right', fontSize: fontSize.caption },
});
