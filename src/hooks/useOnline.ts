import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** 네트워크 연결 여부(TanStack onlineManager 기준) */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
  );
}
