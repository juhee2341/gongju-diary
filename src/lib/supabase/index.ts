/**
 * Supabase 클라이언트. 세션은 AsyncStorage에 저장한다.
 * 모든 요청은 REQUEST_TIMEOUT_MS를 넘으면 중단되고 'timeout' 오류 코드가 된다.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { REQUEST_TIMEOUT_MS } from '@/constants/policy';
import { errorCopy, type ErrorCode } from '@/copy/ko';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isSupabaseConfigured = url.length > 0 && key.length > 0;

class TimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutError';
  }
}

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  init?.signal?.addEventListener('abort', () => controller.abort());
  return fetch(input, { ...init, signal: controller.signal })
    .catch((e: unknown) => {
      if (controller.signal.aborted && !init?.signal?.aborted) throw new TimeoutError();
      throw e;
    })
    .finally(() => clearTimeout(timer));
};

export const supabase = createClient(url || 'http://localhost', key || 'missing-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchWithTimeout },
});

// [공통 권한·세션] 포그라운드일 때만 토큰 자동 갱신
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** 서버 오류 → 앱 오류 코드. RPC는 raise exception '<code>'로 코드를 돌려준다 */
export function toErrorCode(err: unknown): ErrorCode {
  if (err instanceof TimeoutError) return 'timeout';
  const message =
    typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : '';
  if (message === 'timeout') return 'timeout';
  if (message in errorCopy) return message as ErrorCode;
  return 'network';
}

export class AppError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
    this.name = 'AppError';
  }
}

/** RPC 호출: 실패 시 AppError(code)를 던진다 */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new AppError(toErrorCode(error));
    return data as T;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(toErrorCode(e));
  }
}
