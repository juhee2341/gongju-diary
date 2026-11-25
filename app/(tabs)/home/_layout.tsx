/** 홈 탭 스택: B1 → C1~C4, D2, E1·E2 (screens.md 공통 규칙 내비게이션) */
import { Stack } from 'expo-router';
import { ko } from '@/copy/ko';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeStack() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackTitle: ko.common.back,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="diary/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="diary/[id]/settings" options={{ title: ko.diarySettings.title }} />
    </Stack>
  );
}
