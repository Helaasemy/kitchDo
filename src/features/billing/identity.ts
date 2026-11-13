export type PurchasesIdentityActions = {
  isConfigured: () => Promise<boolean>;
  configure: (userId: string | null) => Promise<void>;
  getAppUserID: () => Promise<string>;
  logIn: (userId: string) => Promise<void>;
  logOut: () => Promise<void>;
};

export function isAnonymousAppUserId(id: string): boolean {
  return id.startsWith('$RCAnonymousID:');
}

type Waiter = { resolve: () => void; reject: (error: unknown) => void };

/**
 * Serializes RevenueCat identity changes so configure/logIn/logOut never overlap.
 * Overlapping identify calls return HTTP 429 / backend 7638.
 */
export function createPurchasesIdentitySync(actions: PurchasesIdentityActions) {
  let queued: { userId: string | null; waiters: Waiter[] } | undefined;
  let chain: Promise<void> = Promise.resolve();

  async function apply(userId: string | null): Promise<void> {
    const configured = await actions.isConfigured();
    if (!configured) {
      await actions.configure(userId);
      return;
    }
    const current = await actions.getAppUserID();
    if (userId) {
      if (current === userId) return;
      await actions.logIn(userId);
      return;
    }
    if (!current || isAnonymousAppUserId(current)) return;
    await actions.logOut();
  }

  async function runQueued(): Promise<void> {
    const job = queued;
    queued = undefined;
    if (!job) return;
    try {
      await apply(job.userId);
      for (const waiter of job.waiters) waiter.resolve();
    } catch (error) {
      for (const waiter of job.waiters) waiter.reject(error);
    }
  }

  return {
    sync(userId: string | null): Promise<void> {
      if (!queued) queued = { userId, waiters: [] };
      else queued.userId = userId;
      const result = new Promise<void>((resolve, reject) => {
        queued?.waiters.push({ resolve, reject });
      });
      chain = chain.then(runQueued, runQueued);
      return result;
    },
  };
}
