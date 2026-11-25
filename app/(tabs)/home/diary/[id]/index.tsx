/**
 * [C1] 일기장 메인 — 4단계(#3)에서 주간 그리드로 바꾼다.
 * 지금은 "오늘 일기 쓰기"와 내가 쓴 일기 목록(→ D2)만 둔다.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { EMOTION_ICONS } from '@/constants/emotions';
import { MIN_TOUCH } from '@/constants/policy';
import { emotionLabels, ko } from '@/copy/ko';
import { useDiary } from '@/features/diary/api';
import { CoverPreview } from '@/features/diary/DiaryFormFields';
import { useMissingDiary } from '@/features/diary/useMissingDiary';
import { useMyEntries } from '@/features/entry/api';
import { useMyUserId } from '@/hooks/useMyUserId';
import { useOnline } from '@/hooks/useOnline';
import { useToast } from '@/components/Toast';
import { useToday } from '@/hooks/useToday';
import { formatListDate } from '@/lib/date';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

export default function DiaryMain() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const today = useToday();
  const userId = useMyUserId();
  const { diary, missing } = useDiary(id);
  const entries = useMyEntries(id, userId);
  useMissingDiary(missing);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: diary?.name ?? '',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ko.diaryMain.settings}
              onPress={() => router.push({ pathname: '/home/diary/[id]/settings', params: { id } })}
              style={styles.icon}
            >
              <Text style={{ fontSize: fontSize.title }}>⚙️</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={entries.data ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {diary && <CoverPreview name={diary.name} cover={diary.cover_color} />}
            <Text style={[styles.note, { color: colors.textSub }]}>{ko.diaryMain.placeholder}</Text>
            {(entries.data?.length ?? 0) > 0 && (
              <Text style={[styles.section, { color: colors.text }]}>{ko.diaryMain.myEntries}</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/home/entry/[id]', params: { id: item.id } })}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={styles.emo} accessibilityLabel={emotionLabels[item.emotion]}>
              {EMOTION_ICONS[item.emotion]}
            </Text>
            <View style={styles.rowText}>
              <Text style={[styles.rowDate, { color: colors.textSub }]}>{formatListDate(item.entry_date, today)}</Text>
              <Text style={{ color: colors.text }} numberOfLines={1}>
                {item.content || '📷'}
              </Text>
            </View>
          </Pressable>
        )}
      />
      {diary && !diary.wrote_today && (
        <View style={styles.bottom}>
          <Button
            label={ko.diaryMain.writeToday}
            onPress={() => router.push({ pathname: '/entry/write', params: { diaryId: id } })}
            blocked={!online}
            onBlockedPress={() => toast(ko.common.offline)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  icon: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.xl, gap: spacing.sm },
  header: { gap: spacing.lg, marginBottom: spacing.sm },
  note: { textAlign: 'center', fontSize: fontSize.caption },
  section: { fontSize: fontSize.body, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, borderWidth: 1, minHeight: MIN_TOUCH + spacing.md },
  emo: { fontSize: fontSize.title + 2 },
  rowText: { flex: 1, gap: 2 },
  rowDate: { fontSize: fontSize.caption },
  bottom: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
});
