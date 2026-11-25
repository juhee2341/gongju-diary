/**
 * [D1] 사진 칸 3개(정사각): 빈 칸 "+", 채운 칸은 썸네일 + 우상단 X.
 * 길게 누르면 맨 앞으로 옮긴다(드래그 정렬 대신 단순화). 업로드 실패한 칸은 danger 느낌표.
 */
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MAX_PHOTOS, MIN_TOUCH } from '@/constants/policy';
import { fill, ko } from '@/copy/ko';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

export type SlotPhoto = { key: string; preview: string | null };

type Props = {
  photos: SlotPhoto[];
  failed: number[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMoveFirst: (index: number) => void;
};

export function PhotoSlots({ photos, failed, onAdd, onRemove, onMoveFirst }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {Array.from({ length: MAX_PHOTOS }, (_, i) => {
        const p = photos[i];
        if (!p) {
          const isNext = i === photos.length;
          return (
            <Pressable
              key={`empty-${i}`}
              accessibilityRole="button"
              accessibilityLabel={ko.write.addPhoto}
              disabled={!isNext}
              onPress={onAdd}
              style={[styles.slot, { borderColor: colors.border, backgroundColor: colors.surface, opacity: isNext ? 1 : 0.4 }]}
            >
              <Text style={[styles.plus, { color: colors.textSub }]}>+</Text>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={p.key}
            accessibilityRole="image"
            accessibilityLabel={fill(ko.write.photoLabel, { N: i + 1 })}
            accessibilityHint={ko.write.moveFirst}
            onLongPress={() => onMoveFirst(i)}
            style={[styles.slot, { borderColor: failed.includes(i) ? colors.danger : colors.border, backgroundColor: colors.locked }]}
          >
            {p.preview && <Image source={{ uri: p.preview }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />}
            {failed.includes(i) && (
              <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                <Text style={{ color: colors.onPrimary, fontWeight: '800' }}>!</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ko.write.removePhoto}
              onPress={() => onRemove(i)}
              hitSlop={spacing.sm}
              style={[styles.remove, { backgroundColor: colors.text }]}
            >
              <Text style={{ color: colors.background, fontSize: fontSize.caption, fontWeight: '800' }}>✕</Text>
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  slot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.chip,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH,
  },
  plus: { fontSize: fontSize.display },
  badge: { position: 'absolute', left: spacing.xs, top: spacing.xs, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', right: spacing.xs, top: spacing.xs, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
