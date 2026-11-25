/**
 * [B3] 초대 코드로 참여
 * 6칸 코드 입력(대문자 자동 변환, 붙여넣기 시 6칸 분배) → 찾기 → 미리보기 → 참여 요청 → B4
 * params: code(딥링크 gongju://join/{코드})
 * TODO(8단계 #7) 처음이면 알림 권한 요청
 * TODO(11단계 #10) 첫 실행 딥링크: A1~A4를 마친 뒤 B3로 이어서 열기
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { INVITE_CODE, MIN_TOUCH } from '@/constants/policy';
import { errorCopy, fill, ko } from '@/copy/ko';
import { MemberAvatar } from '@/features/diary/MemberAvatar';
import { cancelRequest, findDiaryByCode, requestJoin, useInvalidateSharing, type DiaryPreview } from '@/features/sharing/api';
import { normalizeCode } from '@/features/sharing/code';
import { useOnline } from '@/hooks/useOnline';
import { AppError } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

export default function JoinDiary() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const invalidate = useInvalidateSharing();
  const input = useRef<TextInputInstance>(null);
  const [code, setCode] = useState(normalizeCode(params.code ?? ''));
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DiaryPreview | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const lockedLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const find = async (value = code) => {
    if (!online) return toast(ko.common.offline);
    setBusy(true);
    try {
      const p = await findDiaryByCode(value);
      if (p.status === 'code_locked') {
        setLockedUntil(Date.now() + (p.locked_seconds ?? 0) * 1000);
        setNow(Date.now());
        setPreview(null);
      } else {
        setPreview(p);
      }
    } catch (e) {
      toast(errorCopy[e instanceof AppError ? e.code : 'network']);
    } finally {
      setBusy(false);
    }
  };

  // 딥링크로 6자리가 들어오면 바로 찾기
  useEffect(() => {
    if (params.code && normalizeCode(params.code).length === INVITE_CODE.length) void find(normalizeCode(params.code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    setBusy(true);
    try {
      await requestJoin(code);
      await invalidate();
      router.replace('/home/requests');
    } catch (e) {
      const c = e instanceof AppError ? e.code : 'network';
      toast(errorCopy[c]);
      void find();
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!preview?.request_id) return;
    setBusy(true);
    try {
      await cancelRequest(preview.request_id);
      await invalidate();
      await find();
    } catch (e) {
      toast(errorCopy[e instanceof AppError ? e.code : 'network']);
    } finally {
      setBusy(false);
    }
  };

  const status = preview?.status;
  const errorText =
    lockedLeft > 0
      ? fill(errorCopy.code_locked, { N: lockedLeft })
      : status && status !== 'ok'
        ? errorCopy[status === 'code_locked' ? 'code_invalid' : status]
        : null;
  const found = preview && preview.diary_id && status !== 'code_invalid';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={ko.common.close} onPress={() => router.back()} style={styles.barBtn}>
          <Text style={{ fontSize: fontSize.title, color: colors.text }}>✕</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {ko.join.title}
        </Text>
        <View style={styles.barBtn} />
      </View>

      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={{ color: colors.textSub, fontSize: fontSize.body }}>{ko.join.guide}</Text>

          <Pressable onPress={() => input.current?.focus()} accessibilityLabel={ko.join.codeLabel} style={styles.cells}>
            {Array.from({ length: INVITE_CODE.length }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.cell,
                  {
                    borderColor: errorText ? colors.danger : i === code.length ? colors.primary : colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text style={[styles.cellText, { color: colors.text }]}>{code[i] ?? ''}</Text>
              </View>
            ))}
            <TextInput
              ref={input}
              value={code}
              onChangeText={(t) => {
                setCode(normalizeCode(t));
                setPreview(null);
              }}
              editable={lockedLeft === 0}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus={!params.code}
              maxLength={INVITE_CODE.length + 4}
              accessibilityLabel={ko.join.codeLabel}
              style={styles.hiddenInput}
            />
          </Pressable>
          {errorText && <Text style={[styles.error, { color: colors.danger }]}>{errorText}</Text>}

          {!found && (
            <Button
              label={ko.join.find}
              onPress={() => void find()}
              disabled={code.length !== INVITE_CODE.length || lockedLeft > 0}
              loading={busy}
              blocked={!online}
              onBlockedPress={() => toast(ko.common.offline)}
            />
          )}

          {found && (
            <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.cover, { backgroundColor: colors.cover[preview.cover_color ?? 'cover_1'] }]} />
              <View style={styles.previewBody}>
                <Text style={[styles.diaryName, { color: colors.text }]}>{preview.name}</Text>
                <View style={styles.ownerRow}>
                  <MemberAvatar
                    size={24}
                    member={{
                      user_id: '',
                      nickname: preview.owner_nickname ?? '',
                      avatar_type: preview.owner_avatar_type ?? 'emoji',
                      avatar_emoji: preview.owner_avatar_emoji ?? '👑',
                      avatar_path: preview.owner_avatar_path ?? null,
                      role: 'owner',
                      joined_date: '',
                    }}
                  />
                  <Text style={{ color: colors.textSub }}>{fill(ko.join.owner, { 닉네임: preview.owner_nickname ?? '' })}</Text>
                </View>
                <Text style={{ color: colors.textSub }}>
                  {fill(ko.join.members, { N: preview.member_count ?? 0, MAX: preview.max_members ?? 0 })}
                </Text>
              </View>
            </View>
          )}

          {found && status === 'ok' && <Button label={ko.join.send} onPress={() => void send()} loading={busy} />}
          {found && status === 'already_member' && (
            <Button
              label={ko.join.goDiary}
              onPress={() => {
                router.dismiss();
                router.push({ pathname: '/home/diary/[id]', params: { id: preview.diary_id! } });
              }}
            />
          )}
          {found && status === 'request_pending' && (
            <Button label={ko.join.cancelRequest} variant="soft" onPress={() => void cancel()} loading={busy} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const CELL = MIN_TOUCH + spacing.sm;

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
  barBtn: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: fontSize.body + 2, fontWeight: '700' },
  content: { padding: spacing.xl, gap: spacing.lg },
  cells: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { width: CELL, height: CELL + spacing.sm, borderWidth: 2, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: fontSize.title + 4, fontWeight: '800' },
  hiddenInput: { position: 'absolute', opacity: 0.011, width: '100%', height: '100%' },
  error: { fontSize: fontSize.caption, fontWeight: '600' },
  preview: { flexDirection: 'row', borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  cover: { width: spacing.md },
  previewBody: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  diaryName: { fontSize: fontSize.title, fontWeight: '800' },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
