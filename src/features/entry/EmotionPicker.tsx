/** [D1] 감정 10종 가로 스크롤(아이콘 + 라벨, 선택 시 primarySoft) — 선택 시 가벼운 진동 */
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { EMOTION_ICONS, EMOTIONS, type Emotion } from '@/constants/emotions';
import { MIN_TOUCH } from '@/constants/policy';
import { emotionLabels } from '@/copy/ko';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

export function EmotionPicker({ value, onChange }: { value: Emotion | null; onChange: (e: Emotion) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="radiogroup">
      {EMOTIONS.map((e) => {
        const on = value === e;
        return (
          <Pressable
            key={e}
            accessibilityRole="radio"
            accessibilityLabel={emotionLabels[e]}
            accessibilityState={{ checked: on }}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              onChange(e);
            }}
            style={[
              styles.item,
              { backgroundColor: on ? colors.primarySoft : 'transparent', borderColor: on ? colors.primary : colors.border },
            ]}
          >
            <Text style={styles.icon}>{EMOTION_ICONS[e]}</Text>
            <Text style={[styles.label, { color: on ? colors.primary : colors.textSub }]}>{emotionLabels[e]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  item: {
    minWidth: MIN_TOUCH + spacing.xl,
    minHeight: MIN_TOUCH + spacing.xl,
    borderRadius: radius.card,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  icon: { fontSize: fontSize.title + 4 },
  label: { fontSize: fontSize.caption, fontWeight: '600' },
});
