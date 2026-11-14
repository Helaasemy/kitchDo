import { memo, useEffect } from 'react';

import { useAuth } from '@/features/auth';

import { identifyPurchasesKitchen } from './purchases';

export const PurchasesSync = memo(function PurchasesSync() {
  const { kitchenId, status } = useAuth();

  useEffect(() => {
    if (status === 'loading' || status === 'misconfigured') return;
    void identifyPurchasesKitchen(kitchenId);
  }, [status, kitchenId]);

  return null;
});
