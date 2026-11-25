/**
 * TanStack Query 설정. 캐시 우선 표시, 포그라운드 복귀·재연결 시 갱신. 실시간 구독은 쓰지 않는다.
 */
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

AppState.addEventListener('change', (status) => {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, gcTime: 24 * 60 * 60 * 1000 },
    mutations: { retry: 0 },
  },
});

export const queryKeys = {
  appConfig: ['app_config'] as const,
  myProfile: ['profile', 'me'] as const,
  myDiaries: ['diaries', 'mine'] as const,
};
