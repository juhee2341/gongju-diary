/**
 * [E1] 일기장 설정
 * TODO(5단계) "멤버 {N}/10" → E2, 대기 요청 알림 점
 * TODO(9단계) 일기장 나가기 → E3, 주인 맡기 요청(owner_claims)
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { SheetRow } from '@/components/SheetRow';
import { useToast } from '@/components/Toast';
import {
  DIARY_NAME_LEN,
  LATE_WINDOW,
  MAX_MEMBERS,
  type CoverColorKey,
  type LateWindowDays,
} from '@/constants/policy';
import { errorCopy, fill, ko } from '@/copy/ko';
import { containsBannedWord, useBannedWords } from '@/features/auth/useAppConfig';
import {
  useConvertToShared,
  useDiary,
  useRegenerateCode,
  useSetLateWindow,
  useSetMemberFlags,
  useUpdateDiary,
} from '@/features/diary/api';
import { CoverPicker, CoverPreview, DiaryNameInput, LateWindowPicker } from '@/features/diary/DiaryFormFields';
import { copyInviteCode, shareInvite } from '@/features/diary/invite';
import { InviteCode, InviteSheet } from '@/features/diary/InviteSheet';
import { leaveMissingDiary, useMissingDiary } from '@/features/diary/useMissingDiary';
import { useMyUserId } from '@/hooks/useMyUserId';
import { useOnline } from '@/hooks/useOnline';
import { confirm } from '@/lib/confirm';
import { formatFullDate } from '@/lib/date';
import { AppError } from '@/lib/supabase';
import { graphemeLength, normalizeSingleLine } from '@/lib/text';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

export default function DiarySettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const userId = useMyUserId();
  const banned = useBannedWords();
  const { diary, missing } = useDiary(id);
  useMissingDiary(missing);

  const updateDiary = useUpdateDiary(id);
  const setLateWindow = useSetLateWindow(id);
  const regenerate = useRegenerateCode(id);
  const convert = useConvertToShared(id);
  const flags = useSetMemberFlags();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCover, setEditCover] = useState<CoverColorKey>('cover_1');
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertDays, setConvertDays] = useState<LateWindowDays>(LATE_WINDOW.sharedDefault);
  const [shareCode, setShareCode] = useState<string | null>(null);

  if (!diary) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const isOwner = diary.role === 'owner';
  const owner = diary.members.find((m) => m.role === 'owner');

  const fail = (e: unknown) => {
    const code = e instanceof AppError ? e.code : 'network';
    if (code === 'not_member') return leaveMissingDiary(toast);
    toast(errorCopy[code]);
  };
  const guardOnline = () => {
    if (!online) toast(ko.common.offline);
    return online;
  };

  // 편집 바텀시트
  const openEdit = () => {
    setEditName(diary.name);
    setEditCover(diary.cover_color);
    setEditOpen(true);
  };
  const editTrimmed = normalizeSingleLine(editName);
  const editBanned = containsBannedWord(editTrimmed, banned.data ?? []);
  const editCount = graphemeLength(editTrimmed);
  const canSave = editCount >= DIARY_NAME_LEN.min && editCount <= DIARY_NAME_LEN.max && !editBanned;
  const saveEdit = async () => {
    if (!guardOnline()) return;
    try {
      await updateDiary.mutateAsync({ name: editTrimmed, coverColor: editCover });
      setEditOpen(false);
    } catch (e) {
      fail(e);
    }
  };

  // 늦게 쓰기 기간: 줄이면/늘리면 각각 확인창
  const changeLateWindow = async (days: LateWindowDays) => {
    if (days === diary.late_window_days || !guardOnline()) return;
    const shrinking = days < diary.late_window_days;
    const ok = await confirm({
      title: shrinking ? ko.diarySettings.shrinkTitle : ko.diarySettings.growTitle,
      message: shrinking ? ko.diarySettings.shrinkDesc : ko.diarySettings.growDesc,
      ok: ko.diarySettings.change,
    });
    if (!ok) return;
    try {
      await setLateWindow.mutateAsync(days);
    } catch (e) {
      fail(e);
    }
  };

  const regenerateCode = async () => {
    if (!guardOnline()) return;
    const ok = await confirm({
      title: ko.invite.regenerateTitle,
      message: ko.invite.regenerateDesc,
      ok: ko.invite.regenerateOk,
      destructive: true,
    });
    if (!ok) return;
    try {
      await regenerate.mutateAsync();
    } catch (e) {
      fail(e);
    }
  };

  const submitConvert = async () => {
    if (!guardOnline()) return;
    const ok = await confirm({ title: ko.diarySettings.convertTitle, message: ko.diarySettings.convertDesc, ok: ko.diarySettings.convertOk });
    if (!ok) return;
    try {
      const code = await convert.mutateAsync(convertDays);
      setConvertOpen(false);
      setShareCode(code);
    } catch (e) {
      fail(e);
    }
  };

  const toggleNotify = async (on: boolean) => {
    if (!userId || !guardOnline()) return;
    try {
      await flags.mutateAsync({ diaryId: diary.id, userId, muted: !on });
    } catch (e) {
      fail(e);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <CoverPreview
        name={diary.name}
        cover={diary.cover_color}
        right={isOwner ? <Button label={ko.diarySettings.edit} variant="soft" onPress={openEdit} /> : undefined}
      />

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <SheetRow label={ko.diarySettings.mode} value={diary.is_shared ? ko.diary.shared : ko.diary.solo} />
        <SheetRow label={ko.diarySettings.createdDate} value={formatFullDate(diary.created_date)} />
        <SheetRow label={ko.diarySettings.owner} value={owner?.nickname ?? ko.common.leftAuthor} />
      </View>

      {diary.is_shared && (
        <>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{ko.diary.lateWindow}</Text>
            <LateWindowPicker value={diary.late_window_days} onChange={changeLateWindow} disabled={!isOwner || setLateWindow.isPending} />
            {!isOwner && <Text style={[styles.hint, { color: colors.textSub }]}>{ko.diarySettings.readOnly}</Text>}
          </View>

          {diary.invite_code && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{ko.diarySettings.inviteCode}</Text>
              <InviteCode code={diary.invite_code} />
              <View style={styles.row}>
                <Button
                  label={ko.invite.copyShort}
                  variant="soft"
                  style={styles.flex}
                  onPress={async () => {
                    await copyInviteCode(diary.invite_code!);
                    toast(ko.invite.copied);
                  }}
                />
                <Button label={ko.invite.share} style={styles.flex} onPress={() => void shareInvite(diary.invite_code!)} />
              </View>
              {isOwner && (
                <Button label={ko.invite.regenerate} variant="text" loading={regenerate.isPending} onPress={regenerateCode} />
              )}
            </View>
          )}
        </>
      )}

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <SheetRow
          label={fill(ko.diarySettings.members, { N: diary.member_count, MAX: MAX_MEMBERS })}
          dot={isOwner && diary.pending_requests > 0}
          value="›"
          onPress={() => toast(ko.diarySettings.membersComingSoon)}
        />
        {!diary.is_shared && isOwner && (
          <SheetRow label={ko.diarySettings.convert} value="›" onPress={() => setConvertOpen(true)} />
        )}
        <SheetRow
          label={ko.diarySettings.notify}
          right={
            <Switch
              value={!diary.muted}
              onValueChange={(v) => void toggleNotify(v)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={diary.muted ? colors.surface : colors.onPrimary}
              accessibilityLabel={ko.diarySettings.notify}
            />
          }
        />
      </View>

      <SheetRow label={ko.diarySettings.leave} danger onPress={() => toast(ko.diarySettings.leaveComingSoon)} />

      <BottomSheet visible={editOpen} onClose={() => setEditOpen(false)} title={ko.diarySettings.editTitle}>
        <CoverPreview name={editTrimmed} cover={editCover} />
        <DiaryNameInput value={editName} onChange={setEditName} banned={editBanned} />
        <CoverPicker value={editCover} onChange={setEditCover} />
        <Button label={ko.diarySettings.save} onPress={saveEdit} disabled={!canSave} loading={updateDiary.isPending} />
      </BottomSheet>

      <BottomSheet visible={convertOpen} onClose={() => setConvertOpen(false)} title={ko.diarySettings.convert}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{ko.diary.lateWindow}</Text>
        <LateWindowPicker value={convertDays} onChange={setConvertDays} />
        <Button label={ko.diarySettings.convertOk} onPress={submitConvert} loading={convert.isPending} />
      </BottomSheet>

      <InviteSheet code={shareCode} onClose={() => setShareCode(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg },
  card: { borderRadius: radius.card, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  cardTitle: { fontSize: fontSize.body, fontWeight: '700', marginTop: spacing.sm },
  hint: { fontSize: fontSize.caption, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
