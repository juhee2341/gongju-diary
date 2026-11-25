/**
 * 색 역할 토큰 — docs/spec.md '디자인 방향'.
 * 디자인 확정 전 임시 핑크 테마 값. 화면은 역할 이름만 쓴다.
 * 명도 대비: primary 위 onPrimary, background/surface 위 text 모두 4.5:1 이상으로 잡았다.
 */
import type { CoverColorKey } from '@/constants/policy';
import type { Emotion } from '@/constants/emotions';

export type ColorRole =
  | 'primary'
  | 'onPrimary'
  | 'primarySoft'
  | 'background'
  | 'surface'
  | 'text'
  | 'textSub'
  | 'accent'
  | 'locked'
  | 'danger'
  | 'border';

export type Palette = Record<ColorRole, string> & {
  cover: Record<CoverColorKey, string>;
  emotion: Record<Emotion, string>;
};

const light: Palette = {
  primary: '#C2185B',
  onPrimary: '#FFFFFF',
  primarySoft: '#FCE4EC',
  background: '#FFF7FA',
  surface: '#FFFFFF',
  text: '#2B1B22',
  textSub: '#6E5560',
  accent: '#B8860B',
  locked: '#EADDE3',
  danger: '#C62828',
  border: '#F0D9E2',
  cover: {
    cover_1: '#F8BBD0',
    cover_2: '#E1BEE7',
    cover_3: '#BBDEFB',
    cover_4: '#C8E6C9',
    cover_5: '#FFF9C4',
    cover_6: '#FFE0B2',
    cover_7: '#D7CCC8',
    cover_8: '#CFD8DC',
  },
  emotion: {
    happy: '#FFB300',
    excited: '#EC407A',
    proud: '#8E24AA',
    love: '#E53935',
    calm: '#43A047',
    soso: '#90A4AE',
    tired: '#5C6BC0',
    sad: '#1E88E5',
    angry: '#F4511E',
    worried: '#8D6E63',
  },
};

const dark: Palette = {
  primary: '#F48FB1',
  onPrimary: '#2B0A17',
  primarySoft: '#4A2233',
  background: '#1A1215',
  surface: '#251A1F',
  text: '#F7E9EE',
  textSub: '#C4AAB5',
  accent: '#FFD54F',
  locked: '#3A2C32',
  danger: '#EF9A9A',
  border: '#3D2A33',
  cover: {
    cover_1: '#8E3B5A',
    cover_2: '#6A4A7A',
    cover_3: '#3F5F82',
    cover_4: '#456B48',
    cover_5: '#7A7440',
    cover_6: '#8A6236',
    cover_7: '#5E514C',
    cover_8: '#4B5A62',
  },
  emotion: {
    happy: '#FFCA28',
    excited: '#F06292',
    proud: '#BA68C8',
    love: '#EF5350',
    calm: '#66BB6A',
    soso: '#B0BEC5',
    tired: '#7986CB',
    sad: '#42A5F5',
    angry: '#FF7043',
    worried: '#A1887F',
  },
};

export const palettes = { light, dark } as const;
export type Scheme = keyof typeof palettes;

/** 모서리: 카드 16, 버튼 24 */
export const radius = { card: 16, button: 24, chip: 12, full: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const fontSize = { caption: 12, body: 15, title: 20, display: 32 } as const;
