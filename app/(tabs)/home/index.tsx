/**
 * [B1] 홈 (내 일기장 목록)
 * TODO(3단계) 계정 연결 안내 카드(LINK_NUDGE)는 일기 수 집계가 생기면 붙인다
 * TODO(5단계) 대기 요청 띠 "승인 기다리는 중 {N}개" → B4
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarView } from '@/components/AvatarView';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { SheetRow } from '@/components/SheetRow';
import { useToast } from '@/components/Toast';
import { HOME_AVATAR_SIZE, HOME_SEARCH_THRESHOLD, MIN_TOUCH } from '@/constants/policy';
import { errorCopy, fill, ko } from '@/copy/ko';
import { useMyDiaries, useSetMemberFlags, type MyDiary } from '@/features/diary/api';
import { DiaryCard } from '@/features/diary/DiaryCard';
import { useAvatarUri, useMyProfile } from '@/features/profile/useMyProfile';
import { useMyUserId } from '@/hooks/useMyUserId';
import { useOnline } from '@/hooks/useOnline';
import { useToday } from '@/hooks/useToday';
import { formatListDate } from '@/lib/date';
import { AppError } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

export default function Home() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const today = useToday();
  const userId = useMyUserId();
  const profile = useMyProfile();
  const avatarUri = useAvatarUri(profile.data?.avatar_type === 'photo' ? profile.data.avatar_path : null);
  const diaries = useMyDiaries();
  const flags = useSetMemberFlags();

  const [menuFor, setMenuFor] = useState<MyDiary | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const all = diaries.data ?? [];
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((d) => d.name.toLowerCase().includes(q)) : all;
  }, [all, query]);
  const showSearch = all.length >= HOME_SEARCH_THRESHOLD;
  const hasShared = all.some((d) => d.is_shared);

  const openDiary = (d: MyDiary) => router.push({ pathname: '/home/diary/[id]', params: { id: d.id } });
  const joinComingSoon = () => toast(ko.home.joinComingSoon);
  const goCreate = () => (online ? router.push('/diary/new') : toast(ko.common.offline));

  const togglePin = async (d: MyDiary) => {
    setMenuFor(null);
    if (!userId) return;
    try {
      await flags.mutateAsync({ diaryId: d.id, userId, pinned: !d.pinned });
    } catch (e) {
      toast(errorCopy[e instanceof AppError ? e.code : 'network']);
    }
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={[styles.greeting, { color: colors.text }]} accessibilityRole="header" numberOfLines={1}>
          {profile.data ? fill(ko.home.greeting, { 닉네임: profile.data.nickname }) : ko.appName}
        </Text>
        <Text style={[styles.date, { color: colors.textSub }]}>{formatListDate(today, today)}</Text>
      </View>
      {showSearch && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ko.home.search}
          onPress={() => setSearchOpen((v) => !v)}
          style={styles.iconBtn}
        >
          <Text style={{ fontSize: fontSize.title }}>🔍</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ko.home.profileButton}
        onPress={() => router.navigate('/settings')}
        style={styles.iconBtn}
      >
        <AvatarView size={HOME_AVATAR_SIZE} emoji={profile.data?.avatar_emoji} photoUri={avatarUri} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {header}
      {showSearch && searchOpen && (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={ko.home.searchPlaceholder}
          placeholderTextColor={colors.textSub}
          accessibilityLabel={ko.home.search}
          style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          autoFocus
        />
      )}

      <FlatList
        data={list}
        keyExtractor={(d) => d.id}
        contentContainerStyle={[styles.list, list.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl refreshing={diaries.isRefetching} onRefresh={() => void diaries.refetch()} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <DiaryCard
            diary={item}
            onPress={() => openDiary(item)}
            onLongPress={() => setMenuFor(item)}
            onRibbonPress={() => router.push({ pathname: '/entry/write', params: { diaryId: item.id } })}
          />
        )}
        ListEmptyComponent={
          diaries.isLoading ? (
            <View style={styles.skeletonWrap}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.skeleton, { backgroundColor: colors.locked }]} />
              ))}
            </View>
          ) : diaries.isError && !diaries.data ? (
            <View style={styles.empty}>
              <Text style={{ color: colors.textSub }}>{errorCopy.network}</Text>
              <Button label={ko.common.retry} variant="soft" onPress={() => void diaries.refetch()} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyArt}>👑</Text>
              <Text style={[styles.emptyText, { color: colors.textSub }]}>{ko.home.empty}</Text>
            </View>
          )
        }
        ListFooterComponent={
          all.length > 0 && !hasShared ? (
            <View style={[styles.together, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.togetherTitle, { color: colors.text }]}>{ko.home.togetherTitle}</Text>
              <View style={styles.row}>
                <Button label={ko.home.togetherCreate} style={styles.flex} onPress={goCreate} />
                <Button label={ko.home.togetherJoin} variant="soft" style={styles.flex} onPress={joinComingSoon} />
              </View>
            </View>
          ) : undefined
        }
      />

      <View style={[styles.bottom, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Button label={ko.home.create} style={styles.flex} onPress={goCreate} blocked={!online} onBlockedPress={() => toast(ko.common.offline)} />
        <Pressable
          accessibilityRole="button"
          onPress={joinComingSoon}
          style={[styles.outline, { borderColor: colors.primary }]}
        >
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: fontSize.body }}>{ko.home.join}</Text>
        </Pressable>
      </View>

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.name}>
        {menuFor && (
          <>
            <SheetRow label={menuFor.pinned ? ko.home.unpin : ko.home.pin} onPress={() => void togglePin(menuFor)} />
            <SheetRow
              label={ko.home.openSettings}
              onPress={() => {
                const id = menuFor.id;
                setMenuFor(null);
                router.push({ pathname: '/home/diary/[id]/settings', params: { id } });
              }}
            />
          </>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.sm },
  headerText: { flex: 1 },
  greeting: { fontSize: fontSize.title + 2, fontWeight: '800' },
  date: { fontSize: fontSize.body, marginTop: spacing.xs },
  iconBtn: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  search: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    minHeight: MIN_TOUCH,
    fontSize: fontSize.body,
  },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },
  listEmpty: { flexGrow: 1 },
  skeletonWrap: { gap: spacing.md },
  skeleton: { height: 96, borderRadius: radius.card },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyArt: { fontSize: fontSize.display * 2 },
  emptyText: { fontSize: fontSize.body },
  together: { borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, marginTop: spacing.sm },
  togetherTitle: { fontSize: fontSize.body + 1, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  bottom: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  outline: {
    flex: 1,
    minHeight: MIN_TOUCH + spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
