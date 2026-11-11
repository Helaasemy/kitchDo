import { useCallback, useState } from 'react';

import { useAuth } from '@/features/auth';

import { countLiveLists } from './api';
import { PlanPaywall, type PaywallReason } from './PlanPaywall';
import { asKitchenPlan, canAddList, canAddPerson, planForPeople } from './plans';

export function usePlanPaywall() {
  const { membership } = useAuth();
  const plan = asKitchenPlan(membership?.plan);
  const [reason, setReason] = useState<PaywallReason | null>(null);

  const guardList = useCallback(
    async (kitchenId: string | null) => {
      if (!kitchenId) return false;
      const n = await countLiveLists(kitchenId);
      if (canAddList(plan, n)) return true;
      setReason('lists');
      return false;
    },
    [plan],
  );

  const guardPeople = useCallback(
    (peopleCount: number) => {
      if (canAddPerson(plan, peopleCount)) return true;
      setReason(planForPeople(peopleCount + 1) ? 'people' : 'full');
      return false;
    },
    [plan],
  );

  return {
    plan,
    reason,
    openManage: () => setReason('manage'),
    openLists: () => setReason('lists'),
    openPeople: () => setReason('people'),
    guardList,
    guardPeople,
    paywall: (
      <PlanPaywall
        visible={reason != null}
        reason={reason ?? 'manage'}
        onClose={() => setReason(null)}
      />
    ),
  };
}
