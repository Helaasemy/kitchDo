import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import type { KitchenPlan, PlanInterval } from './plans';

const ENV_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ENV_APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? '';
const ENV_TEST_STORE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY ?? '';

export const RC_PACKAGE_IDS: Record<
  Exclude<KitchenPlan, 'free'>,
  Record<PlanInterval, string>
> = {
  light: {
    monthly: '$rc_custom_light_monthly',
    yearly: '$rc_custom_light_yearly',
  },
  pro: {
    monthly: '$rc_custom_pro_monthly',
    yearly: '$rc_custom_pro_yearly',
  },
};

function extraKey(
  name: 'revenueCatIosKey' | 'revenueCatAppleKey' | 'revenueCatTestStoreKey',
): string {
  const extra = Constants.expoConfig?.extra as
    | {
        revenueCatIosKey?: string;
        revenueCatAppleKey?: string;
        revenueCatTestStoreKey?: string;
      }
    | undefined;
  return extra?.[name]?.trim() ?? '';
}

function iosKey(): string | null {
  return extraKey('revenueCatIosKey') || ENV_IOS_KEY.trim() || null;
}

function appleKey(): string | null {
  return extraKey('revenueCatAppleKey') || ENV_APPLE_KEY.trim() || iosKey();
}

function testStoreKey(): string | null {
  const fromExtra = extraKey('revenueCatTestStoreKey') || ENV_TEST_STORE_KEY.trim();
  if (fromExtra) return fromExtra;
  const ios = iosKey();
  return ios?.startsWith('test_') ? ios : null;
}

export function revenueCatApiKey(): string | null {
  if (Platform.OS === 'web') return null;
  const testKey = testStoreKey();
  // Simulator cannot load App Store products, and expo run:ios ignores StoreKit
  // configuration files. Debug always uses Test Store when that key exists.
  if (__DEV__) return testKey || iosKey();
  if (Platform.OS === 'ios') return appleKey();
  return testKey;
}

export async function isPurchasesConfigured(): Promise<boolean> {
  try {
    return await Purchases.isConfigured();
  } catch {
    return false;
  }
}

export async function configurePurchases(): Promise<boolean> {
  const apiKey = revenueCatApiKey();
  if (!apiKey) return false;
  if (await isPurchasesConfigured()) return true;
  await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
  if (__DEV__) {
    console.log(
      '[KitchDo] RevenueCat',
      apiKey.startsWith('test_') ? 'Test Store' : 'App Store',
    );
  }
  Purchases.configure({ apiKey });
  return true;
}

export async function identifyPurchasesUser(userId: string | null): Promise<void> {
  if (!(await isPurchasesConfigured())) return;
  if (userId) {
    await Purchases.logIn(userId);
    return;
  }
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous.
  }
}

export function isPurchaseCancelled(error: unknown): boolean {
  if (typeof error !== 'object' || error == null) return false;
  const value = error as { userCancelled?: boolean; code?: string | number };
  if (value.userCancelled) return true;
  return value.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

function intervalFromProductId(productId: string): PlanInterval {
  return productId.includes('yearly') ? 'yearly' : 'monthly';
}

export function planFromCustomerInfo(info: CustomerInfo): {
  plan: KitchenPlan;
  interval: PlanInterval | null;
} {
  const pro = info.entitlements.active.pro;
  if (pro) {
    return { plan: 'pro', interval: intervalFromProductId(pro.productIdentifier) };
  }
  const light = info.entitlements.active.light;
  if (light) {
    return { plan: 'light', interval: intervalFromProductId(light.productIdentifier) };
  }
  return { plan: 'free', interval: null };
}

export async function loadCurrentPackages(): Promise<Record<string, PurchasesPackage>> {
  if (!(await isPurchasesConfigured())) {
    const ready = await configurePurchases();
    if (!ready) return {};
  }
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return {};
  const wanted = new Set(
    Object.values(RC_PACKAGE_IDS).flatMap((row) => Object.values(row)),
  );
  const packages: Record<string, PurchasesPackage> = {};
  for (const pkg of current.availablePackages) {
    if (wanted.has(pkg.identifier)) packages[pkg.identifier] = pkg;
  }
  return packages;
}

export async function getPaidPackage(
  plan: Exclude<KitchenPlan, 'free'>,
  interval: PlanInterval,
): Promise<PurchasesPackage | null> {
  const packages = await loadCurrentPackages();
  return packages[RC_PACKAGE_IDS[plan][interval]] ?? null;
}

export function storePriceString(pkg: PurchasesPackage | null): string | null {
  const price = pkg?.product.priceString?.trim();
  return price ? price : null;
}

export async function purchasePaidPlan(
  plan: Exclude<KitchenPlan, 'free'>,
  interval: PlanInterval,
): Promise<CustomerInfo> {
  const pkg = await getPaidPackage(plan, interval);
  if (!pkg) {
    throw new Error('STORE_UNAVAILABLE');
  }
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePaidPurchases(): Promise<CustomerInfo> {
  if (!(await isPurchasesConfigured())) {
    throw new Error('STORE_UNAVAILABLE');
  }
  return Purchases.restorePurchases();
}
