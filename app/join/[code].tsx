/** 딥링크 gongju://join/{코드} → [B3] 코드 자동 입력 */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/join', params: { code } }} />;
}
