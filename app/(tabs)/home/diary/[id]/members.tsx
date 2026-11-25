/**
 * [E2] 멤버 관리
 * (주인) 참여 요청 섹션: 승인/거절, "이전 멤버" 칩 / 멤버 목록(아바타 순서 규칙) / (주인) 내보내기
 * TODO(10단계 #9) 차단한 사용자 승인 시 "차단을 풀고 승인할까요?"
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { SheetRow } from '@/components/SheetRow';
import { useToast } from '@/components/Toast';
import { DAY_AVATAR_SIZE, MAX_MEMBERS, MIN_TOUCH } from '@/constants/policy';
import { errorCopy, fill, ko } from '@/copy/ko';
import { useDiary, type MemberPreview } from '@/features/diary/api';
import { MemberAvatar } from '@/features/diary/MemberAvatar';
import { leaveMissingDiary, useMissingDiary } from '@/features/diary/useMissingDiary';
import { decideRequest, removeMember, useIncomingRequests, useInvalidateSharing } from '@/features/sharing/api';
import { useMyUserId } from '@/hooks/useMyUserId';
import { useToday } from '@/hooks/useToday';
import { confirm } from '@/lib/confirm';
import { deviceTimezone, formatListDate, todayIn } from '@/lib/date';
import { AppError } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

export default function Members() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const today = useToday();
  const myId = useMyUserId();
  const { diary, missing, refetch, isRefetching } = useDiary(id);
  useMissingDiary(missing);
  const isOwner = diary?.role === 'owner';
  const incoming = useIncomingRequests(id, isOwner);
  const invalidate = useInvalidateSharing();
  const [busy, setBusy] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<MemberPreview | null>(null);

  if (!diary) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const full = diary.member_count >= MAX_MEMBERS;
  const fail = (e: unknown) => {
    const code = e instanceof AppError ? e.code : 'network';
    if (code === 'not_member') return leaveMissingDiary(toast);
    toast(code === 'request_closed' ? ko.members.canceledRequest : errorCopy[code]);
  };

  const decide = async (requestId: string, approve: boolean) => {
    setBusy(requestId);
    try {
      await decideRequest(requestId, approve);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
      await invalidate();
    }
  };

  const remove = async (m: MemberPreview) => {
    setMenuFor(null);
    const ok = await confirm({
      title: fill(ko.members.removeTitle, { 닉네임: m.nickname }),
      message: fill(ko.members.removeDesc, { 닉네임: m.nickname }),
      ok: ko.members.remove,
      destructive: true,
    });
    if (!ok) return;
    setBusy(m.user_id);
    try {
      await removeMember(id, m.user_id);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
      await invalidate();
    }
  };

  const fmt = (iso: string) => formatListDate(todayIn(deviceTimezone(), new Date(iso)), today);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching || incoming.isRefetching}
          onRefresh={() => {
            void refetch();
            void incoming.refetch();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <Stack.Screen options={{ title: ko.members.title }} />

      {isOwner && (incoming.data?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{fill(ko.members.requestsSection, { N: incoming.data!.length })}</Text>
          {full && <Text style={{ color: colors.danger, fontSize: fontSize.caption }}>{ko.members.full}</Text>}
          {incoming.data!.map((r) => (
            <View key={r.id} style={[styles.row, { backgroundColor: colors.surface }]}>
              <MemberAvatar
                size={DAY_AVATAR_SIZE}
                member={{ user_id: r.user_id, nickname: r.nickname, avatar_type: r.avatar_type, avatar_emoji: r.avatar_emoji, avatar_path: r.avatar_path, role: 'member', joined_date: '' }}
              />
              <View style={styles.body}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {r.nickname}
                </Text>
                <View style={styles.chips}>
                  <Text style={{ color: colors.textSub, fontSize: fontSize.caption }}>{fill(ko.members.requested, { 날짜: fmt(r.created_at) })}</Text>
                  {r.former_member && <Text style={[styles.chip, { color: colors.textSub, borderColor: colors.border }]}>{ko.members.formerMember}</Text>}
                  {r.blocked && <Text style={[styles.chip, { color: colors.danger, borderColor: colors.danger }]}>{ko.members.blockedUser}</Text>}
                </View>
              </View>
              <Button label={ko.members.reject} variant="text" onPress={() => void decide(r.id, false)} disabled={busy === r.id} />
              <Button label={ko.members.approve} onPress={() => void decide(r.id, true)} disabled={full} loading={busy === r.id} style={styles.approve} />
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{fill(ko.members.membersSection, { N: diary.member_count, MAX: MAX_MEMBERS })}</Text>
        {diary.members.map((m) => (
          <View key={m.user_id} style={[styles.row, { backgroundColor: colors.surface }]}>
            <MemberAvatar member={m} size={DAY_AVATAR_SIZE} />
            <View style={styles.body}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {m.nickname} {m.role === 'owner' ? '👑' : ''}
              </Text>
              <Text style={{ color: colors.textSub, fontSize: fontSize.caption }}>{fill(ko.members.joined, { 날짜: formatListDate(m.joined_date, today) })}</Text>
            </View>
            {isOwner && m.user_id !== myId && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fill(ko.members.more, { 닉네임: m.nickname })}
                onPress={() => setMenuFor(m)}
                disabled={busy === m.user_id}
                style={styles.more}
              >
                <Text style={{ fontSize: fontSize.title, color: colors.text }}>⋯</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.nickname}>
        {menuFor && <SheetRow label={ko.members.remove} danger onPress={() => void remove(menuFor)} />}
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.body, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, minHeight: MIN_TOUCH + spacing.lg },
  body: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.body, fontWeight: '700' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: spacing.xs, fontSize: 11 },
  approve: { paddingHorizontal: spacing.lg },
  more: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
