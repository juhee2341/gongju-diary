/** [G1] 설정 — 11단계에서 구현. 화면 모드 선택만 먼저 둔다(테마 토큰 확인용) */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MIN_TOUCH } from '@/constants/policy';
import { ko } from '@/copy/ko';
import type { ThemeMode } from '@/lib/device';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

export default function Settings() {
  const { colors, mode, setMode } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {ko.tabs.settings}
      </Text>
      <Text style={[styles.label, { color: colors.textSub }]}>{ko.settings.themeMode}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {MODES.map((m) => (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ checked: mode === m }}
            onPress={() => setMode(m)}
            style={[styles.chip, { backgroundColor: mode === m ? colors.primarySoft : colors.surface, borderColor: mode === m ? colors.primary : colors.border }]}
          >
            <Text style={{ color: mode === m ? colors.primary : colors.text, fontWeight: '600' }}>{ko.settings.themeModes[m]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.note, { color: colors.textSub }]}>{ko.settings.placeholder}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl },
  title: { fontSize: fontSize.title + 4, fontWeight: '800', paddingVertical: spacing.lg },
  label: { fontSize: fontSize.caption, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: { minHeight: MIN_TOUCH, paddingHorizontal: spacing.lg, borderRadius: radius.button, borderWidth: 1.5, justifyContent: 'center' },
  note: { marginTop: spacing.xxl, fontSize: fontSize.caption },
});
