/**
 * 글자 수는 사용자가 보는 글자(grapheme) 단위로 센다. 이모지·한글 조합 문자 모두 1자.
 * Intl.Segmenter가 있으면 쓰고(Hermes 지원 여부는 기술 검증 5번), 없으면 근사 분리기를 쓴다.
 */
import { MAX_CONSECUTIVE_NEWLINES } from '@/constants/policy';

type SegmenterCtor = new (
  locale?: string,
  opts?: { granularity: 'grapheme' },
) => { segment(s: string): Iterable<{ segment: string }> };

const Segmenter: SegmenterCtor | undefined = (
  globalThis as { Intl?: { Segmenter?: SegmenterCtor } }
).Intl?.Segmenter;

export const hasIntlSegmenter = typeof Segmenter === 'function';

const segmenter = hasIntlSegmenter ? new Segmenter!('ko', { granularity: 'grapheme' }) : null;

// 앞 글자에 붙는 코드포인트: 결합 문자, 이형 선택자, 피부색, 태그, 한글 중성·종성 자모
const EXTEND =
  /[̀-ͯᅠ-ᇿ᪰-᫿᷀-᷿‌⃐-⃿︀-️︠-︯\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}\u{E0100}-\u{E01EF}]/u;
const ZWJ = '‍';
const REGIONAL = /[\u{1F1E6}-\u{1F1FF}]/u;
const KEYCAP = '⃣';

/** Intl.Segmenter가 없을 때 쓰는 근사 grapheme 분리 */
export function fallbackSegments(s: string): string[] {
  const cps = Array.from(s);
  const out: string[] = [];
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i]!;
    const prev = out.length ? out[out.length - 1]! : null;
    if (prev !== null) {
      const prevLast = Array.from(prev).pop()!;
      const joinsPrev =
        EXTEND.test(cp) ||
        cp === ZWJ ||
        cp === KEYCAP ||
        prevLast === ZWJ ||
        (cp === '\n' && prevLast === '\r');
      const regionalPair =
        REGIONAL.test(cp) && REGIONAL.test(prevLast) && Array.from(prev).filter((c) => REGIONAL.test(c)).length % 2 === 1;
      if (joinsPrev || regionalPair) {
        out[out.length - 1] = prev + cp;
        continue;
      }
    }
    out.push(cp);
  }
  return out;
}

export function graphemes(s: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment);
  return fallbackSegments(s);
}

export function graphemeLength(s: string): number {
  return graphemes(s).length;
}

/** 최대 글자 수로 자르기. truncated가 true면 "{N}자까지" 토스트를 띄운다 */
export function clampGraphemes(s: string, max: number): { value: string; truncated: boolean } {
  const g = graphemes(s);
  if (g.length <= max) return { value: s, truncated: false };
  return { value: g.slice(0, max).join(''), truncated: true };
}

/** 저장 전 정리: 앞뒤 공백 제거. 공백·줄바꿈만 있으면 빈 값 */
export function normalizeSingleLine(s: string): string {
  return s.trim();
}

/** 본문 정리: 앞뒤 공백 제거 + 연속 줄바꿈을 최대 2줄로 */
export function normalizeBody(s: string): string {
  const unified = s.replace(/\r\n?/g, '\n');
  const re = new RegExp(`\\n{${MAX_CONSECUTIVE_NEWLINES + 1},}`, 'g');
  return unified.replace(re, '\n'.repeat(MAX_CONSECUTIVE_NEWLINES)).trim();
}
