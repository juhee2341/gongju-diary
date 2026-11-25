/** 공통 바텀시트(Modal 기반) */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ko } from '@/copy/ko';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

type Props = { visible: boolean; onClose: () => void; title?: string; children: ReactNode };

export function BottomSheet({ visible, onClose, title, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={ko.common.close} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          {title && (
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              {title}
            </Text>
          )}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: spacing.xl, gap: spacing.md },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.sm },
  title: { fontSize: fontSize.title, fontWeight: '700' },
});
