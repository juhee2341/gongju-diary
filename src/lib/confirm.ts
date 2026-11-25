/**
 * [공통 문구] 확인창: 제목 1줄 + 설명 + 버튼 2개(오른쪽이 실행).
 * 되돌릴 수 없는 실행은 destructive(danger).
 */
import { Alert } from 'react-native';
import { ko } from '@/copy/ko';

export function confirm(opts: { title: string; message?: string; ok: string; destructive?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: ko.common.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: opts.ok, style: opts.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
