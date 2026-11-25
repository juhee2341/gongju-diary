/** [공통 권한·세션] 멤버가 아니게 된 일기장: 토스트 "사라진 일기장이에요" → B1로 스택 초기화 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { errorCopy } from '@/copy/ko';

export function useMissingDiary(missing: boolean) {
  const toast = useToast();
  useEffect(() => {
    if (!missing) return;
    toast(errorCopy.not_member);
    router.dismissTo('/home');
  }, [missing, toast]);
}

/** 서버가 not_member를 돌려줬을 때 같은 처리 */
export function leaveMissingDiary(toast: (m: string) => void) {
  toast(errorCopy.not_member);
  router.dismissTo('/home');
}
