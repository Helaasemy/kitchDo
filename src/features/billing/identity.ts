export type PurchasesIdentityActions = {
  isConfigured: () => Promise<boolean>;
  configure: (kitchenId: string) => Promise<void>;
  getAppUserID: () => Promise<string>;
  logIn: (kitchenId: string) => Promise<void>;
};

type Waiter = { resolve: () => void; reject: (error: unknown) => void };

/**
 * Serializes RevenueCat identity so configure/logIn never overlap.
 * Identity is the kitchen (the billed unit). No kitchen means do nothing:
 * never configure anonymously and never logOut (both mint $RCAnonymousID customers).
 */
export function createPurchasesIdentitySync(actions: PurchasesIdentityActions) {
  let queued: { kitchenId: string | null; waiters: Waiter[] } | undefined;
  let chain: Promise<void> = Promise.resolve();

  async function apply(kitchenId: string | null): Promise<void> {
    if (!kitchenId) return;
    const configured = await actions.isConfigured();
    if (!configured) {
      await actions.configure(kitchenId);
      return;
    }
    const current = await actions.getAppUserID();
    if (current === kitchenId) return;
    await actions.logIn(kitchenId);
  }

  async function runQueued(): Promise<void> {
    const job = queued;
    queued = undefined;
    if (!job) return;
    try {
      await apply(job.kitchenId);
      for (const waiter of job.waiters) waiter.resolve();
    } catch (error) {
      for (const waiter of job.waiters) waiter.reject(error);
    }
  }

  return {
    sync(kitchenId: string | null): Promise<void> {
      if (!queued) queued = { kitchenId, waiters: [] };
      else queued.kitchenId = kitchenId;
      const result = new Promise<void>((resolve, reject) => {
        queued?.waiters.push({ resolve, reject });
      });
      chain = chain.then(runQueued, runQueued);
      return result;
    },
  };
}
