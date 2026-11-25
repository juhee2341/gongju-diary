/**
 * [B1] 일기장 카드
 * 커버 띠, 이름, 주인이면 왕관, 멤버 아바타 최대 4개 + "+N", 오늘 작성 리본,
 * 함께 쓰기면 "오늘 {N}명 썼어요", 주인이고 대기 요청이 있으면 알림 점 + "요청 {N}".
 * 혼자 쓰기는 아바타·인원 대신 최근 감정 아이콘 7개.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AvatarView } from '@/components/AvatarView';
import { EMOTION_ICONS, type Emotion } from '@/constants/emotions';
import { CARD_AVATAR_SIZE, HOME_AVATAR_PREVIEW, MIN_TOUCH, SOLO_RECENT_EMOTIONS } from '@/constants/policy';
import { emotionLabels, fill, ko } from '@/copy/ko';
import { useAvatarUri } from '@/features/profile/useMyProfile';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';
import type { MemberPreview, MyDiary } from './api';

type Props = {
  diary: MyDiary;
  onPress: () => void;
  onLongPress: () => void;
  onRibbonPress: () => void;
};

function MemberAvatar({ m }: { m: MemberPreview }) {
  const { colors } = useTheme();
  const uri = useAvatarUri(m.avatar_type === 'photo' ? m.avatar_path : null);
  return (
    <View style={[styles.avatarRing, { borderColor: colors.surface }]}>
      <AvatarView size={CARD_AVATAR_SIZE} emoji={m.avatar_emoji} photoUri={uri} />
    </View>
  );
}

export function DiaryCard({ diary, onPress, onLongPress, onRibbonPress }: Props) {
  const { colors } = useTheme();
  const isOwner = diary.role === 'owner';
  const shown = diary.members.slice(0, HOME_AVATAR_PREVIEW);
  const extra = diary.member_count - shown.length;
  const ribbon = diary.wrote_today ? ko.home.wroteToday : ko.home.notYet;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[diary.name, isOwner ? ko.home.ownerLabel : '', ribbon].filter(Boolean).join(', ')}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.band, { backgroundColor: colors.cover[diary.cover_color] }]} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {diary.name}
          </Text>
          {isOwner && <Text accessibilityElementsHidden>👑</Text>}
          {diary.pinned && <Text accessibilityElementsHidden>📌</Text>}
          {isOwner && diary.pending_requests > 0 && (
            <View style={styles.request}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={{ color: colors.primary, fontSize: fontSize.caption, fontWeight: '700' }}>
                {fill(ko.home.requestCount, { N: diary.pending_requests })}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          {diary.is_shared ? (
            <>
              <View style={styles.avatars}>
                {shown.map((m) => (
                  <MemberAvatar key={m.user_id} m={m} />
                ))}
                {extra > 0 && (
                  <Text style={[styles.extra, { color: colors.textSub }]}>{fill(ko.home.moreMembers, { N: extra })}</Text>
                )}
              </View>
              <Text style={[styles.meta, { color: colors.textSub }]}>
                {fill(ko.home.todayCount, { N: diary.today_count })}
              </Text>
            </>
          ) : (
            <View style={styles.emotions}>
              {diary.recent_emotions.slice(0, SOLO_RECENT_EMOTIONS).map((e, i) => (
                <Text key={i} accessibilityLabel={emotionLabels[e as Emotion]}>
                  {EMOTION_ICONS[e as Emotion]}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ribbon}
        disabled={diary.wrote_today}
        onPress={onRibbonPress}
        style={[styles.ribbon, { backgroundColor: diary.wrote_today ? colors.primary : colors.primarySoft }]}
      >
        <Text style={{ color: diary.wrote_today ? colors.onPrimary : colors.primary, fontSize: fontSize.caption, fontWeight: '700' }}>
          {ribbon}
        </Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', minHeight: 96 },
  band: { width: spacing.md },
  body: { flex: 1, padding: spacing.lg, gap: spacing.sm, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontSize: fontSize.body + 2, fontWeight: '800', flexShrink: 1 },
  request: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: CARD_AVATAR_SIZE },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: { borderWidth: 2, borderRadius: CARD_AVATAR_SIZE, marginRight: -spacing.sm },
  extra: { marginLeft: spacing.md, fontSize: fontSize.caption },
  meta: { fontSize: fontSize.caption },
  emotions: { flexDirection: 'row', gap: spacing.xs },
  ribbon: {
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    marginRight: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH,
    borderRadius: radius.chip,
    justifyContent: 'center',
  },
});
