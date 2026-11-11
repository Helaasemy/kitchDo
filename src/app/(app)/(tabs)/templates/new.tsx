import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import {
  PlanPaywall,
  asKitchenPlan,
  canAddList,
  countLiveLists,
} from '@/features/billing';
import { newId } from '@/lib/ids';

/** Allocates a client UUID then opens the builder for a brand-new draft. */
export default function NewTemplateScreen() {
  const theme = useTheme();
  const { canEditTemplates, kitchenId, membership } = useAuth();
  const plan = asKitchenPlan(membership?.plan);
  const [paywall, setPaywall] = useState(false);
  const opened = useRef(false);
  const upgraded = useRef(false);

  useEffect(() => {
    if (!canEditTemplates) {
      router.replace('/(app)/(tabs)/templates');
      return;
    }
    if (opened.current) return;
    let cancelled = false;
    void (async () => {
      if (!kitchenId) return;
      const n = await countLiveLists(kitchenId);
      if (cancelled) return;
      if (!canAddList(plan, n)) {
        setPaywall(true);
        return;
      }
      opened.current = true;
      router.replace(`/(app)/(tabs)/templates/${newId()}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [canEditTemplates, kitchenId, plan]);

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {paywall ? null : <ActivityIndicator color={theme.colors.primary} />}
      </View>
      <PlanPaywall
        visible={paywall}
        reason="lists"
        onClose={() => {
          if (upgraded.current) return;
          setPaywall(false);
          router.replace('/(app)/(tabs)/templates');
        }}
        onChanged={() => {
          upgraded.current = true;
          opened.current = true;
          router.replace(`/(app)/(tabs)/templates/${newId()}`);
        }}
      />
    </Screen>
  );
}
