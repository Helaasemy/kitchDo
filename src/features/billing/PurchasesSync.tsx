import { memo, useEffect } from 'react';

import { useAuth } from '@/features/auth';

import { identifyPurchasesUser } from './purchases';

export const PurchasesSync = memo(function PurchasesSync() {
  const { user, status } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (status === 'loading' || status === 'misconfigured') return;
    void identifyPurchasesUser(userId);
  }, [status, userId]);

  return null;
});
