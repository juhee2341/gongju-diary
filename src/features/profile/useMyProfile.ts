import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  nickname: string;
  avatar_type: 'emoji' | 'photo';
  avatar_emoji: string;
  avatar_path: string | null;
  week_start: 0 | 1;
};

/** 내 프로필 */
export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_type, avatar_emoji, avatar_path, week_start')
        .eq('id', u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

/** avatars 버킷은 비공개라 서명 URL로 표시(디스크 캐시는 expo-image가 담당) */
const SIGNED_URL_SECONDS = 60 * 60 * 24;

export function useAvatarUri(path: string | null | undefined) {
  return useQuery({
    queryKey: ['avatar-url', path],
    enabled: !!path,
    staleTime: (SIGNED_URL_SECONDS / 2) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path!, SIGNED_URL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  }).data;
}
