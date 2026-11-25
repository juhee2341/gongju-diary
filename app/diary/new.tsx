/**
 * [B2] 일기장 만들기
 * TODO(8단계) 함께 쓰기를 처음 만들면 공통 규칙의 알림 권한 요청
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import {
  COVER_COLOR_DEFAULT,
  DIARY_NAME_LEN,
  LATE_WINDOW,
  MIN_TOUCH,
  type CoverColorKey,
  type LateWindowDays,
} from '@/constants/policy';
import { errorCopy, ko } from '@/copy/ko';
import { containsBannedWord, useBannedWords } from '@/features/auth/useAppConfig';
import { useCreateDiary, type MyDiary } from '@/features/diary/api';
import { CoverPicker, CoverPreview, DiaryNameInput, LateWindowPicker, ModeCards } from '@/features/diary/DiaryFormFields';
import { InviteSheet } from '@/features/diary/InviteSheet';
import { useOnline } from '@/hooks/useOnline';
import { AppError, rpc } from '@/lib/supabase';
import { graphemeLength, normalizeSingleLine } from '@/lib/text';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, spacing } from '@/theme/tokens';

export default function NewDiary() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const banned = useBannedWords();
  const create = useCreateDiary();

  const [name, setName] = useState('');
  const [cover, setCover] = useState<CoverColorKey>(COVER_COLOR_DEFAULT);
  const [isShared, setIsShared] = useState<boolean | null>(null);
  const [days, setDays] = useState<LateWindowDays>(LATE_WINDOW.sharedDefault);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);

  const trimmed = normalizeSingleLine(name);
  const hasBanned = containsBannedWord(trimmed, banned.data ?? []);
  const count = graphemeLength(trimmed);
  const canSubmit = count >= DIARY_NAME_LEN.min && count <= DIARY_NAME_LEN.max && isShared !== null && !hasBanned;

  const goToDiary = (id: string) => {
    router.dismiss();
    router.push({ pathname: '/home/diary/[id]', params: { id } });
  };

  const submit = async () => {
    if (isShared === null) return;
    try {
      const id = await create.mutateAsync({ name: trimmed, coverColor: cover, isShared, lateWindowDays: days });
      if (!isShared) return goToDiary(id);
      const rows = await rpc<MyDiary[]>('my_diaries');
      const code = rows.find((d) => d.id === id)?.invite_code;
      if (code) setCreated({ id, code });
      else goToDiary(id);
    } catch (e) {
      // 실패: 토스트 + 입력 유지
      toast(errorCopy[e instanceof AppError ? e.code : 'network']);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={ko.common.close} onPress={() => router.back()} style={styles.close}>
          <Text style={{ fontSize: fontSize.title, color: colors.text }}>✕</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {ko.create.title}
        </Text>
        <View style={styles.close} />
      </View>

      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <CoverPreview name={trimmed} cover={cover} />
          <DiaryNameInput value={name} onChange={setName} banned={hasBanned} />
          <CoverPicker value={cover} onChange={setCover} />
          <ModeCards isShared={isShared} onChange={setIsShared} />
          {isShared && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>{ko.diary.lateWindow}</Text>
              <LateWindowPicker value={days} onChange={setDays} />
            </View>
          )}
        </ScrollView>

        <View style={styles.bottom}>
          <Button
            label={ko.create.submit}
            onPress={submit}
            disabled={!canSubmit}
            loading={create.isPending}
            blocked={!online}
            onBlockedPress={() => toast(ko.common.offline)}
          />
        </View>
      </KeyboardAvoidingView>

      <InviteSheet
        code={created?.code ?? null}
        onClose={() => {
          const id = created?.id;
          setCreated(null);
          if (id) goToDiary(id);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
  close: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: fontSize.body + 2, fontWeight: '700' },
  content: { padding: spacing.xl, gap: spacing.xl },
  section: { gap: spacing.sm },
  label: { fontSize: fontSize.body, fontWeight: '700' },
  bottom: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
});
