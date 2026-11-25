/**
 * [C3] 연간 보기: 요약(편수·가장 많았던 감정·최장 연속) + 미니 달력 12개(3열×4행), 내가 쓴 날만 감정 색 점
 * 최장 연속은 이 일기장에서 내가 쓴 날짜 전체 기준(늦은 일기 포함)
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EMOTION_ICONS, EMOTIONS, type Emotion } from '@/constants/emotions';
import { YEAR_DOT_SIZE } from '@/constants/policy';
import { emotionLabels, fill, ko } from '@/copy/ko';
import type { MyDiary } from '@/features/diary/api';
import { longestStreak, monthGrid, yearMonthOf, type YearMonth } from '@/lib/date';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { indexMeta, useEntriesMeta } from './api';

type Props = { diary: MyDiary; today: string; year: number; weekStart: 0 | 1; myId: string; onOpenMonth: (ym: YearMonth) => void };

export function YearView({ diary, today, year, weekStart, myId, onOpenMonth }: Props) {
  const { colors } = useTheme();
  const meta = useEntriesMeta(diary.id, `${year}-01-01`, `${year}-12-31`);
  const mine = (meta.data ?? []).filter((r) => r.author_id === myId);
  const { find } = indexMeta(mine);

  const counts = new Map<Emotion, number>();
  for (const r of mine) if (r.emotion) counts.set(r.emotion, (counts.get(r.emotion) ?? 0) + 1);
  const top = EMOTIONS.filter((e) => counts.get(e)).sort((a, b) => counts.get(b)! - counts.get(a)!)[0];
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.summary, { color: colors.text }]}>
        {mine.length === 0 || !top
          ? ko.diaryMain.yearEmpty
          : fill(ko.diaryMain.yearSummary, {
              N: mine.length,
              감정: `${EMOTION_ICONS[top]} ${emotionLabels[top]}`,
              S: longestStreak(mine.map((r) => r.entry_date)),
            })}
      </Text>
      <View style={styles.grid}>
        {months.map((ym) => {
          const disabled = ym > yearMonthOf(today) || ym < yearMonthOf(diary.created_date);
          return (
            <Pressable
              key={ym}
              disabled={disabled}
              accessibilityRole="button"
              onPress={() => onOpenMonth(ym)}
              style={[styles.month, { backgroundColor: colors.surface, opacity: disabled ? 0.35 : 1 }]}
            >
              <Text style={[styles.monthTitle, { color: colors.text }]}>{fill(ko.diaryMain.monthTitle, { M: Number(ym.slice(5)) })}</Text>
              {monthGrid(ym, weekStart).map((week, i) => (
                <View key={i} style={styles.week}>
                  {week.map((d, j) => {
                    const e = d ? find(d, myId)?.emotion : null;
                    return (
                      <View key={j} style={styles.dotCell}>
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: e ? colors.emotion[e] : d ? colors.border : 'transparent', opacity: e ? 1 : 0.5 },
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>
              ))}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  summary: { fontSize: fontSize.body, fontWeight: '700', lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  month: { width: '31.5%', borderRadius: radius.chip, padding: spacing.sm, gap: 2 },
  monthTitle: { fontSize: fontSize.caption, fontWeight: '800', marginBottom: spacing.xs },
  week: { flexDirection: 'row' },
  dotCell: { flex: 1, alignItems: 'center', paddingVertical: 1 },
  dot: { width: YEAR_DOT_SIZE, height: YEAR_DOT_SIZE, borderRadius: YEAR_DOT_SIZE / 2 },
});
