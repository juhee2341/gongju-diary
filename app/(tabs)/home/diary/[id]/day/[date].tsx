/**
 * [C4] 하루 모아보기
 * 배너(내가 안 썼고 작성 가능) → 내 카드 → 멤버 카드(열림/잠김) → "아직 안 쓴 공주들"
 * 카드 순서: 나 → 주인 → 참여순(my_diaries members 순서)
 */
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { EMOTION_ICONS } from '@/constants/emotions';
import { CARD_AVATAR_SIZE, DAY_AVATAR_SIZE, DAY_CARD_LINES, MIN_TOUCH, UNLOCK_DURATION_MS, UNLOCK_STAGGER_MS } from '@/constants/policy';
import { emotionLabels, fill, ko } from '@/copy/ko';
import { indexMeta, useEntriesByIds, useEntriesMeta } from '@/features/archive/api';
import { PeriodBar } from '@/features/archive/PeriodBar';
import { useDiary, type MemberPreview } from '@/features/diary/api';
import { MemberAvatar } from '@/features/diary/MemberAvatar';
import { useMissingDiary } from '@/features/diary/useMissingDiary';
import { usePhotoUrls, type Entry } from '@/features/entry/api';
import { useMyUserId } from '@/hooks/useMyUserId';
import { useToday } from '@/hooks/useToday';
import { addDays, formatListDate, isAutoPublic, writableRange } from '@/lib/date';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

export default function DayView() {
  const { id, date: initialDate, justSaved } = useLocalSearchParams<{ id: string; date: string; justSaved?: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const today = useToday();
  const myId = useMyUserId();
  const { diary, missing } = useDiary(id);
  useMissingDiary(missing);
  const [date, setDate] = useState(initialDate);
  const [lockedFor, setLockedFor] = useState<MemberPreview | null>(null);

  const meta = useEntriesMeta(id, date, date);
  const { find } = indexMeta(meta.data);
  const openIds = (meta.data ?? []).filter((r) => r.viewable && r.entry_id).map((r) => r.entry_id!);
  const entries = useEntriesByIds(openIds);

  // 저장 직후: 남의 열린 카드가 차례로 열리는 애니메이션 + 토스트 + 진동(T2). 혼자 쓰기는 없음
  const animate = !!justSaved && !!diary?.is_shared;
  useEffect(() => {
    if (!animate) return;
    toast(ko.day.opened);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [animate, toast]);

  if (!diary || !myId) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const range = writableRange(diary.joined_date, today, diary.late_window_days);
  const mine = find(date, myId);
  const canWrite = !mine && date >= range.from && date <= today;
  const autoPublic = !mine && isAutoPublic(date, today, diary.late_window_days);
  const beforeJoin = date < diary.joined_date;
  const members = diary.is_shared ? diary.members : diary.members.filter((m) => m.user_id === myId);
  const wrote = members.filter((m) => find(date, m.user_id));
  const notYet = members.filter((m) => !find(date, m.user_id) && m.joined_date <= date);
  const write = () => router.push({ pathname: '/entry/write', params: { diaryId: id, date } });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: '' }} />
      <View style={styles.bar}>
        <PeriodBar
          label={formatListDate(date, today)}
          onPrev={() => setDate(addDays(date, -1))}
          onNext={() => setDate(addDays(date, 1))}
          prevDisabled={date <= diary.created_date}
          nextDisabled={date >= today}
          prevLabel={ko.day.prevDay}
          nextLabel={ko.day.nextDay}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {canWrite && !beforeJoin && (
          <View style={[styles.banner, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.bannerText, { color: colors.text }]}>{ko.day.writeBanner}</Text>
            <Button label={ko.day.write} onPress={write} />
          </View>
        )}
        {autoPublic && !beforeJoin && <Text style={[styles.hint, { color: colors.textSub }]}>{ko.day.noRecord}</Text>}

        {wrote.length === 0 && <Text style={[styles.hint, { color: colors.textSub }]}>{ko.day.allRested}</Text>}

        {wrote.map((m, i) => {
          const r = find(date, m.user_id)!;
          const e = entries.data?.find((x) => x.id === r.entry_id);
          return r.viewable && r.entry_id ? (
            <UnlockIn key={m.user_id} index={i} active={animate && m.user_id !== myId}>
              <OpenCard member={m} entry={e} metaEmotion={r.emotion} reactions={r.reaction_count ?? 0} comments={r.comment_count ?? 0} onPress={() => router.push({ pathname: '/home/entry/[id]', params: { id: r.entry_id! } })} />
            </UnlockIn>
          ) : (
            <LockedCard key={m.user_id} member={m} onPress={() => setLockedFor(m)} />
          );
        })}

        {diary.is_shared && notYet.length > 0 && (
          <View style={styles.notYet}>
            <Text style={[styles.notYetTitle, { color: colors.textSub }]}>{ko.day.notYet}</Text>
            <View style={styles.notYetRow}>
              {notYet.map((m) => (
                <View key={m.user_id} accessible accessibilityLabel={m.nickname}>
                  <MemberAvatar member={m} size={CARD_AVATAR_SIZE + spacing.sm} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <BottomSheet visible={!!lockedFor} onClose={() => setLockedFor(null)} title={ko.day.lockedSheet}>
        {canWrite && (
          <Button
            label={ko.day.write}
            onPress={() => {
              setLockedFor(null);
              write();
            }}
          />
        )}
      </BottomSheet>
    </View>
  );
}

/** 잠긴 카드가 열리듯 흐림→선명, 살짝 커지며 나타남 */
function UnlockIn({ index, active, children }: { index: number; active: boolean; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(active ? 0 : 1)).current;
  useEffect(() => {
    if (!active) return;
    Animated.timing(v, { toValue: 1, duration: UNLOCK_DURATION_MS, delay: index * UNLOCK_STAGGER_MS, useNativeDriver: true }).start();
  }, [active, index, v]);
  return (
    <Animated.View style={{ opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
      {children}
    </Animated.View>
  );
}

function CardHeader({ member, right }: { member: MemberPreview; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.cardHeader}>
      <MemberAvatar member={member} size={DAY_AVATAR_SIZE} />
      <Text style={[styles.nick, { color: colors.text }]} numberOfLines={1}>
        {member.nickname}
      </Text>
      {right}
    </View>
  );
}

function OpenCard({ member, entry, metaEmotion, reactions, comments, onPress }: { member: MemberPreview; entry: Entry | undefined; metaEmotion: Entry['emotion'] | null; reactions: number; comments: number; onPress: () => void }) {
  const { colors } = useTheme();
  const thumbs = usePhotoUrls(entry?.photo_paths ?? [], true);
  const emotion = entry?.emotion ?? metaEmotion;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <CardHeader
        member={member}
        right={
          emotion ? (
            <View style={styles.emoWrap}>
              <Text style={styles.emo}>{EMOTION_ICONS[emotion]}</Text>
              <Text style={{ color: colors.textSub, fontSize: fontSize.caption }}>{emotionLabels[emotion]}</Text>
            </View>
          ) : null
        }
      />
      {(entry?.is_late || entry?.edited) && (
        <View style={styles.badges}>
          {entry.is_late && <Text style={[styles.badge, { color: colors.accent, borderColor: colors.accent }]}>{ko.entry.late}</Text>}
          {entry.edited && <Text style={[styles.badge, { color: colors.textSub, borderColor: colors.textSub }]}>{ko.entry.edited}</Text>}
        </View>
      )}
      {(thumbs.data?.length ?? 0) > 0 && (
        <View style={styles.thumbs}>
          {thumbs.data!.map((uri, i) =>
            uri ? <Image key={i} source={{ uri }} style={[styles.thumb, { backgroundColor: colors.locked }]} contentFit="cover" cachePolicy="disk" /> : null,
          )}
        </View>
      )}
      {entry?.content ? (
        <Text style={{ color: colors.text, lineHeight: 22 }} numberOfLines={DAY_CARD_LINES}>
          {entry.content}
        </Text>
      ) : null}
      {(reactions > 0 || comments > 0) && (
        <Text style={{ color: colors.textSub, fontSize: fontSize.caption }}>
          {reactions > 0 ? `💗 ${reactions}` : ''}
          {reactions > 0 && comments > 0 ? '  ·  ' : ''}
          {comments > 0 ? fill(ko.entry.comments, { N: comments }) : ''}
        </Text>
      )}
    </Pressable>
  );
}

/** 잠긴 카드: 아바타·닉네임 + 흐린 종이 + 자물쇠 리본 + "내 일기 쓰면 열려요" (감정·사진 수·글 길이는 숨김) */
function LockedCard({ member, onPress }: { member: MemberPreview; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${member.nickname}, ${ko.diaryMain.statusLocked}, ${ko.day.locked}`}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.locked, borderColor: colors.border }]}
    >
      <CardHeader member={member} right={<Text style={styles.lock}>🔒</Text>} />
      <View style={[styles.paper, { backgroundColor: colors.surface }]} />
      <Text style={{ color: colors.textSub, textAlign: 'center', fontWeight: '700' }}>{ko.day.locked}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { paddingHorizontal: spacing.lg },
  content: { padding: spacing.xl, gap: spacing.md },
  banner: { borderRadius: radius.card, padding: spacing.lg, gap: spacing.md },
  bannerText: { fontSize: fontSize.body, fontWeight: '700' },
  hint: { textAlign: 'center', fontSize: fontSize.body, paddingVertical: spacing.md },
  card: { borderRadius: radius.card, borderWidth: 1, padding: spacing.lg, gap: spacing.md, minHeight: MIN_TOUCH * 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nick: { flex: 1, fontSize: fontSize.body, fontWeight: '800' },
  emoWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  emo: { fontSize: fontSize.title },
  badges: { flexDirection: 'row', gap: spacing.sm },
  badge: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: spacing.sm, fontSize: fontSize.caption, fontWeight: '700' },
  thumbs: { flexDirection: 'row', gap: spacing.sm },
  thumb: { width: 72, height: 72, borderRadius: radius.chip },
  lock: { fontSize: fontSize.title },
  paper: { height: 40, borderRadius: radius.chip, opacity: 0.5 },
  notYet: { marginTop: spacing.lg, gap: spacing.sm },
  notYetTitle: { fontSize: fontSize.caption, fontWeight: '700' },
  notYetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
