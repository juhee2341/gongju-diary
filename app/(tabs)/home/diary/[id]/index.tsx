/**
 * [C1~C3] 일기장 메인: 주 / 월 / 년 세그먼트(일기장별로 마지막 탭 기억)
 * 이동 범위: 일기장 created_date가 있는 주·월·년 ~ 오늘이 있는 주·월·년
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { CARD_AVATAR_SIZE, HOME_AVATAR_PREVIEW, MIN_TOUCH } from '@/constants/policy';
import { fill, ko } from '@/copy/ko';
import { MonthView } from '@/features/archive/MonthView';
import { PeriodBar } from '@/features/archive/PeriodBar';
import { WeekView } from '@/features/archive/WeekView';
import { YearView } from '@/features/archive/YearView';
import { useDiary } from '@/features/diary/api';
import { MemberAvatar } from '@/features/diary/MemberAvatar';
import { useMissingDiary } from '@/features/diary/useMissingDiary';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { useMyUserId } from '@/hooks/useMyUserId';
import { useOnline } from '@/hooks/useOnline';
import { useToday } from '@/hooks/useToday';
import { addDays, addMonths, formatWeekRange, formatYearMonth, startOfWeek, yearMonthOf, type YearMonth } from '@/lib/date';
import { archiveTab, type ArchiveTab } from '@/lib/device';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

const TABS: ArchiveTab[] = ['week', 'month', 'year'];

export default function DiaryMain() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const today = useToday();
  const myId = useMyUserId();
  const profile = useMyProfile();
  const weekStart = (profile.data?.week_start ?? 1) as 0 | 1;
  const { diary, missing } = useDiary(id);
  useMissingDiary(missing);

  const [tab, setTab] = useState<ArchiveTab>('week');
  const [week, setWeek] = useState(() => startOfWeek(today, weekStart));
  const [month, setMonth] = useState<YearMonth>(yearMonthOf(today));
  const [year, setYear] = useState(Number(today.slice(0, 4)));

  useEffect(() => {
    void archiveTab.get(id).then(setTab);
  }, [id]);
  useEffect(() => {
    setWeek(startOfWeek(today, weekStart));
  }, [weekStart, today]);

  const selectTab = (t: ArchiveTab) => {
    setTab(t);
    void archiveTab.set(id, t);
  };

  if (!diary || !myId) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const minWeek = startOfWeek(diary.created_date, weekStart);
  const maxWeek = startOfWeek(today, weekStart);
  const minMonth = yearMonthOf(diary.created_date);
  const maxMonth = yearMonthOf(today);
  const minYear = Number(diary.created_date.slice(0, 4));
  const maxYear = Number(today.slice(0, 4));
  const shown = diary.members.slice(0, HOME_AVATAR_PREVIEW);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.title}>
              <View style={[styles.coverDot, { backgroundColor: colors.cover[diary.cover_color] }]} />
              <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
                {diary.name}
              </Text>
            </View>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              {diary.is_shared && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={ko.diaryMain.members}
                  onPress={() => toast(ko.diarySettings.membersComingSoon)}
                  style={styles.avatars}
                >
                  {shown.map((m) => (
                    <View key={m.user_id} style={[styles.ring, { borderColor: colors.background }]}>
                      <MemberAvatar member={m} size={CARD_AVATAR_SIZE} />
                    </View>
                  ))}
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ko.diaryMain.settings}
                onPress={() => router.push({ pathname: '/home/diary/[id]/settings', params: { id } })}
                style={styles.icon}
              >
                <Text style={{ fontSize: fontSize.title }}>⚙️</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      <View style={[styles.segment, { backgroundColor: colors.primarySoft }]} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            onPress={() => selectTab(t)}
            style={[styles.segItem, tab === t && { backgroundColor: colors.surface }]}
          >
            <Text style={{ color: tab === t ? colors.primary : colors.textSub, fontWeight: '700' }}>{ko.diaryMain.tabs[t]}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'week' && (
          <>
            <PeriodBar
              label={formatWeekRange(week)}
              onPrev={() => setWeek(addDays(week, -7))}
              onNext={() => setWeek(addDays(week, 7))}
              prevDisabled={week <= minWeek}
              nextDisabled={week >= maxWeek}
              onToday={week !== maxWeek ? () => setWeek(maxWeek) : undefined}
            />
            <WeekView diary={diary} today={today} start={week} myId={myId} />
          </>
        )}
        {tab === 'month' && (
          <>
            <PeriodBar
              label={formatYearMonth(month)}
              onPrev={() => setMonth(addMonths(month, -1))}
              onNext={() => setMonth(addMonths(month, 1))}
              prevDisabled={month <= minMonth}
              nextDisabled={month >= maxMonth}
              onToday={month !== maxMonth ? () => setMonth(maxMonth) : undefined}
            />
            <MonthView diary={diary} today={today} ym={month} weekStart={weekStart} myId={myId} />
          </>
        )}
        {tab === 'year' && (
          <>
            <PeriodBar
              label={`${year}년`}
              onPrev={() => setYear(year - 1)}
              onNext={() => setYear(year + 1)}
              prevDisabled={year <= minYear}
              nextDisabled={year >= maxYear}
            />
            <YearView
              diary={diary}
              today={today}
              year={year}
              weekStart={weekStart}
              myId={myId}
              onOpenMonth={(ym) => {
                setMonth(ym);
                selectTab('month');
              }}
            />
          </>
        )}
      </ScrollView>

      <View style={styles.bottom}>
        <Button
          label={diary.wrote_today ? ko.diaryMain.viewToday : ko.diaryMain.writeToday}
          onPress={() =>
            diary.wrote_today
              ? router.push({ pathname: '/home/diary/[id]/day/[date]', params: { id, date: today } })
              : router.push({ pathname: '/entry/write', params: { diaryId: id } })
          }
          blocked={!online && !diary.wrote_today}
          onBlockedPress={() => toast(ko.common.offline)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: 200 },
  coverDot: { width: 12, height: 12, borderRadius: 6 },
  titleText: { fontSize: fontSize.body + 1, fontWeight: '800', flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  avatars: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH, paddingRight: spacing.sm },
  ring: { borderWidth: 2, borderRadius: CARD_AVATAR_SIZE, marginLeft: -spacing.sm },
  icon: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', marginHorizontal: spacing.xl, borderRadius: radius.button, padding: spacing.xs },
  segItem: { flex: 1, minHeight: MIN_TOUCH - spacing.sm, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.md },
  bottom: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
});
