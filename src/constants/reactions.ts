/** 리액션 6종 — docs/spec.md '리액션 6종'. 라벨은 copy/ko.ts */
export const REACTIONS = ['heart', 'crown', 'laugh', 'hug', 'wow', 'sparkle'] as const;
export type Reaction = (typeof REACTIONS)[number];

/** 아이콘 디자인 확정 전 임시 이모지 */
export const REACTION_ICONS: Record<Reaction, string> = {
  heart: '❤️',
  crown: '👑',
  laugh: '😆',
  hug: '🤗',
  wow: '🤩',
  sparkle: '✨',
};
