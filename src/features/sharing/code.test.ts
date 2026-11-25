import { describe, expect, it } from 'vitest';
import { normalizeCode } from './code';

describe('normalizeCode — B3', () => {
  it('소문자·공백·하이픈·허용 안 되는 문자(O, I, 0, 1) 정리, 6자 자르기', () => {
    expect(normalizeCode('ab c-d2e9')).toBe('ABCD2E');
    expect(normalizeCode('OI01XYZ')).toBe('XYZ');
    expect(normalizeCode('공주일기 초대 코드 LE3YTP 링크')).toBe('LE3YTP');
  });
});
