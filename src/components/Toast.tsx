/** [공통] 토스트: 화면 하단, TOAST_DURATION_MS 표시, 동시에 1개 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOAST_DURATION_MS } from '@/constants/policy';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

type ToastAction = { label: string; onPress: () => void };
type ToastState = { message: string; action?: ToastAction } | null;
type ShowToast = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback<ShowToast>((message, action) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, action });
    timer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <View
          pointerEvents="box-none"
          style={[styles.wrap, { bottom: insets.bottom + spacing.xxl * 2 }]}
          accessibilityLiveRegion="polite"
        >
          <View style={[styles.toast, { backgroundColor: colors.text }]}>
            <Text style={[styles.text, { color: colors.background }]}>{toast.message}</Text>
            {toast.action && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  toast.action?.onPress();
                  setToast(null);
                }}
                hitSlop={spacing.md}
              >
                <Text style={[styles.action, { color: colors.primarySoft }]}>{toast.action.label}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
  },
  text: { fontSize: fontSize.body, flexShrink: 1 },
  action: { fontSize: fontSize.body, fontWeight: '700' },
});
