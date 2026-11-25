/** 공통 버튼. 요청 중에는 비활성 + 버튼 안 로딩 표시(연타 방지) */
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { MIN_TOUCH } from '@/constants/policy';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

type Variant = 'primary' | 'soft' | 'text' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  /** 오프라인 등: 회색으로 보이지만 탭하면 onBlockedPress(안내 토스트) */
  blocked?: boolean;
  onBlockedPress?: () => void;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  accessibilityHint,
  blocked,
  onBlockedPress,
}: Props) {
  const { colors } = useTheme();
  const isBlocked = !!blocked && !disabled && !loading;
  const inactive = disabled || loading || isBlocked;
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : variant === 'soft' ? colors.primarySoft : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger' ? colors.onPrimary : variant === 'soft' ? colors.primary : colors.textSub;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={(disabled || loading) && !isBlocked}
      onPress={isBlocked ? onBlockedPress : onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, opacity: inactive ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.label, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH + spacing.sm,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: fontSize.body, fontWeight: '700' },
});
