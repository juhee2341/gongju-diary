/**
 * [B2, E1] 일기장 입력 요소: 커버 미리보기, 이름 입력, 커버 색상 칩, 쓰기 방식 카드, 늦게 쓰기 기간 세그먼트
 */
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useToast } from '@/components/Toast';
import {
  COVER_COLORS,
  DIARY_NAME_LEN,
  LATE_WINDOW,
  MIN_TOUCH,
  type CoverColorKey,
  type LateWindowDays,
} from '@/constants/policy';
import { errorCopy, fill, ko } from '@/copy/ko';
import { clampGraphemes, graphemeLength, normalizeSingleLine } from '@/lib/text';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

/** 커버 미리보기 카드(선택한 색 + 이름) */
export function CoverPreview({ name, cover, right }: { name: string; cover: CoverColorKey; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.preview, { backgroundColor: colors.cover[cover] }]}>
      <View style={[styles.previewBand, { backgroundColor: colors.surface }]}>
        <Text style={[styles.previewName, { color: name ? colors.text : colors.textSub }]} numberOfLines={1}>
          {name || ko.diary.namePlaceholder}
        </Text>
        {right}
      </View>
    </View>
  );
}

/** 이름 입력 + "0/20". 금지어면 danger 문구 */
export function DiaryNameInput({
  value,
  onChange,
  banned,
}: {
  value: string;
  onChange: (v: string) => void;
  banned: boolean;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const count = graphemeLength(normalizeSingleLine(value));
  return (
    <View>
      <View style={[styles.inputRow, { borderColor: banned ? colors.danger : colors.border, backgroundColor: colors.surface }]}>
        <TextInput
          value={value}
          onChangeText={(t) => {
            const r = clampGraphemes(t, DIARY_NAME_LEN.max);
            onChange(r.value);
            if (r.truncated) toast(fill(ko.common.maxChars, { N: DIARY_NAME_LEN.max }));
          }}
          placeholder={ko.diary.namePlaceholder}
          placeholderTextColor={colors.textSub}
          accessibilityLabel={ko.diary.namePlaceholder}
          style={[styles.input, { color: colors.text }]}
          returnKeyType="done"
        />
        <Text style={{ color: colors.textSub, fontSize: fontSize.caption }}>
          {fill(ko.profile.counter, { N: count, MAX: DIARY_NAME_LEN.max })}
        </Text>
      </View>
      {banned && <Text style={[styles.error, { color: colors.danger }]}>{errorCopy.banned_word}</Text>}
    </View>
  );
}

/** 커버 색상 8개 원형 칩 */
export function CoverPicker({ value, onChange }: { value: CoverColorKey; onChange: (c: CoverColorKey) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={ko.diary.coverLabel}>
      {COVER_COLORS.map((c, i) => (
        <Pressable
          key={c}
          accessibilityRole="radio"
          accessibilityLabel={fill(ko.diary.coverOption, { N: i + 1 })}
          accessibilityState={{ checked: value === c }}
          onPress={() => onChange(c)}
          style={[styles.chipHit]}
        >
          <View
            style={[
              styles.chip,
              { backgroundColor: colors.cover[c], borderColor: value === c ? colors.primary : 'transparent' },
            ]}
          />
        </Pressable>
      ))}
    </View>
  );
}

/** 쓰기 방식 카드 2개 */
export function ModeCards({ isShared, onChange }: { isShared: boolean | null; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  const items = [
    { shared: false, title: ko.diary.solo, desc: ko.diary.soloDesc, icon: '📔' },
    { shared: true, title: ko.diary.shared, desc: ko.diary.sharedDesc, icon: '👭' },
  ];
  return (
    <View style={styles.modes} accessibilityRole="radiogroup" accessibilityLabel={ko.diary.modeLabel}>
      {items.map((it) => {
        const on = isShared === it.shared;
        return (
          <Pressable
            key={String(it.shared)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${it.title}. ${it.desc}`}
            onPress={() => onChange(it.shared)}
            style={[
              styles.modeCard,
              { backgroundColor: on ? colors.primarySoft : colors.surface, borderColor: on ? colors.primary : colors.border },
            ]}
          >
            <Text style={styles.modeIcon}>{it.icon}</Text>
            <Text style={[styles.modeTitle, { color: on ? colors.primary : colors.text }]}>{it.title}</Text>
            <Text style={[styles.modeDesc, { color: colors.textSub }]}>{it.desc}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 늦게 쓰기 허용 1일 / 3일 / 7일 */
export function LateWindowPicker({
  value,
  onChange,
  disabled,
  showDesc = true,
}: {
  value: number;
  onChange: (d: LateWindowDays) => void;
  disabled?: boolean;
  showDesc?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.lateWrap}>
      <View style={[styles.segment, { backgroundColor: colors.primarySoft }]} accessibilityRole="radiogroup" accessibilityLabel={ko.diary.lateWindow}>
        {LATE_WINDOW.sharedOptions.map((d) => {
          const on = value === d;
          return (
            <Pressable
              key={d}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled }}
              onPress={() => onChange(d)}
              style={[styles.segItem, on && { backgroundColor: colors.surface }]}
            >
              <Text style={{ color: on ? colors.primary : colors.textSub, fontWeight: '700', opacity: disabled && !on ? 0.5 : 1 }}>
                {fill(ko.diary.lateWindowOption, { N: d })}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {showDesc && <Text style={[styles.lateDesc, { color: colors.textSub }]}>{ko.diary.lateWindowDesc}</Text>}
    </View>
  );
}

const CHIP = 32;

const styles = StyleSheet.create({
  preview: { borderRadius: radius.card, paddingTop: spacing.xxl * 2, overflow: 'hidden' },
  previewBand: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  previewName: { flex: 1, fontSize: fontSize.title, fontWeight: '800' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    minHeight: MIN_TOUCH + spacing.md,
  },
  input: { flex: 1, fontSize: fontSize.body + 1, paddingVertical: spacing.md },
  error: { fontSize: fontSize.caption, marginTop: spacing.xs, marginLeft: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  chipHit: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  chip: { width: CHIP, height: CHIP, borderRadius: CHIP / 2, borderWidth: 3 },
  modes: { flexDirection: 'row', gap: spacing.md },
  modeCard: { flex: 1, borderWidth: 1.5, borderRadius: radius.card, padding: spacing.lg, gap: spacing.xs, minHeight: 120 },
  modeIcon: { fontSize: fontSize.title + 4 },
  modeTitle: { fontSize: fontSize.body + 1, fontWeight: '800' },
  modeDesc: { fontSize: fontSize.caption },
  lateWrap: { gap: spacing.sm },
  segment: { flexDirection: 'row', borderRadius: radius.button, padding: spacing.xs },
  segItem: { flex: 1, minHeight: MIN_TOUCH, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  lateDesc: { fontSize: fontSize.caption },
});
