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
