/** [A4] 아바타 이모지 24종 — docs/spec.md '아바타 이모지 24종' */
export const AVATAR_EMOJIS = [
  '👑', '👸', '🦄', '🌸', '🎀', '💖', '🍓', '🧁',
  '🌙', '⭐', '🌈', '🦋', '🐰', '🐱', '🐻', '🍑',
  '🌷', '🫧', '💎', '🪄', '🏰', '🍰', '🩰', '🐣',
] as const;
export type AvatarEmoji = (typeof AVATAR_EMOJIS)[number];

/** 기본 아바타(탈퇴한 사용자는 흐린 표시로 같은 이모지 사용) */
export const AVATAR_EMOJI_DEFAULT: AvatarEmoji = '👑';

/** [A4] 이모지 그리드 열 수(4×6) */
export const AVATAR_GRID_COLUMNS = 6;
