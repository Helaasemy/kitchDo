import { getSupabase, rpcErrorMessage } from '@/lib/supabase';

import type { KitchenPlan, PlanInterval } from './plans';

export async function countLiveLists(kitchenId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('kdo_templates')
    .select('id', { count: 'exact', head: true })
    .eq('kitchen_id', kitchenId)
    .neq('state', 'archived');
  if (error) throw new Error(rpcErrorMessage(error, 'Could not load lists.'));
  return count ?? 0;
}

export async function setKitchenPlan(input: {
  kitchenId: string;
  plan: KitchenPlan;
  interval: PlanInterval | null;
}): Promise<{ plan: KitchenPlan; interval: PlanInterval | null }> {
  const { data, error } = await getSupabase().rpc('set_kitchen_plan', {
    p_kitchen_id: input.kitchenId,
    p_plan: input.plan,
    p_interval: input.interval,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not update plan.'));
  const result = (data ?? {}) as { plan?: string; interval?: string | null };
  return {
    plan: (result.plan as KitchenPlan) ?? input.plan,
    interval: (result.interval as PlanInterval | null) ?? input.interval,
  };
}
