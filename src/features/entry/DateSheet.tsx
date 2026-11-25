/**
 * [D1] 날짜 선택 바텀시트: 작성 가능 날짜만 선택, 이미 쓴 날짜는 체크 + 비활성.
 * 범위가 최대 8일이라 달력 대신 날짜 칩 목록으로 보여준다.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { MIN_TOUCH } from '@/constants/policy';
import { ko } from '@/copy/ko';
import { addDays, diffDays, formatListDate } from '@/lib/date';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

type Props = {
  visible: boolean;
  from: string;
  to: string;
  today: string;
  selected: string;
  written: string[];
  onSelect: (d: string) => void;
  onClose: () => void;
};

export function DateSheet({ visible, from, to, today, selected, written, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const days = Array.from({ length: Math.max(0, diffDays(to, from) + 1) }, (_, i) => addDays(to, -i));
  return (
    <BottomSheet visible={visible} onClose={onClose} title={ko.write.datePickerTitle}>
      <View style={styles.grid}>
        {days.map((d) => {
          const done = written.includes(d);
          const on = d === selected;
          return (
            <Pressable
              key={d}
              disabled={done}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: done }}
              onPress={() => onSelect(d)}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? colors.primarySoft : colors.background,
                  borderColor: on ? colors.primary : colors.border,
                  opacity: done ? 0.45 : 1,
                },
              ]}
            >
              <Text style={{ color: on ? colors.primary : colors.text, fontWeight: '700' }}>
                {formatListDate(d, today)}
                {d === today ? ko.write.todaySuffix : ''}
              </Text>
              {done && <Text style={{ color: colors.textSub, fontSize: fontSize.caption }}>✓ {ko.write.dateWritten}</Text>}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.chip,
    borderWidth: 1.5,
  },
});
