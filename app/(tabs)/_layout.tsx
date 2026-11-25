/** 하단 탭 3개: 홈(B1) · 알림(F1) · 설정(G1). 알림 배지는 8단계에서 연결 */
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { ko } from '@/copy/ko';
import { useTheme } from '@/theme/ThemeProvider';

const ICONS = { home: '🏰', notifications: '🔔', settings: '⚙️' } as const;

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSub,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {(Object.keys(ICONS) as Array<keyof typeof ICONS>).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: ko.tabs[name],
            tabBarAccessibilityLabel: ko.tabs[name],
            tabBarIcon: ({ focused }) => (
              <Text style={{ opacity: focused ? 1 : 0.5 }} accessibilityElementsHidden importantForAccessibility="no" aria-hidden>
                {ICONS[name]}
              </Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
