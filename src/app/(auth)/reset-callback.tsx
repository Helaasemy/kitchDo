import { Redirect } from 'expo-router';

/** In-app alias — deep link target is `/auth/callback` (`kitchdo://auth/callback`). */
export default function ResetCallbackAlias() {
  return <Redirect href="/auth/callback" />;
}
