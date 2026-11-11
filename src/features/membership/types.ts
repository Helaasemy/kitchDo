import type { KitchenPlan, PlanInterval } from '@/features/billing/plans';
import type { KitchenMode } from '@/i18n';
import type { KitchenRole } from './permissions';

export type KitchenMembership = {
  kitchenId: string;
  name: string;
  mode: KitchenMode;
  ownerUserId: string;
  revision: number;
  role: KitchenRole;
  canComplete: boolean;
  canEditTemplates: boolean;
  joinedAt: string;
  plan: KitchenPlan;
  planInterval: PlanInterval | null;
};

export type KitchenMember = {
  userId: string;
  displayName: string;
  email: string | null;
  role: KitchenRole;
  canComplete: boolean;
  canEditTemplates: boolean;
  joinedAt: string;
};

export type KitchenInvite = {
  id: string;
  kitchenId: string;
  code: string;
  canComplete: boolean;
  canEditTemplates: boolean;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};
