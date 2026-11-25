/**
 * [A4] 프로필 만들기 완료 처리
 * 사진 업로드(실패 시 👑 이모지로 대체) → complete_profile RPC
 * (profiles + user_settings + 혼자 쓰기 "나의 공주일기"를 한 트랜잭션에서 생성)
 */
import { AVATAR_EMOJI_DEFAULT } from '@/constants/avatars';
import { TERMS_VERSION } from '@/constants/policy';
import { ko } from '@/copy/ko';
import { deviceTimezone } from '@/lib/date';
import { deviceStore } from '@/lib/device';
import { readAsArrayBuffer } from '@/lib/image';
import { AppError, rpc, supabase } from '@/lib/supabase';
import { normalizeSingleLine } from '@/lib/text';

export type ProfileInput = {
  nickname: string;
  avatarType: 'emoji' | 'photo';
  emoji: string;
  /** processAvatar로 처리된 로컬 파일 */
  photoUri: string | null;
};

export type CreateProfileResult = { photoFailed: boolean };

async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const path = `${userId}.jpg`;
  const body = await readAsArrayBuffer(uri);
  const { error } = await supabase.storage.from('avatars').upload(path, body, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function createProfile(input: ProfileInput): Promise<CreateProfileResult> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new AppError('network');

  let avatarType = input.avatarType;
  let avatarPath: string | null = null;
  let photoFailed = false;

  if (avatarType === 'photo' && input.photoUri) {
    try {
      avatarPath = await uploadAvatar(userId, input.photoUri);
    } catch {
      avatarType = 'emoji';
      photoFailed = true;
    }
  } else {
    avatarType = 'emoji';
  }

  const consent = await deviceStore.getTermsConsent();

  await rpc('complete_profile', {
    p_nickname: normalizeSingleLine(input.nickname),
    p_avatar_type: avatarType,
    p_avatar_emoji: avatarType === 'emoji' ? input.emoji : AVATAR_EMOJI_DEFAULT,
    p_avatar_path: avatarPath,
    p_terms_version: consent?.version ?? TERMS_VERSION,
    p_terms_agreed_at: consent?.agreedAt ?? new Date().toISOString(),
    p_timezone: deviceTimezone(),
    p_solo_diary_name: ko.diary.defaultSoloName,
  });

  return { photoFailed };
}
