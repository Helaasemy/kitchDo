import { View } from 'react-native';

import { BackLink, Screen, ScreenHeader } from '@/components/ui';
import { useTheme } from '@/design';
import { LegalBody } from '@/features/legal';
import { useT } from '@/i18n';

export default function PrivacyScreen() {
  const t = useT();
  const theme = useTheme();

  return (
    <Screen scroll>
      <View style={{ gap: theme.space.xl, paddingBottom: theme.space.xxl }}>
        <View style={{ gap: theme.space.xs }}>
          <BackLink fallback="/(app)/settings" />
          <ScreenHeader title={t().settings.privacy} />
        </View>
        <LegalBody doc="privacy" />
      </View>
    </Screen>
  );
}
