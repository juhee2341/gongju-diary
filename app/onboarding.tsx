/** [A3] 온보딩: 소개 카드 3장 → 약관 동의 → A4 */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { MIN_TOUCH, ONBOARDING_PAGES, TERMS_VERSION } from '@/constants/policy';
import { fill, ko } from '@/copy/ko';
import { TermsSheet } from '@/features/auth/TermsSheet';
import { deviceStore } from '@/lib/device';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

const ART = ['📖', '🔒', '🎀'] as const;

export default function Onboarding() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const list = useRef<FlatList>(null);
  const [page, setPage] = useState(0);
  const [termsOpen, setTermsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const last = ONBOARDING_PAGES - 1;

  const goTo = (i: number) => {
    list.current?.scrollToIndex({ index: i, animated: true });
    setPage(i);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const agree = async () => {
    setSaving(true);
    try {
      await deviceStore.setTermsConsent({ version: TERMS_VERSION, agreedAt: new Date().toISOString() });
      await deviceStore.setOnboardingDone();
      setTermsOpen(false);
      router.replace('/profile/new');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        {page < last && (
          <Pressable accessibilityRole="button" onPress={() => goTo(last)} style={styles.skip}>
            <Text style={{ color: colors.textSub, fontSize: fontSize.body }}>{ko.onboarding.skip}</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        ref={list}
        data={ko.onboarding.pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index }) => (
          <View
            style={[styles.page, { width }]}
            accessible
            accessibilityLabel={`${fill(ko.onboarding.pageLabel, { N: index + 1 })}. ${item.title}. ${item.body}`}
          >
            <View style={[styles.art, { backgroundColor: colors.primarySoft }]}>
              <Text style={styles.artEmoji}>{ART[index]}</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.body, { color: colors.textSub }]}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {ko.onboarding.pages.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === page ? colors.primary : colors.border }]} />
        ))}
      </View>

      <View style={styles.bottom}>
        <Button
          label={page < last ? ko.onboarding.next : ko.onboarding.start}
          onPress={() => (page < last ? goTo(page + 1) : setTermsOpen(true))}
        />
        {page === last && (
          // 계정 연결(구글/애플)은 11단계에서 연결. 기술 검증 1·2번 결과에 따라 구현
          <Button label={ko.onboarding.restoreAccount} variant="text" onPress={() => toast(ko.onboarding.restoreComingSoon)} />
        )}
      </View>

      <TermsSheet visible={termsOpen} submitting={saving} onSubmit={agree} onClose={() => setTermsOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { minHeight: MIN_TOUCH, alignItems: 'flex-end', paddingHorizontal: spacing.lg },
  skip: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, gap: spacing.lg },
  art: { width: 200, height: 200, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  artEmoji: { fontSize: fontSize.display * 2.5 },
  title: { fontSize: fontSize.title + 2, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: fontSize.body, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bottom: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm, minHeight: 120 },
});
