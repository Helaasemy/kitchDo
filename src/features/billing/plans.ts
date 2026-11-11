export type KitchenPlan = 'free' | 'light' | 'pro';
export type PlanInterval = 'monthly' | 'yearly';

export type PlanLimits = {
  lists: number | null;
  people: number;
  monthKr: number;
  yearKr: number;
};

export const PLAN_LIMITS: Record<KitchenPlan, PlanLimits> = {
  free: { lists: 5, people: 1, monthKr: 0, yearKr: 0 },
  light: { lists: null, people: 2, monthKr: 30, yearKr: 300 },
  pro: { lists: null, people: 6, monthKr: 99, yearKr: 990 },
};

export function isKitchenPlan(value: string | null | undefined): value is KitchenPlan {
  return value === 'free' || value === 'light' || value === 'pro';
}

export function asKitchenPlan(value: string | null | undefined): KitchenPlan {
  return isKitchenPlan(value) ? value : 'free';
}

export function canAddList(plan: KitchenPlan, listCount: number): boolean {
  const cap = PLAN_LIMITS[plan].lists;
  if (cap == null) return true;
  return listCount < cap;
}

export function canAddPerson(plan: KitchenPlan, peopleCount: number): boolean {
  return peopleCount < PLAN_LIMITS[plan].people;
}

/** Lowest plan that fits this many people. */
export function planForPeople(peopleCount: number): KitchenPlan | null {
  if (peopleCount <= PLAN_LIMITS.free.people) return 'free';
  if (peopleCount <= PLAN_LIMITS.light.people) return 'light';
  if (peopleCount <= PLAN_LIMITS.pro.people) return 'pro';
  return null;
}

export function canDowngradeTo(
  next: KitchenPlan,
  input: { listCount: number; peopleCount: number },
): boolean {
  if (input.peopleCount > PLAN_LIMITS[next].people) return false;
  const cap = PLAN_LIMITS[next].lists;
  if (cap != null && input.listCount > cap) return false;
  return true;
}

export function isListLimitError(message: string): boolean {
  return message.toLowerCase().includes('list limit');
}

export function isPeopleLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('people limit') || lower.includes('kitchen is full');
}

export function isPlanTooSmallError(message: string): boolean {
  return message.toLowerCase().includes('plan too small');
}
