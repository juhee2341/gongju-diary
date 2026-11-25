/**
 * [A1] 스플래시 시작 처리
 * 1. app_config.min_version 확인(실패하면 건너뜀)
 * 2. 세션 확인 → 없으면 익명 계정 생성
 * 3. timezone·last_seen_at 갱신(touch_session) + 정지·약관 버전 확인
 * 4. 앱 잠금(A2)은 10단계에서 연결
 * 5. 온보딩 미완료 → A3, 프로필 없음 → A4, 그 외 → B1
 */
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { TERMS_VERSION } from '@/constants/policy';
import type { ErrorCode } from '@/copy/ko';
import { deviceTimezone } from '@/lib/date';
import { deviceStore } from '@/lib/device';
import { AppError, rpc, supabase, toErrorCode } from '@/lib/supabase';
import { compareVersions } from '@/lib/version';

export type BootResult =
  | { kind: 'forceUpdate' }
  | { kind: 'suspended' }
  | { kind: 'error'; reason: 'firstRunOffline' | ErrorCode }
  | { kind: 'route'; to: '/onboarding' | '/profile/new' | '/home'; reconsent: boolean };

type TouchRow = { has_profile: boolean; status: string | null; terms_version: string | null };

async function isForceUpdate(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('app_config').select('value').eq('key', 'min_version').maybeSingle();
    if (error || !data) return false;
    const current = Constants.expoConfig?.version ?? '0.0.0';
    return compareVersions(current, String(data.value)) < 0;
  } catch {
    return false; // 버전 확인 실패: 강제 업데이트 검사만 건너뛴다
  }
}

export async function bootstrap(): Promise<BootResult> {
  const net = await NetInfo.fetch();
  const online = net.isConnected !== false;

  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData.session;

  if (!session) {
    if (!online) return { kind: 'error', reason: 'firstRunOffline' };
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) return { kind: 'error', reason: toErrorCode(error) };
    session = data.session;
  }

  const onboardingDone = await deviceStore.isOnboardingDone();

  // 세션은 있는데 오프라인: 캐시로 진입
  if (!online) {
    return { kind: 'route', to: onboardingDone ? '/home' : '/onboarding', reconsent: false };
  }

  if (await isForceUpdate()) return { kind: 'forceUpdate' };

  let touch: TouchRow | undefined;
  try {
    const rows = await rpc<TouchRow[]>('touch_session', { p_timezone: deviceTimezone() });
    touch = rows[0];
  } catch (e) {
    return { kind: 'error', reason: e instanceof AppError ? e.code : 'network' };
  }

  if (touch?.status === 'suspended') return { kind: 'suspended' };

  if (!onboardingDone) return { kind: 'route', to: '/onboarding', reconsent: false };
  if (!touch?.has_profile) return { kind: 'route', to: '/profile/new', reconsent: false };

  return { kind: 'route', to: '/home', reconsent: touch.terms_version !== TERMS_VERSION };
}

/** [A3] 약관 개정 재동의 */
export async function agreeTerms(): Promise<void> {
  await rpc('agree_terms', { p_terms_version: TERMS_VERSION });
}
