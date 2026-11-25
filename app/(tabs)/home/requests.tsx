/** [B4] 참여 대기: 내가 보낸 요청(대기 중 + 7일 안의 거절·만료) */
import { router, Stack } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { MIN_TOUCH } from '@/constants/policy';
import { errorCopy, fill, ko } from '@/copy/ko';
import { cancelRequest, useInvalidateSharing, useMyJoinRequests, type MyRequest } from '@/features/sharing/api';
import { useToday } from '@/hooks/useToday';
import { confirm } from '@/lib/confirm';
import { deviceTimezone, formatListDate, todayIn } from '@/lib/date';
import { AppError } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

export default function MyRequests() {
  const { colors } = useTheme();
  const toast = useToast();
  const today = useToday();
  const q = useMyJoinRequests();
  const invalidate = useInvalidateSharing();

  const cancel = async (r: MyRequest) => {
    if (!(await confirm({ title: ko.requests.cancelTitle, ok: ko.requests.cancelOk, destructive: true }))) return;
    try {
      await cancelRequest(r.id);
    } catch (e) {
      const code = e instanceof AppError ? e.code : 'network';
      if (code === 'already_member') {
        toast(ko.requests.alreadyApproved);
        await invalidate();
        return router.replace({ pathname: '/home/diary/[id]', params: { id: r.diary_id } });
      }
      toast(errorCopy[code]);
    }
    await invalidate();
  };

  const chip = (s: MyRequest['status']) =>
    s === 'pending' ? ko.requests.pending : s === 'rejected' ? ko.requests.rejected : ko.requests.expired;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: ko.requests.title }} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={q.isLoading ? undefined : <Text style={[styles.empty, { color: colors.textSub }]}>{ko.requests.empty}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.dot, { backgroundColor: colors.cover[item.cover_color] }]} />
            <View style={styles.body}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ color: colors.textSub, fontSize: fontSize.caption }}>
                {fill(ko.requests.requested, { 날짜: formatListDate(todayIn(deviceTimezone(), new Date(item.created_at)), today) })}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: item.status === 'pending' ? colors.primarySoft : colors.locked }]}>
              <Text style={{ color: item.status === 'pending' ? colors.primary : colors.textSub, fontSize: fontSize.caption, fontWeight: '700' }}>
                {chip(item.status)}
              </Text>
            </View>
            {item.status === 'pending' && <Button label={ko.requests.cancel} variant="text" onPress={() => void cancel(item)} />}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: spacing.xl, gap: spacing.sm, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: spacing.xxl * 2, fontSize: fontSize.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, borderWidth: 1, minHeight: MIN_TOUCH + spacing.lg },
  dot: { width: 14, height: 14, borderRadius: 7 },
  body: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.body, fontWeight: '700' },
  chip: { borderRadius: radius.chip, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
