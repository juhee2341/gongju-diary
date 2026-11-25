import { INVITE_CODE } from '@/constants/policy';

/** [B3] 대문자로, 허용 문자(A~Z·2~9 중 O·I 제외)만, 6자까지 — 붙여넣기도 6칸에 나눠 들어간다 */
export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => INVITE_CODE.alphabet.includes(c))
    .join('')
    .slice(0, INVITE_CODE.length);
}
