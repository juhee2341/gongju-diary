/** [A3] 약관 개정 재동의 — A1에서 terms_version이 최신과 다르면 다른 화면보다 먼저 */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/Toast';
import { errorCopy, ko } from '@/copy/ko';
import { agreeTerms } from '@/features/auth/bootstrap';
import { TermsSheet } from '@/features/auth/TermsSheet';
import { AppError } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

export default function Reconsent() {
  const { colors } = useTheme();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await agreeTerms();
      router.replace('/home');
    } catch (e) {
      toast(errorCopy[e instanceof AppError ? e.code : 'network']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TermsSheet visible title={ko.terms.reconsentTitle} submitting={saving} onSubmit={submit} />
    </View>
  );
}
