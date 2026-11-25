/**
 * [D2] 일기 상세 — 3단계: 사진 슬라이드, 감정·배지, 본문, 수정·삭제
 * TODO(4단계 #3) 같은 날 다른 일기 아바타 줄·좌우 넘기기, 삭제 후 C4로
 * TODO(6단계 #5) 잠긴 일기 직접 진입 시 C4로 대체 이동
 * TODO(7단계 #6) 리액션 바, 댓글
 * TODO(10단계 #9) 신고·차단 메뉴
 */
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { AvatarView } from '@/components/AvatarView';
import { BottomSheet } from '@/components/BottomSheet';
import { SheetRow } from '@/components/SheetRow';
import { useToast } from '@/components/Toast';
import { EMOTION_ICONS } from '@/constants/emotions';
import { MIN_TOUCH } from '@/constants/policy';
import { emotionLabels, errorCopy, fill, ko } from '@/copy/ko';
import { useDiary } from '@/features/diary/api';
import { deleteEntry, useEntry, useInvalidateEntries, usePhotoUrls } from '@/features/entry/api';
import { useAvatarUri } from '@/features/profile/useMyProfile';
import { useMyUserId } from '@/hooks/useMyUserId';
import { useToday } from '@/hooks/useToday';
import { confirm } from '@/lib/confirm';
import { formatListDate } from '@/lib/date';
import { AppError } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

const HEADER_AVATAR = 28;

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const today = useToday();
  const userId = useMyUserId();
  const { width } = useWindowDimensions();
  const entry = useEntry(id);
  const e = entry.data;
  const { diary } = useDiary(e?.diary_id ?? '');
  const author = diary?.members.find((m) => m.user_id === e?.author_id);
  const authorAvatar = useAvatarUri(author?.avatar_type === 'photo' ? author.avatar_path : null);
  const photos = usePhotoUrls(e?.photo_paths ?? [], false);
  const invalidate = useInvalidateEntries();
  const [page, setPage] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isMine = !!e && e.author_id === userId;

  // 공통 규칙: 일기가 없으면 "삭제된 일기예요" → 이전 화면
  useEffect(() => {
    if (entry.isSuccess && !entry.data) {
      toast(errorCopy.entry_not_found);
      router.back();
    }
  }, [entry.isSuccess, entry.data, toast]);

  if (!e) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const frame = width - spacing.xl * 2;

  const onScroll = (ev: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(ev.nativeEvent.contentOffset.x / frame));

  const remove = async () => {
    setMenuOpen(false);
    const ok = await confirm({ title: ko.entry.deleteTitle, message: ko.entry.deleteDesc, ok: ko.entry.delete, destructive: true });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteEntry(e);
      await invalidate(e.diary_id, e.id);
      router.back();
    } catch (err) {
      toast(errorCopy[err instanceof AppError ? err.code : 'network']);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.header}>
              <AvatarView size={HEADER_AVATAR} emoji={author?.avatar_emoji} photoUri={authorAvatar} faded={!author} />
              <View>
                <Text style={[styles.author, { color: colors.text }]}>{author?.nickname ?? ko.common.leftAuthor}</Text>
                <Text style={[styles.date, { color: colors.textSub }]}>{formatListDate(e.entry_date, today)}</Text>
              </View>
            </View>
          ),
          headerRight: () =>
            isMine ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ko.entry.more}
                onPress={() => setMenuOpen(true)}
                disabled={deleting}
                style={styles.more}
              >
                <Text style={{ fontSize: fontSize.title, color: colors.text }}>⋯</Text>
              </Pressable>
            ) : null,
        }}
      />

      {e.photo_paths.length > 0 && (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            style={[styles.photos, { width: frame, height: frame, backgroundColor: colors.locked }]}
          >
            {e.photo_paths.map((p, i) => {
              const uri = photos.data?.[i];
              return (
                <View key={p} style={{ width: frame, height: frame }} accessibilityLabel={fill(ko.entry.photoPage, { N: i + 1, TOTAL: e.photo_paths.length })}>
                  {uri ? (
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="disk" />
                  ) : photos.isError ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={ko.entry.photoRetry} onPress={() => void photos.refetch()} style={styles.retry}>
                      <Text style={{ fontSize: fontSize.display }}>🔄</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
          {e.photo_paths.length > 1 && (
            <View style={styles.dots}>
              {e.photo_paths.map((p, i) => (
                <View key={p} style={[styles.dot, { backgroundColor: i === page ? colors.primary : colors.border }]} />
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.meta}>
        <Text style={styles.emotionIcon} accessibilityLabel={emotionLabels[e.emotion]}>
          {EMOTION_ICONS[e.emotion]}
        </Text>
        <Text style={[styles.emotionLabel, { color: colors.text }]}>{emotionLabels[e.emotion]}</Text>
        {e.is_late && <Badge label={ko.entry.late} color={colors.accent} />}
        {e.edited && <Badge label={ko.entry.edited} color={colors.textSub} />}
      </View>

      {e.content ? <Text style={[styles.body, { color: colors.text }]}>{e.content}</Text> : null}

      <Text style={[styles.note, { color: colors.textSub }]}>{ko.entry.reactionsComingSoon}</Text>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <SheetRow
          label={ko.entry.edit}
          onPress={() => {
            setMenuOpen(false);
            router.push({ pathname: '/entry/write', params: { diaryId: e.diary_id, entryId: e.id } });
          }}
        />
        <SheetRow label={ko.entry.delete} danger onPress={() => void remove()} />
      </BottomSheet>
    </ScrollView>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={{ color, fontSize: fontSize.caption, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { fontSize: fontSize.body, fontWeight: '700' },
  date: { fontSize: fontSize.caption },
  more: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  photos: { borderRadius: radius.card },
  retry: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  emotionIcon: { fontSize: fontSize.title + 6 },
  emotionLabel: { fontSize: fontSize.body + 1, fontWeight: '700' },
  badge: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  body: { fontSize: fontSize.body + 1, lineHeight: 26 },
  note: { fontSize: fontSize.caption, textAlign: 'center', marginTop: spacing.xl },
});
