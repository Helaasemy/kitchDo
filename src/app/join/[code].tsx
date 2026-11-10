import { useLocalSearchParams } from 'expo-router';

import { JoinScreen } from '@/features/membership/JoinScreen';

export default function JoinCodeRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const raw = Array.isArray(code) ? code[0] : code;
  return <JoinScreen initialCode={raw} />;
}
