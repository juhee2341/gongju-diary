import { describe, expect, it } from 'vitest';
import { fill, ko } from './ko';

describe('fill', () => {
  it('한글·영문 자리표시자를 모두 치환', () => {
    expect(fill(ko.home.greeting, { 닉네임: '공주' })).toBe('안녕, 공주님');
    expect(fill(ko.invite.shareMessage, { 코드: 'ABC234', 링크: 'gongju://join/ABC234' })).toBe(
      '공주일기에서 같이 일기 써요! 초대 코드 ABC234 gongju://join/ABC234',
    );
    expect(fill(ko.common.maxChars, { N: 10 })).toBe('10자까지 쓸 수 있어요');
  });
  it('없는 키는 그대로 둔다', () => {
    expect(fill('{A}{B}', { A: 1 })).toBe('1{B}');
  });
});
