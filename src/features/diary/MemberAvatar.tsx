/** 멤버 아바타(사진이면 서명 URL). 떠난 공주는 흐린 왕관 */
import { AvatarView } from '@/components/AvatarView';
import { useAvatarUri } from '@/features/profile/useMyProfile';
import type { MemberPreview } from './api';

export function MemberAvatar({ member, size }: { member: MemberPreview | undefined; size: number }) {
  const uri = useAvatarUri(member?.avatar_type === 'photo' ? member.avatar_path : null);
  return <AvatarView size={size} emoji={member?.avatar_emoji} photoUri={uri} faded={!member} />;
}
