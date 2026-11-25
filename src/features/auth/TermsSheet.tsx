/**
 * [A3] 약관 동의 바텀시트
 * 전체 동의 / [필수] 만 14세 이상 / [필수] 이용약관 / [필수] 개인정보 수집·이용, 항목마다 "보기"
 * 필수 항목을 모두 체크하면 "동의하고 시작" 활성
 */
import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { PRIVACY_URL, TERMS_URL } from '@/constants/app';
import { MIN_TOUCH } from '@/constants/policy';
import { ko } from '@/copy/ko';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

type Key = 'age' | 'service' | 'privacy';
const ITEMS: Array<{ key: Key; label: string; url?: string; fallback?: string }> = [
  { key: 'age', label: ko.terms.age },
  { key: 'service', label: ko.terms.service, url: TERMS_URL, fallback: ko.terms.serviceDoc },
  { key: 'privacy', label: ko.terms.privacy, url: PRIVACY_URL, fallback: ko.terms.privacyDoc },
];

type Props = {
  visible: boolean;
  title?: string;
  submitting?: boolean;
  onSubmit: () => void;
  onClose?: () => void;
};

export function TermsSheet({ visible, title = ko.terms.title, submitting, onSubmit, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState<Record<Key, boolean>>({ age: false, service: false, privacy: false });
  const [touched, setTouched] = useState(false);
  const [openDoc, setOpenDoc] = useState<Key | null>(null);

  const all = checked.age && checked.service && checked.privacy;
  const toggle = (k: Key) => {
    setTouched(true);
    setChecked((c) => ({ ...c, [k]: !c[k] }));
  };
  const toggleAll = () => {
    setTouched(true);
    setChecked({ age: !all, service: !all, privacy: !all });
  };
  const view = (item: (typeof ITEMS)[number]) => {
    if (item.url) void Linking.openURL(item.url);
    else setOpenDoc((d) => (d === item.key ? null : item.key));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={ko.common.close} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

        <CheckRow label={ko.terms.agreeAll} checked={all} onPress={toggleAll} bold />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {ITEMS.map((item) => (
          <View key={item.key}>
            <CheckRow
              label={item.label}
              checked={checked[item.key]}
              onPress={() => toggle(item.key)}
              onView={item.key === 'age' ? undefined : () => view(item)}
            />
            {openDoc === item.key && item.fallback && (
              <Text style={[styles.doc, { color: colors.textSub, backgroundColor: colors.background }]}>
                {item.fallback}
              </Text>
            )}
            {item.key === 'age' && touched && !checked.age && (
              <Text style={[styles.warn, { color: colors.danger }]}>{ko.terms.ageRequired}</Text>
            )}
          </View>
        ))}

        <Button label={ko.terms.submit} onPress={onSubmit} disabled={!all} loading={submitting} style={styles.submit} />
      </View>
    </Modal>
  );
}

function CheckRow({
  label,
  checked,
  onPress,
  onView,
  bold,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  onView?: () => void;
  bold?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={onPress}
        style={styles.rowMain}
      >
        <View
          style={[
            styles.box,
            { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : 'transparent' },
          ]}
        >
          {checked && <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>✓</Text>}
        </View>
        <Text style={[styles.label, { color: colors.text, fontWeight: bold ? '700' : '400' }]}>{label}</Text>
      </Pressable>
      {onView && (
        <Pressable accessibilityRole="button" onPress={onView} style={styles.view} hitSlop={spacing.sm}>
          <Text style={{ color: colors.textSub, textDecorationLine: 'underline' }}>{ko.terms.view}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: spacing.xl, gap: spacing.xs },
  title: { fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing.md },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: fontSize.body, flexShrink: 1 },
  view: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  doc: { fontSize: fontSize.caption, padding: spacing.md, borderRadius: radius.chip, marginLeft: spacing.xxl },
  warn: { fontSize: fontSize.caption, marginLeft: spacing.xxl + spacing.xs },
  submit: { marginTop: spacing.lg },
});
