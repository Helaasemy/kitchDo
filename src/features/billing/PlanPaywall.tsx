import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { PurchasesPackage } from 'react-native-purchases';

import { Button, PaperCard, Sheet } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/i18n';

import { setKitchenPlan } from './api';
import {
  PLAN_LIMITS,
  YEARLY_OFF_PERCENT,
  asKitchenPlan,
  isPlanTooSmallError,
  type KitchenPlan,
  type PlanInterval,
} from './plans';
import {
  RC_PACKAGE_IDS,
  isPurchaseCancelled,
  loadCurrentPackages,
  planFromCustomerInfo,
  purchasePaidPlan,
  restorePaidPurchases,
  storePriceString,
} from './purchases';

export type PaywallReason = 'lists' | 'people' | 'full' | 'manage';

type Props = {
  visible: boolean;
  reason: PaywallReason;
  onClose: () => void;
  onChanged?: () => void;
};

function IntervalTabs({
  value,
  onChange,
  monthlyLabel,
  yearlyLabel,
  saveLabel,
}: {
  value: PlanInterval;
  onChange: (next: PlanInterval) => void;
  monthlyLabel: string;
  yearlyLabel: string;
  saveLabel: string;
}) {
  const theme = useTheme();
  const select = (next: PlanInterval) => {
    if (next === value) return;
    void Haptics.selectionAsync();
    onChange(next);
  };

  return (
    <View style={{ paddingTop: 10 }}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          backgroundColor: theme.colors.sand,
          borderRadius: theme.radii.pill,
          padding: 4,
          borderWidth: 0.5,
          borderColor: theme.colors.border,
        }}
      >
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: value === 'monthly' }}
          accessibilityLabel={monthlyLabel}
          onPress={() => select('monthly')}
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: theme.radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: value === 'monthly' ? theme.colors.primary : 'transparent',
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontFamily: theme.fonts.bodyBold,
              fontSize: theme.typography.caption.fontSize,
              color: value === 'monthly' ? theme.colors.onPrimary : theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {monthlyLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: value === 'yearly' }}
          accessibilityLabel={`${yearlyLabel}, ${saveLabel}`}
          onPress={() => select('yearly')}
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: theme.radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: value === 'yearly' ? theme.colors.primary : 'transparent',
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontFamily: theme.fonts.bodyBold,
              fontSize: theme.typography.caption.fontSize,
              color: value === 'yearly' ? theme.colors.onPrimary : theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {yearlyLabel}
          </Text>
        </Pressable>
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 8,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.frequency.daily.base,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.label,
            fontSize: 11,
            lineHeight: 14,
            color: '#FFFFFF',
          }}
          allowFontScaling
        >
          {saveLabel}
        </Text>
      </View>
    </View>
  );
}

export function PlanPaywall({ visible, reason, onClose, onChanged }: Props) {
  const t = useT();
  const theme = useTheme();
  const { membership, kitchenId, isAdmin, refreshOnboarding } = useAuth();
  const copy = t().billing;
  const current = asKitchenPlan(membership?.plan);
  const currentInterval = membership?.planInterval ?? 'monthly';
  const upgrade = reason === 'lists' || reason === 'people';
  const saveLabel = copy.yearlySavePercent.replace('{percent}', String(YEARLY_OFF_PERCENT));

  const preferredInterval: PlanInterval = upgrade ? 'yearly' : currentInterval;
  const [interval, setInterval] = useState<PlanInterval>(preferredInterval);
  const [sheetOpen, setSheetOpen] = useState(visible);
  const [busy, setBusy] = useState(false);
  const [packages, setPackages] = useState<Record<string, PurchasesPackage>>({});

  if (visible !== sheetOpen) {
    setSheetOpen(visible);
    if (visible) setInterval(preferredInterval);
  }

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await loadCurrentPackages();
        if (!cancelled) setPackages(next);
      } catch {
        if (!cancelled) setPackages({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

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

  const applyPlan = async (plan: KitchenPlan, nextInterval: PlanInterval | null) => {
    if (!kitchenId) return;
    await setKitchenPlan({
      kitchenId,
      plan,
      interval: plan === 'free' ? null : nextInterval,
    });
    await refreshOnboarding();
    onChanged?.();
    onClose();
  };

  const pick = async (plan: KitchenPlan) => {
    if (!kitchenId || !isAdmin || reason === 'full') return;
    setBusy(true);
    try {
      if (plan === 'free') {
        await applyPlan('free', null);
        return;
      }
      const info = await purchasePaidPlan(plan, interval);
      const next = planFromCustomerInfo(info);
      await applyPlan(next.plan, next.interval);
    } catch (e) {
      if (isPurchaseCancelled(e)) return;
      const raw = errorMessage(e);
      Alert.alert(
        t().common.errorGeneric,
        raw === 'STORE_UNAVAILABLE'
          ? copy.storeUnavailable
          : isPlanTooSmallError(raw)
            ? copy.downgradeBlocked
            : raw,
      );
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!kitchenId || !isAdmin) return;
    setBusy(true);
    try {
      const info = await restorePaidPurchases();
      const next = planFromCustomerInfo(info);
      if (next.plan === 'free') {
        Alert.alert(copy.title, copy.restoreEmpty);
        return;
      }
      await applyPlan(next.plan, next.interval);
    } catch (e) {
      if (isPurchaseCancelled(e)) return;
      const raw = errorMessage(e);
      Alert.alert(
        t().common.errorGeneric,
        raw === 'STORE_UNAVAILABLE' ? copy.storeUnavailable : raw,
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
        <IntervalTabs
          value={interval}
          onChange={setInterval}
          monthlyLabel={copy.billedMonthly}
          yearlyLabel={copy.billedYearly}
          saveLabel={saveLabel}
        />
      )}

      <View style={{ gap: theme.space.md }}>
        {plans.map((plan) => {
          const limits = PLAN_LIMITS[plan];
          const selected = plan === current;
          const highlight = plan === suggested;
          const storePrice =
            plan === 'free'
              ? null
              : storePriceString(packages[RC_PACKAGE_IDS[plan][interval]] ?? null);
          const price =
            plan === 'free'
              ? copy.priceFree
              : storePrice ??
                (interval === 'yearly'
                  ? copy.yearly.replace('{price}', String(limits.yearUsd))
                  : copy.monthly.replace('{price}', String(limits.monthUsd)));
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
      {isAdmin && reason !== 'full' ? (
        <Button
          label={copy.restorePurchases}
          variant="ghost"
          disabled={busy}
          onPress={() => void restore()}
        />
      ) : null}
    </Sheet>
  );
}
