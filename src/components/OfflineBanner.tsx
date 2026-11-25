/** [공통 네트워크] 오프라인 상단 띠 배너 */
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ko } from '@/copy/ko';
import { useOnline } from '@/hooks/useOnline';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, spacing } from '@/theme/tokens';

export function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[styles.bar, { paddingTop: insets.top + spacing.xs, backgroundColor: colors.textSub }]}
    >
      <Text style={[styles.text, { color: colors.background }]}>{ko.common.offline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: spacing.xs, alignItems: 'center', zIndex: 10 },
  text: { fontSize: fontSize.caption, fontWeight: '600' },
});
