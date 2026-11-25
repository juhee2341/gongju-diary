/** [B2, E1] 초대 공유 바텀시트: 코드 크게, "코드 복사", "공유하기", "나중에" */
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { ko } from '@/copy/ko';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { copyInviteCode, shareInvite } from './invite';

export function InviteCode({ code }: { code: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.codeBox, { backgroundColor: colors.primarySoft }]}>
      <Text
        style={[styles.code, { color: colors.primary }]}
        accessibilityLabel={code.split('').join(' ')}
        selectable
      >
        {code}
      </Text>
    </View>
  );
}

export function InviteSheet({ code, onClose }: { code: string | null; onClose: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  return (
    <BottomSheet visible={!!code} onClose={onClose} title={ko.invite.title}>
      <Text style={{ color: colors.textSub, fontSize: fontSize.body }}>{ko.invite.desc}</Text>
      {code && <InviteCode code={code} />}
      <View style={styles.row}>
        <Button
          label={ko.invite.copy}
          variant="soft"
          style={styles.flex}
          onPress={async () => {
            if (!code) return;
            await copyInviteCode(code);
            toast(ko.invite.copied);
          }}
        />
        <Button label={ko.invite.share} style={styles.flex} onPress={() => code && void shareInvite(code)} />
      </View>
      <Button label={ko.invite.later} variant="text" onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  codeBox: { borderRadius: radius.card, paddingVertical: spacing.xl, alignItems: 'center' },
  code: { fontSize: fontSize.display + 4, fontWeight: '800', letterSpacing: 6 },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
