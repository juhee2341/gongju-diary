import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  formatWeekRange,
  longestStreak,
  monthGrid,
  startOfWeek,
  weekdayOrder,
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


describe('주·월 계산 — C1·C2', () => {
  it('startOfWeek: 월요일 시작/일요일 시작', () => {
    // 2026-11-25 수요일
    expect(startOfWeek('2026-11-25', 1)).toBe('2026-11-23');
    expect(startOfWeek('2026-11-25', 0)).toBe('2026-11-22');
    expect(startOfWeek('2026-11-23', 1)).toBe('2026-11-23');
    expect(startOfWeek('2026-11-22', 1)).toBe('2026-11-16');
  });
  it('주 범위 표기', () => {
    expect(formatWeekRange('2026-11-23')).toBe('11.23 ~ 11.29');
  });
  it('월 그리드: 2026년 11월(일요일 1일), 월요일 시작이면 6줄', () => {
    const g = monthGrid('2026-11', 1);
    expect(g).toHaveLength(6);
    expect(g[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(g[5]![0]).toBe('2026-11-30');
    expect(monthGrid('2026-11', 0)).toHaveLength(5);
  });
  it('요일 머리글과 월 이동', () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});

describe('longestStreak — C3', () => {
  it('끊김 없이 이어진 가장 긴 구간, 중복·순서 무관', () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(['2026-11-03', '2026-11-01', '2026-11-02', '2026-11-05'])).toBe(3);
    expect(longestStreak(['2026-12-31', '2027-01-01', '2027-01-01'])).toBe(2);
  });
});
