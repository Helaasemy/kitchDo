export type KitchenRole = 'admin' | 'member';

export type MembershipFlags = {
  role: KitchenRole;
  canComplete: boolean;
  canEditTemplates: boolean;
};

export type EffectivePermissions = {
  canComplete: boolean;
  canEditTemplates: boolean;
  canInvite: boolean;
  isAdmin: boolean;
};

export function effectivePermissions(flags: MembershipFlags): EffectivePermissions {
  if (flags.role === 'admin') {
    return {
      canComplete: true,
      canEditTemplates: true,
      canInvite: true,
      isAdmin: true,
    };
  }
  return {
    canComplete: flags.canComplete,
    canEditTemplates: flags.canEditTemplates,
    canInvite: false,
    isAdmin: false,
  };
}

/** Solo admin of a kitchen that still has other people cannot leave. */
export function canLeaveKitchen(input: {
  isAdmin: boolean;
  adminCount: number;
  memberCount: number;
}): boolean {
  if (!input.isAdmin) return true;
  if (input.memberCount <= 1) return true;
  return input.adminCount > 1;
}

export function isOnboardingComplete(input: {
  hasProfile: boolean;
  kitchenCount: number;
}): boolean {
  return input.hasProfile && input.kitchenCount > 0;
}
