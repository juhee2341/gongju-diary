/** [B2, E1] 초대 코드 복사·공유 */
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { INVITE_LINK } from '@/constants/app';
import { fill, ko } from '@/copy/ko';

export async function copyInviteCode(code: string): Promise<void> {
  await Clipboard.setStringAsync(code);
}

export async function shareInvite(code: string): Promise<void> {
  await Share.share({ message: fill(ko.invite.shareMessage, { 코드: code, 링크: INVITE_LINK(code) }) });
}
