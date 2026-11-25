/** [공통 날짜] 오늘: 포그라운드 복귀 또는 1분마다 다시 계산(자정 넘김 대응) */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { TODAY_RECHECK_MS } from '@/constants/policy';
import { today } from '@/lib/date';

export function useToday(): string {
  const [value, setValue] = useState(today);
  useEffect(() => {
    const update = () => setValue(today());
    const timer = setInterval(update, TODAY_RECHECK_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && update());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return value;
}
