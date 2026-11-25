/** 원형 아바타: 이모지 또는 사진 */
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { AVATAR_EMOJI_DEFAULT } from '@/constants/avatars';
import { ko, fill } from '@/copy/ko';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { size: number; emoji?: string | null; photoUri?: string | null; faded?: boolean };

export function AvatarView({ size, emoji, photoUri, faded }: Props) {
  const { colors } = useTheme();
  const shown = emoji ?? AVATAR_EMOJI_DEFAULT;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={fill(ko.profile.avatarLabel, { E: shown })}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, opacity: faded ? 0.4 : 1 },
      ]}
    >
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={{ width: size, height: size }} contentFit="cover" cachePolicy="disk" />
      ) : (
        <Text style={{ fontSize: size * 0.5 }}>{shown}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
