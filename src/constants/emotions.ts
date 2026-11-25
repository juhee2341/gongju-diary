/** 감정 10종 — docs/spec.md '감정 10종'. 라벨은 copy/ko.ts, 색은 theme/tokens.ts */
export const EMOTIONS = [
  'happy',
  'excited',
  'proud',
  'love',
  'calm',
  'soso',
  'tired',
  'sad',
  'angry',
  'worried',
] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** 아이콘 디자인 확정 전 임시 이모지 */
export const EMOTION_ICONS: Record<Emotion, string> = {
  happy: '😊',
  excited: '😍',
  proud: '🏆',
  love: '💗',
  calm: '🍵',
  soso: '☁️',
  tired: '🌙',
  sad: '💧',
  angry: '🔥',
  worried: '🧶',
};
