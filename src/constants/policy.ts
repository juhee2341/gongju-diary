/**
 * 정책 상수 — docs/spec.md '정책 상수' 표를 그대로 옮긴다.
 * 숫자는 이 파일에서만 정의하고, 화면·로직은 여기서 가져다 쓴다.
 */

/** [B3, E2] 일기장 최대 인원(주인 포함) */
export const MAX_MEMBERS = 10;

/** [A4, G1] 닉네임 글자 수(grapheme) */
export const NICKNAME_LEN = { min: 1, max: 10 } as const;

/** [B2, E1] 일기장 이름 글자 수 */
export const DIARY_NAME_LEN = { min: 1, max: 20 } as const;

/** [D1] 일기 본문 최대 글자 수 */
export const ENTRY_MAX_CHARS = 300;

/** [D1] 사진이 없을 때 본문 최소 글자 수 */
export const ENTRY_MIN_CHARS = 5;

/** [D2] 댓글 최대 글자 수 */
export const COMMENT_MAX_CHARS = 100;

/** [D1] 일기당 사진 수 */
export const MAX_PHOTOS = 3;

/** [D1] 원본 사진 압축 */
export const PHOTO_SIZE = {
  longEdge: 1080,
  jpegQuality: 0.7,
  targetBytes: 200 * 1024,
} as const;

/** [C4, D1] 썸네일: 긴 변 400px, 정사각 중앙 크롭 */
export const THUMB_SIZE = { longEdge: 400 } as const;

/** [A4, G1] 아바타 512×512 */
export const AVATAR_SIZE = 512;

/** [B2, E1, C1, C4, D1] 늦게 쓰기 기간(일) */
export const LATE_WINDOW = {
  sharedOptions: [1, 3, 7] as const,
  sharedDefault: 3,
  solo: 7,
} as const;
export type LateWindowDays = (typeof LATE_WINDOW.sharedOptions)[number];

/** [B2, B3, E1] 초대 코드: 6자리, A~Z·2~9 중 O·I 제외 */
export const INVITE_CODE = {
  length: 6,
  alphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
} as const;

/** [B3] 초대 코드 실패 제한 */
export const CODE_FAIL_LIMIT = { attempts: 10, waitSeconds: 60 } as const;

/** [B4, E2] 대기 요청 만료(일) */
export const REQUEST_EXPIRE_DAYS = 30;

/** [B3] 거절 후 재요청 불가 시간 */
export const REJECT_COOLDOWN_HOURS = 24;

/** [B4] 거절된 요청 표시 기간(일) */
export const REJECT_DISPLAY_DAYS = 7;

/** [A2, G2] PIN 자릿수 */
export const PIN_LEN = 4;

/** [A2] PIN 실패 제한: 5회마다 대기, 30초에서 2배씩, 최대 10분 */
export const PIN_FAIL_LIMIT = {
  attempts: 5,
  baseWaitSeconds: 30,
  multiplier: 2,
  maxWaitSeconds: 10 * 60,
} as const;

/** [G2] 잠금 시점(초). 기본 즉시 */
export const LOCK_DELAY_OPTIONS = [0, 60, 300] as const;
export const LOCK_DELAY_DEFAULT = 0;

/** [D1] 임시저장 주기(ms) */
export const DRAFT_INTERVAL_MS = 5_000;

/** [D2] 댓글 페이지 크기 */
export const COMMENT_PAGE = 20;

/** [F1] 알림 보관 기간(일) */
export const NOTI_RETENTION_DAYS = 30;

/** [F1] 알림 페이지 크기 */
export const NOTI_PAGE = 30;

/** [G3] 저녁 리마인드 기본 시각 */
export const REMINDER_DEFAULT = '21:00';

/** [서버] 고아 사진 정리(시간) */
export const ORPHAN_CLEANUP_HOURS = 24;

/** [서버] 일시정지 방지 핑 주기(일) */
export const KEEPALIVE_DAYS = 3;

/** [공통] 요청 제한 시간(ms) */
export const REQUEST_TIMEOUT_MS = 10_000;

/** [B1] 계정 연결 안내 카드 */
export const LINK_NUDGE = { minEntries: 3, hideDays: 30 } as const;

/** [B2, E1] 커버 색상 키 8종 */
export const COVER_COLORS = [
  'cover_1',
  'cover_2',
  'cover_3',
  'cover_4',
  'cover_5',
  'cover_6',
  'cover_7',
  'cover_8',
] as const;
export type CoverColorKey = (typeof COVER_COLORS)[number];
export const COVER_COLOR_DEFAULT: CoverColorKey = 'cover_1';

/** [D2] 같은 사람 댓글 간격(초) */
export const COMMENT_RATE_SECONDS = 5;

/** [A3] 최소 나이(만) */
export const MIN_AGE = 14;

/** [E1] 주인 장기 미접속 판정(일) */
export const OWNER_INACTIVE_DAYS = 60;

/** [E1] 주인 맡기 요청 대기(일) */
export const OWNER_CLAIM_WAIT_DAYS = 7;

/** [서버] 프로필 없는 익명 계정 삭제(일) */
export const ANON_PURGE_DAYS = 7;

/** [공통] 알림 권한 재요청 간격(일) — screens.md 공통 규칙 '알림 권한 요청' */
export const NOTI_PERMISSION_RETRY_DAYS = 7;

/** [공통] 토스트 표시 시간(ms) — screens.md 공통 규칙 '문구' */
export const TOAST_DURATION_MS = 2_500;

/** [공통] 인앱 배너 표시 시간(ms) */
export const IN_APP_BANNER_MS = 3_000;

/** [공통] 오늘 재계산 주기(ms) — screens.md 공통 규칙 '날짜·시간' */
export const TODAY_RECHECK_MS = 60_000;

/** [A1] 익명 계정 생성 연속 실패 시 문의하기 노출 기준 */
export const ANON_SIGNUP_FAIL_CONTACT = 3;

/** [A4] 아바타 미리보기 지름 */
export const AVATAR_PREVIEW_DIAMETER = 120;

/** [공통] 터치 영역 최소 크기(pt) */
export const MIN_TOUCH = 44;

/** [D1] 본문 연속 줄바꿈 최대 수 */
export const MAX_CONSECUTIVE_NEWLINES = 2;

/** [F1] 탭 배지 표시 최대 수(초과 시 "99+") */
export const BADGE_MAX = 99;

/** [A3] 현재 약관 버전. 개정 시 올리면 A1에서 재동의 */
export const TERMS_VERSION = '2026-11-25';

/** [A3] 온보딩 카드 수 */
export const ONBOARDING_PAGES = 3;

/** [B1] 카드에 보이는 멤버 아바타 수(넘치면 "+N") */
export const HOME_AVATAR_PREVIEW = 4;

/** [B1] 일기장이 이 수 이상이면 검색 아이콘 표시 */
export const HOME_SEARCH_THRESHOLD = 20;

/** [B1] 혼자 쓰기 카드의 최근 감정 아이콘 수 */
export const SOLO_RECENT_EMOTIONS = 7;

/** [B1] 홈 상단 아바타 지름 */
export const HOME_AVATAR_SIZE = 40;

/** [B1] 카드 멤버 아바타 지름 */
export const CARD_AVATAR_SIZE = 24;
