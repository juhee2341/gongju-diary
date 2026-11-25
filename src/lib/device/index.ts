/**
 * 기기 저장소(AsyncStorage). 서버로 보내지 않는 값만 둔다.
 * PIN 해시·실패 횟수는 secure store(10단계, src/features/lock)에 둔다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  onboardingDone: 'gongju.onboardingDone',
  termsConsent: 'gongju.termsConsent',
  themeMode: 'gongju.themeMode',
} as const;

export type ThemeMode = 'system' | 'light' | 'dark';
export type TermsConsent = { version: string; agreedAt: string };

async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function setJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

/** [D1] 임시저장(일기장 id + 날짜 단위). 사진은 기기 안의 처리된 파일 경로 */
export type EntryDraft = {
  emotion: string | null;
  content: string;
  photos: Array<{ full: string; thumb: string }>;
  savedAt: string;
};
const draftKey = (diaryId: string, date: string) => `gongju.draft.${diaryId}.${date}`;

export const drafts = {
  get: (diaryId: string, date: string) => getJSON<EntryDraft>(draftKey(diaryId, date)),
  set: (diaryId: string, date: string, d: EntryDraft) => setJSON(draftKey(diaryId, date), d),
  remove: async (diaryId: string, date: string) => {
    try {
      await AsyncStorage.removeItem(draftKey(diaryId, date));
    } catch {
      // 기기 저장소 오류는 무시(다음 임시저장에서 덮어씀)
    }
  },
};

export const deviceStore = {
  /** [A3] 온보딩 완료 기록 */
  isOnboardingDone: async () => (await getJSON<boolean>(KEYS.onboardingDone)) === true,
  setOnboardingDone: () => setJSON(KEYS.onboardingDone, true),

  /** [A3] 동의 버전·시각 — A4 완료 때 profiles로 저장 */
  getTermsConsent: () => getJSON<TermsConsent>(KEYS.termsConsent),
  setTermsConsent: (c: TermsConsent) => setJSON(KEYS.termsConsent, c),

  /** [G1] 화면 모드 */
  getThemeMode: async (): Promise<ThemeMode> => (await getJSON<ThemeMode>(KEYS.themeMode)) ?? 'system',
  setThemeMode: (m: ThemeMode) => setJSON(KEYS.themeMode, m),
};
