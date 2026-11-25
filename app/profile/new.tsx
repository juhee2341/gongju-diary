/**
 * [A4] 프로필 만들기
 * 수정 모드(G1 프로필 편집)는 11단계 G1과 함께 만든다.
 */
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarView } from '@/components/AvatarView';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { AVATAR_EMOJI_DEFAULT, AVATAR_EMOJIS, AVATAR_GRID_COLUMNS } from '@/constants/avatars';
import { AVATAR_PREVIEW_DIAMETER, MIN_TOUCH, NICKNAME_LEN } from '@/constants/policy';
import { errorCopy, fill, ko } from '@/copy/ko';
import { containsBannedWord, useBannedWords } from '@/features/auth/useAppConfig';
import { createProfile } from '@/features/profile/createProfile';
import { useOnline } from '@/hooks/useOnline';
import { processAvatar } from '@/lib/image';
import { queryClient } from '@/lib/query';
import { AppError } from '@/lib/supabase';
import { clampGraphemes, graphemeLength, normalizeSingleLine } from '@/lib/text';
import { useTheme } from '@/theme/ThemeProvider';
import { fontSize, radius, spacing } from '@/theme/tokens';

type Mode = 'emoji' | 'photo';

export default function ProfileNew() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const banned = useBannedWords();

  const [mode, setMode] = useState<Mode>('emoji');
  const [emoji, setEmoji] = useState<string>(AVATAR_EMOJI_DEFAULT);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmed = normalizeSingleLine(nickname);
  const count = graphemeLength(trimmed);
  const hasBanned = containsBannedWord(trimmed, banned.data ?? []);
  const canSubmit = count >= NICKNAME_LEN.min && count <= NICKNAME_LEN.max && !hasBanned;

  const onChangeNickname = (text: string) => {
    const { value, truncated } = clampGraphemes(text, NICKNAME_LEN.max);
    setNickname(value);
    if (truncated) toast(fill(ko.common.maxChars, { N: NICKNAME_LEN.max }));
  };

  const denyPhoto = () => {
    setMode('emoji');
    toast(ko.profile.photoPermissionDenied, { label: ko.common.openSettings, onPress: () => void Linking.openSettings() });
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return denyPhoto();
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      exif: false,
    });
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    setPhotoUri(await processAvatar({ uri: asset.uri, width: asset.width, height: asset.height }));
  };

  const selectMode = (m: Mode) => {
    setMode(m);
    if (m === 'photo' && !photoUri) void pickPhoto();
  };

  const submit = async () => {
    setSaving(true);
    try {
      const { photoFailed } = await createProfile({
        nickname: trimmed,
        avatarType: mode === 'photo' && photoUri ? 'photo' : 'emoji',
        emoji: mode === 'photo' && photoUri ? AVATAR_EMOJI_DEFAULT : emoji,
        photoUri: mode === 'photo' ? photoUri : null,
      });
      if (photoFailed) toast(ko.profile.photoUploadFailed);
      await queryClient.invalidateQueries();
      router.replace('/home');
    } catch (e) {
      toast(errorCopy[e instanceof AppError ? e.code : 'network']);
    } finally {
      setSaving(false);
    }
  };

  const uploading = saving && mode === 'photo' && !!photoUri;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {ko.profile.createTitle}
          </Text>

          <View style={styles.avatarWrap}>
            <AvatarView
              size={AVATAR_PREVIEW_DIAMETER}
              emoji={mode === 'emoji' ? emoji : null}
              photoUri={mode === 'photo' ? photoUri : null}
            />
            {uploading && (
              <View style={[styles.uploading, { borderRadius: AVATAR_PREVIEW_DIAMETER / 2 }]}>
                <ActivityIndicator color={colors.onPrimary} accessibilityLabel={ko.profile.uploading} />
              </View>
            )}
          </View>

          <View style={[styles.toggle, { backgroundColor: colors.primarySoft }]} accessibilityRole="tablist">
            {(['emoji', 'photo'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                onPress={() => selectMode(m)}
                style={[styles.toggleItem, mode === m && { backgroundColor: colors.surface }]}
              >
                <Text style={{ color: mode === m ? colors.primary : colors.textSub, fontWeight: '700' }}>
                  {ko.profile[m]}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'emoji' ? (
            <View style={styles.grid}>
              {AVATAR_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  accessibilityRole="button"
                  accessibilityLabel={fill(ko.profile.avatarLabel, { E: e })}
                  accessibilityState={{ selected: emoji === e }}
                  onPress={() => setEmoji(e)}
                  style={[
                    styles.cell,
                    { backgroundColor: emoji === e ? colors.primarySoft : 'transparent', borderColor: emoji === e ? colors.primary : 'transparent' },
                  ]}
                >
                  <Text style={styles.cellEmoji}>{e}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Button label={ko.profile.pickPhoto} variant="soft" onPress={pickPhoto} />
          )}

          <View>
            <View style={[styles.inputRow, { borderColor: hasBanned ? colors.danger : colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                value={nickname}
                onChangeText={onChangeNickname}
                placeholder={ko.profile.nicknamePlaceholder}
                placeholderTextColor={colors.textSub}
                style={[styles.input, { color: colors.text }]}
                accessibilityLabel={ko.profile.nicknamePlaceholder}
                returnKeyType="done"
                autoCorrect={false}
              />
              <Text style={{ color: colors.textSub, fontSize: fontSize.caption }}>
                {fill(ko.profile.counter, { N: count, MAX: NICKNAME_LEN.max })}
              </Text>
            </View>
            {hasBanned && <Text style={[styles.error, { color: colors.danger }]}>{errorCopy.banned_word}</Text>}
          </View>
        </ScrollView>

        <View style={styles.bottom}>
          <Button
            label={ko.profile.done}
            onPress={submit}
            disabled={!canSubmit}
            loading={saving}
            blocked={!online}
            onBlockedPress={() => toast(ko.common.offline)}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const CELL = MIN_TOUCH + spacing.sm;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.xl },
  title: { fontSize: fontSize.title + 2, fontWeight: '800' },
  avatarWrap: { alignSelf: 'center' },
  uploading: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', borderRadius: radius.button, padding: spacing.xs, alignSelf: 'center' },
  toggleItem: { minHeight: MIN_TOUCH, minWidth: 96, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, maxWidth: (CELL + spacing.xs) * AVATAR_GRID_COLUMNS, alignSelf: 'center' },
  cell: { width: CELL, height: CELL, borderRadius: radius.chip, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cellEmoji: { fontSize: fontSize.title + 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.card, paddingHorizontal: spacing.lg, minHeight: MIN_TOUCH + spacing.md },
  input: { flex: 1, fontSize: fontSize.body + 1, paddingVertical: spacing.md },
  error: { fontSize: fontSize.caption, marginTop: spacing.xs, marginLeft: spacing.sm },
  bottom: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
});
