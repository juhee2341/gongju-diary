import { describe, expect, it } from 'vitest';
import { clampGraphemes, fallbackSegments, graphemeLength, normalizeBody } from './index';

const samples: Array<[string, number]> = [
  ['공주일기', 4],
  ['👑', 1],
  ['👩‍👩‍👧‍👦', 1],
  ['👍🏽', 1],
  ['🇰🇷🇯🇵', 2],
  ['❤️', 1],
  ['1️⃣', 1],
  ['é', 1],
  ['abc', 3],
];

describe('graphemeLength', () => {
  it.each(samples)('%s → %i자', (s, n) => {
    expect(graphemeLength(s)).toBe(n);
  });
});

describe('fallbackSegments (Intl.Segmenter 없는 환경)', () => {
  it.each(samples)('%s → %i자', (s, n) => {
    expect(fallbackSegments(s).length).toBe(n);
  });
});

describe('clampGraphemes', () => {
  it('이모지를 쪼개지 않고 자른다', () => {
    expect(clampGraphemes('가👩‍👩‍👧나다', 2)).toEqual({ value: '가👩‍👩‍👧', truncated: true });
    expect(clampGraphemes('가나', 2)).toEqual({ value: '가나', truncated: false });
  });
});

describe('normalizeBody', () => {
  it('앞뒤 공백 제거, 연속 줄바꿈 최대 2줄', () => {
    expect(normalizeBody('  a\n\n\n\nb \r\n ')).toBe('a\n\nb');
    expect(normalizeBody(' \n \n ')).toBe('');
  });
});
