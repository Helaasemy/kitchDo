import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Chip, PaperCard, Sheet } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/i18n';

import { setKitchenPlan } from './api';
import {
  PLAN_LIMITS,
  asKitchenPlan,
  isPlanTooSmallError,
  type KitchenPlan,
  type PlanInterval,
} from './plans';

export type PaywallReason = 'lists' | 'people' | 'full' | 'manage';

type Props = {
  visible: boolean;
  reason: PaywallReason;
  onClose: () => void;
  onChanged?: () => void;
};

export function PlanPaywall({ visible, reason, onClose, onChanged }: Props) {
  const t = useT();
  const theme = useTheme();
  const { membership, kitchenId, isAdmin, refreshOnboarding } = useAuth();
  const copy = t().billing;
  const current = asKitchenPlan(membership?.plan);
  const currentInterval = membership?.planInterval ?? 'monthly';
  const upgrade = reason === 'lists' || reason === 'people';

  const [interval, setInterval] = useState<PlanInterval>(currentInterval);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setInterval(upgrade ? 'yearly' : currentInterval);
  }, [visible, upgrade, currentInterval]);

  const title =
    reason === 'lists'
      ? copy.upgradeListsTitle
      : reason === 'people'
        ? copy.upgradePeopleTitle
        : reason === 'full'
          ? copy.kitchenFullTitle
          : copy.title;

  const body =
    reason === 'lists'
      ? copy.upgradeListsBody
      : reason === 'people'
        ? copy.upgradePeopleBody.replace('{cap}', String(PLAN_LIMITS[current].people))
        : reason === 'full'
          ? copy.kitchenFullBody
          : copy.ownerPays;

  const suggested: KitchenPlan | null =
    reason === 'lists' ? 'light' : reason === 'people' ? (current === 'free' ? 'light' : 'pro') : null;

  const pick = async (plan: KitchenPlan) => {
    if (!kitchenId || !isAdmin || reason === 'full') return;
    setBusy(true);
    try {
      await setKitchenPlan({
        kitchenId,
        plan,
        interval: plan === 'free' ? null : interval,
      });
      await refreshOnboarding();
      onChanged?.();
      onClose();
    } catch (e) {
      const raw = errorMessage(e);
      Alert.alert(
        t().common.errorGeneric,
        isPlanTooSmallError(raw) ? copy.downgradeBlocked : raw,
      );
    } finally {
      setBusy(false);
    }
  };

  const nameFor = (plan: KitchenPlan) =>
    plan === 'light' ? copy.light : plan === 'pro' ? copy.pro : copy.free;

  const plans: KitchenPlan[] =
    reason === 'full'
      ? ['pro']
      : reason === 'manage'
        ? ['free', 'light', 'pro']
        : ['light', 'pro'];

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <Text
        style={{
          fontFamily: theme.fonts.body,
          fontSize: theme.typography.body.fontSize,
          color: theme.colors.inkMuted,
        }}
      >
        {body}
      </Text>

      {reason === 'full' ? null : (
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <Chip
            label={copy.billedMonthly}
            selected={interval === 'monthly'}
            onPress={() => setInterval('monthly')}
          />
          <Chip
            label={copy.billedYearly}
            selected={interval === 'yearly'}
            onPress={() => setInterval('yearly')}
          />
        </View>
      )}

      <View style={{ gap: theme.space.md }}>
        {plans.map((plan) => {
          const limits = PLAN_LIMITS[plan];
          const selected = plan === current;
          const highlight = plan === suggested;
          const price =
            plan === 'free'
              ? copy.priceFree
              : interval === 'yearly'
                ? copy.yearly.replace('{price}', String(limits.yearKr))
                : copy.monthly.replace('{price}', String(limits.monthKr));
          const lists =
            limits.lists == null
              ? copy.listsUnlimited
              : copy.listsCap.replace('{count}', String(limits.lists));
          const people = copy.peopleCap.replace('{count}', String(limits.people));
          const canPress = isAdmin && reason !== 'full' && !busy;

          return (
            <Pressable
              key={plan}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: !canPress }}
              disabled={!canPress}
              onPress={() => void pick(plan)}
            >
              <PaperCard
                style={{
                  padding: theme.space.lg,
                  gap: theme.space.sm,
                  borderWidth: selected || highlight ? 1.5 : 0.5,
                  borderColor:
                    selected || highlight ? theme.colors.primary : theme.colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodyExtraBold,
                      fontSize: theme.typography.body.fontSize,
                      color: theme.colors.ink,
                    }}
                  >
                    {nameFor(plan)}
                  </Text>
                  {selected ? (
                    <Text
                      style={{
                        fontFamily: theme.fonts.label,
                        fontSize: 11,
                        color: theme.colors.primary,
                        textTransform: 'uppercase',
                      }}
                    >
                      {copy.current}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyMedium,
                    color: theme.colors.ink,
                  }}
                >
                  {price}
                </Text>
                {plan !== 'free' && interval === 'yearly' ? (
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodyMedium,
                      fontSize: theme.typography.caption.fontSize,
                      color: theme.colors.primary,
                    }}
                  >
                    {copy.yearlyDiscount}
                  </Text>
                ) : null}
                <Text
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: theme.typography.caption.fontSize,
                    color: theme.colors.inkMuted,
                  }}
                >
                  {lists} · {people}
                </Text>
              </PaperCard>
            </Pressable>
          );
        })}
      </View>

      <Text
        style={{
          fontFamily: theme.fonts.body,
          fontSize: theme.typography.caption.fontSize,
          color: theme.colors.inkMuted,
        }}
      >
        {isAdmin ? copy.testNote : copy.askOwner}
      </Text>
    </Sheet>
  );
}
