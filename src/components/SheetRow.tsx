/** 바텀시트·설정 화면의 한 줄 버튼 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH } from '@/constants/policy';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, spacing } from '@/theme/tokens';

type Props = {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: ReactNode;
  dot?: boolean;
};

export function SheetRow({ label, value, onPress, danger, right, dot }: Props) {
  const { colors } = useTheme();
  const content = (
    <>
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
        {dot && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
      </View>
      {value !== undefined && <Text style={[styles.value, { color: colors.textSub }]}>{value}</Text>}
      {right}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH + spacing.sm, gap: spacing.md },
  labelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: fontSize.body },
  value: { fontSize: fontSize.body },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
