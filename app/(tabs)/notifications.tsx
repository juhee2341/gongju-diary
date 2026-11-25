/** [F1] 알림 — 8단계에서 구현 */
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ko } from '@/copy/ko';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, spacing } from '@/theme/tokens';

export default function Notifications() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <Text style={{ color: colors.textSub, fontSize: fontSize.body }}>{ko.notifications.placeholder}</Text>
    </SafeAreaView>
  );
}
