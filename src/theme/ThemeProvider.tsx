/** [G1] 화면 모드(시스템/라이트/다크)와 역할 토큰 제공 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { deviceStore, type ThemeMode } from '@/lib/device';
import { palettes, type Palette, type Scheme } from './tokens';

type ThemeValue = {
  colors: Palette;
  scheme: Scheme;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    deviceStore.getThemeMode().then(setModeState);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    void deviceStore.setThemeMode(m);
  }, []);

  const scheme: Scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const value = useMemo(() => ({ colors: palettes[scheme], scheme, mode, setMode }), [scheme, mode, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme must be used inside ThemeProvider');
  return v;
}
