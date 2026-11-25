/** [C1] 일기장 메인 — 4단계에서 주간 그리드를 만든다. 지금은 진입 경로와 설정 아이콘만 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH } from '@/constants/policy';
import { ko } from '@/copy/ko';
import { useDiary } from '@/features/diary/api';
import { CoverPreview } from '@/features/diary/DiaryFormFields';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, spacing } from '@/theme/tokens';
import { useMissingDiary } from '@/features/diary/useMissingDiary';

export default function DiaryMain() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { diary, missing } = useDiary(id);
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
      {diary && <CoverPreview name={diary.name} cover={diary.cover_color} />}
      <Text style={[styles.note, { color: colors.textSub }]}>{ko.diaryMain.placeholder}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.xl, gap: spacing.xl },
  icon: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  note: { textAlign: 'center', fontSize: fontSize.caption },
});
