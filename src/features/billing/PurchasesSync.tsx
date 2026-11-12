import { memo, useEffect } from 'react';

import { useAuth } from '@/features/auth';

import { configurePurchases, identifyPurchasesUser } from './purchases';

export const PurchasesSync = memo(function PurchasesSync() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ready = await configurePurchases();
      if (!ready || cancelled) return;
      await identifyPurchasesUser(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return null;
});
