/**
 * 날짜 계산은 이 모듈에서만 한다.
 * - "오늘"은 사용자 현지 날짜(YYYY-MM-DD 문자열, LocalDate)
 * - 서버는 user_settings.timezone으로 같은 계산을 한다(supabase/migrations의 user_today)
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/ko';
import { DAILY_PROMPTS } from '@/constants/prompts';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('ko');

/** 'YYYY-MM-DD' 형식 현지 날짜 */
export type LocalDate = string;

const FMT = 'YYYY-MM-DD';

/** 기기의 IANA 시간대 이름(user_settings.timezone에 저장) */
export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** 주어진 시간대의 오늘. now는 테스트용 */
export function todayIn(tz: string, now: Date = new Date()): LocalDate {
  return dayjs(now).tz(tz).format(FMT);
}

/** 기기 현지 오늘 */
export function today(now: Date = new Date()): LocalDate {
  return todayIn(deviceTimezone(), now);
}

function parse(d: LocalDate) {
  return dayjs.utc(d, FMT);
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return parse(d).add(n, 'day').format(FMT);
}

/** a − b (일) */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return parse(a).diff(parse(b), 'day');
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

/**
 * 작성 가능 날짜 범위 — 참여일과 (오늘 − LATE_WINDOW) 중 늦은 날부터 오늘까지.
 * 이미 일기가 있는 날짜 제외는 호출하는 쪽에서 한다.
 */
export function writableRange(
  joinedDate: LocalDate,
  todayDate: LocalDate,
  lateWindowDays: number,
): { from: LocalDate; to: LocalDate } {
  return { from: maxDate(joinedDate, addDays(todayDate, -lateWindowDays)), to: todayDate };
}

/** 자동 공개: D < 오늘 − LATE_WINDOW */
export function isAutoPublic(d: LocalDate, todayDate: LocalDate, lateWindowDays: number): boolean {
  return d < addDays(todayDate, -lateWindowDays);
}

/** 늦은 일기: 작성 시점의 오늘이 아닌 날짜 */
export function isLate(d: LocalDate, todayDate: LocalDate): boolean {
  return d !== todayDate;
}

/** 오늘의 질문 번호: 그해 1월 1일부터 센 순번(0부터) % 30, 새로고침 횟수만큼 다음 번호 */
export function promptIndexFor(d: LocalDate, refresh = 0): number {
  const dayOfYear = diffDays(d, `${d.slice(0, 4)}-01-01`);
  return (dayOfYear + refresh) % DAILY_PROMPTS.length;
}

/** 목록 날짜 표기: "11월 19일 (목)", 연도가 다르면 "2025년 11월 19일 (수)" */
export function formatListDate(d: LocalDate, todayDate: LocalDate): string {
  const sameYear = d.slice(0, 4) === todayDate.slice(0, 4);
  return parse(d).locale('ko').format(sameYear ? 'M월 D일 (dd)' : 'YYYY년 M월 D일 (dd)');
}

/** 0=일 … 6=토 */
export function dayOfWeek(d: LocalDate): number {
  return parse(d).day();
}

/** [C1] d가 속한 주의 첫날(weekStart: 1=월, 0=일) */
export function startOfWeek(d: LocalDate, weekStart: 0 | 1): LocalDate {
  const back = (dayOfWeek(d) - weekStart + 7) % 7;
  return addDays(d, -back);
}

/** [C1] 주의 7일 */
export function weekDays(start: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** "YYYY-MM" */
export type YearMonth = string;

export function yearMonthOf(d: LocalDate): YearMonth {
  return d.slice(0, 7);
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  return dayjs.utc(`${ym}-01`, FMT).add(n, 'month').format('YYYY-MM');
}

export function lastDayOfMonth(ym: YearMonth): LocalDate {
  return dayjs.utc(`${ym}-01`, FMT).endOf('month').format(FMT);
}

/** [C2] 달력 그리드: 주 단위 배열, 그 달이 아닌 칸은 null. 필요한 주 수만큼(4~6줄) */
export function monthGrid(ym: YearMonth, weekStart: 0 | 1): Array<Array<LocalDate | null>> {
  const first = `${ym}-01`;
  const last = lastDayOfMonth(ym);
  const weeks: Array<Array<LocalDate | null>> = [];
  let cursor = startOfWeek(first, weekStart);
  while (cursor <= last) {
    weeks.push(weekDays(cursor).map((d) => (yearMonthOf(d) === ym ? d : null)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** [C2] 요일 머리글 순서(0=일 … 6=토) */
export function weekdayOrder(weekStart: 0 | 1): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;
export function weekdayLabel(dow: number): string {
  return WEEKDAY_KO[dow]!;
}

/** [C1] "11.17 ~ 11.23" */
export function formatWeekRange(start: LocalDate): string {
  const end = addDays(start, 6);
  return `${parse(start).format('M.D')} ~ ${parse(end).format('M.D')}`;
}

/** [C2] "2026년 11월" */
export function formatYearMonth(ym: YearMonth): string {
  return dayjs.utc(`${ym}-01`, FMT).format('YYYY년 M월');
}

/** [C3] 최장 연속 기록: 날짜가 끊김 없이 이어진 가장 긴 구간의 길이 */
export function longestStreak(dates: LocalDate[]): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev: LocalDate | null = null;
  for (const d of sorted) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** [E1] "2026년 11월 19일" */
export function formatFullDate(d: LocalDate): string {
  return parse(d).format('YYYY년 M월 D일');
}

/** 알림 문구용 "M월 D일" */
export function formatMonthDay(d: LocalDate): string {
  return parse(d).format('M월 D일');
}

/** 시각 표기: 1시간 안 "N분 전", 오늘 "오후 3:20", 그 외 "11월 18일" */
export function formatTime(iso: string, now: Date = new Date(), tz: string = deviceTimezone()): string {
  const t = dayjs(iso).tz(tz);
  const n = dayjs(now).tz(tz);
  const minutes = n.diff(t, 'minute');
  if (minutes >= 0 && minutes < 60) return `${Math.max(minutes, 1)}분 전`;
  if (t.format(FMT) === n.format(FMT)) return t.locale('ko').format('A h:mm');
  return t.format('M월 D일');
}
