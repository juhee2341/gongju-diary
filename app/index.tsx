/** [A1] 스플래시 */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { CONTACT_EMAIL, STORE_URL } from '@/constants/app';
import { ANON_SIGNUP_FAIL_CONTACT } from '@/constants/policy';
import { errorCopy, ko } from '@/copy/ko';
import { bootstrap, type BootResult } from '@/features/auth/bootstrap';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, spacing } from '@/theme/tokens';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; showContact: boolean }
  | { kind: 'forceUpdate' }
  | { kind: 'suspended' };

export default function Splash() {
  const { colors } = useTheme();
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const failures = useRef(0);

  const run = useCallback(async () => {
    setState({ kind: 'loading' });
    let result: BootResult;
    try {
      result = await bootstrap();
    } catch {
      result = { kind: 'error', reason: 'network' };
    }
    switch (result.kind) {
      case 'route':
        failures.current = 0;
        if (result.reconsent) router.replace('/reconsent');
        else router.replace(result.to);
        return;
      case 'forceUpdate':
        setState({ kind: 'forceUpdate' });
        return;
      case 'suspended':
        setState({ kind: 'suspended' });
        return;
      case 'error': {
        failures.current += 1;
        const message = result.reason === 'firstRunOffline' ? ko.splash.firstRunOffline : errorCopy[result.reason];
        setState({ kind: 'error', message, showContact: failures.current >= ANON_SIGNUP_FAIL_CONTACT });
      }
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const contact = () => CONTACT_EMAIL && Linking.openURL(`mailto:${CONTACT_EMAIL}`);
  const onPrimary = { color: colors.onPrimary };

  return (
    <View style={[styles.root, { backgroundColor: colors.primary }]}>
      <View style={styles.center}>
        <Text style={styles.logo} accessibilityElementsHidden>
          👑
        </Text>
        <Text style={[styles.name, onPrimary]} accessibilityRole="header">
          {ko.appName}
        </Text>

        {!isSupabaseConfigured && __DEV__ && (
          <Text style={[styles.message, onPrimary]}>{ko.dev.supabaseMissing}</Text>
        )}

        {state.kind === 'error' && (
          <View style={styles.block}>
            <Text style={[styles.message, onPrimary]}>{state.message}</Text>
            <Button label={ko.common.retry} variant="soft" onPress={run} />
            {state.showContact && <Button label={ko.common.contact} variant="text" onPress={contact} />}
          </View>
        )}

        {state.kind === 'forceUpdate' && (
          <View style={styles.block}>
            <Text style={[styles.message, onPrimary]}>{ko.splash.forceUpdateTitle}</Text>
            <Button
              label={ko.splash.forceUpdateButton}
              variant="soft"
              onPress={() => {
                const url = Platform.OS === 'ios' ? STORE_URL.ios : STORE_URL.android;
                if (url) void Linking.openURL(url);
              }}
            />
          </View>
        )}

        {state.kind === 'suspended' && (
          <View style={styles.block}>
            <Text style={[styles.message, onPrimary]}>{errorCopy.suspended}</Text>
            <Button label={ko.common.contact} variant="soft" onPress={contact} />
          </View>
        )}
      </View>

      {state.kind === 'loading' && (
        <View style={styles.dots} accessibilityLabel={ko.splash.loadingLabel}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: colors.onPrimary }]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  logo: { fontSize: fontSize.display * 2 },
  name: { fontSize: fontSize.display, fontWeight: '800' },
  block: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  message: { fontSize: fontSize.body, textAlign: 'center' },
  dots: { position: 'absolute', bottom: spacing.xxl * 2, flexDirection: 'row', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, opacity: 0.8 },
});
