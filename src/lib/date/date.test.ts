import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatListDate,
  isAutoPublic,
  isLate,
  promptIndexFor,
  todayIn,
  writableRange,
} from './index';

describe('todayIn — T13 서울/LA 현지 날짜', () => {
  const instant = new Date('2026-11-25T01:00:00Z');
  it('서울은 25일, LA는 24일', () => {
    expect(todayIn('Asia/Seoul', instant)).toBe('2026-11-25');
    expect(todayIn('America/Los_Angeles', instant)).toBe('2026-11-24');
  });
});

describe('writableRange / isAutoPublic — T4·T5·T8', () => {
  const t = '2026-11-25';
  it('기간 3일이면 22일~25일 작성 가능', () => {
    expect(writableRange('2026-01-01', t, 3)).toEqual({ from: '2026-11-22', to: t });
  });
  it('참여일이 더 늦으면 참여일부터', () => {
    expect(writableRange('2026-11-24', t, 3).from).toBe('2026-11-24');
  });
  it('2일 전은 아직 잠김, 4일 전은 자동 공개', () => {
    expect(isAutoPublic(addDays(t, -2), t, 3)).toBe(false);
    expect(isAutoPublic(addDays(t, -3), t, 3)).toBe(false);
    expect(isAutoPublic(addDays(t, -4), t, 3)).toBe(true);
  });
  it('늦은 일기 판정', () => {
    expect(isLate(t, t)).toBe(false);
    expect(isLate(addDays(t, -1), t)).toBe(true);
  });
});

describe('promptIndexFor', () => {
  it('1월 1일은 0번, 1월 31일은 다시 0번', () => {
    expect(promptIndexFor('2026-01-01')).toBe(0);
    expect(promptIndexFor('2026-01-31')).toBe(0);
    expect(promptIndexFor('2026-01-02')).toBe(1);
  });
  it('새로고침하면 다음 번호', () => {
    expect(promptIndexFor('2026-01-30', 1)).toBe(0);
  });
});

describe('formatListDate', () => {
  it('같은 해/다른 해', () => {
    expect(formatListDate('2026-11-19', '2026-11-25')).toBe('11월 19일 (목)');
    expect(formatListDate('2025-11-19', '2026-11-25')).toBe('2025년 11월 19일 (수)');
  });
});
