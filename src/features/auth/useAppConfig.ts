import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { supabase } from '@/lib/supabase';

/** [A4, B2, E1] 금지어 목록(app_config.banned_words) */
export function useBannedWords() {
  return useQuery({
    queryKey: [...queryKeys.appConfig, 'banned_words'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_config').select('value').eq('key', 'banned_words').maybeSingle();
      if (error) throw error;
      return Array.isArray(data?.value) ? (data.value as string[]) : [];
    },
    staleTime: Infinity,
  });
}

/** 앱 쪽 미리 검사(서버 has_banned_word와 같은 규칙: 대소문자 무시 부분 일치) */
export function containsBannedWord(text: string, words: readonly string[]): boolean {
  const t = text.toLowerCase();
  return words.some((w) => w.length > 0 && t.includes(w.toLowerCase()));
}
