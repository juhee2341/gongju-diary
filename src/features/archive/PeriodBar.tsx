/** [C1~C4] 기간 선택 바: "11.17 ~ 11.23" + 좌우 화살표 + "오늘" */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH } from '@/constants/policy';
import { ko } from '@/copy/ko';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

type Props = {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  onToday?: () => void;
  prevLabel?: string;
  nextLabel?: string;
};

export function PeriodBar({ label, onPrev, onNext, prevDisabled, nextDisabled, onToday, prevLabel = ko.diaryMain.prev, nextLabel = ko.diaryMain.next }: Props) {
  const { colors } = useTheme();
  const arrow = (text: string, a11y: string, onPress: () => void, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.arrow}
    >
      <Text style={{ fontSize: fontSize.title, color: disabled ? colors.border : colors.text }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={styles.bar}>
      {arrow('‹', prevLabel, onPrev, prevDisabled)}
      <Text style={[styles.label, { color: colors.text }]} accessibilityRole="header">
        {label}
      </Text>
      {arrow('›', nextLabel, onNext, nextDisabled)}
      <View style={styles.todaySlot}>
        {onToday && (
          <Pressable accessibilityRole="button" onPress={onToday} style={[styles.today, { borderColor: colors.primary }]}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: fontSize.caption }}>{ko.diaryMain.today}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  arrow: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: fontSize.body + 1, fontWeight: '800', minWidth: 120, textAlign: 'center' },
  todaySlot: { flex: 1, alignItems: 'flex-end' },
  today: { borderWidth: 1.5, borderRadius: radius.button, paddingHorizontal: spacing.md, minHeight: MIN_TOUCH - spacing.md, justifyContent: 'center' },
});
