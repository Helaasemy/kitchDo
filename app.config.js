module.exports = () => {
  const app = require('./app.json').expo;
  return {
    ...app,
    extra: {
      ...(app.extra ?? {}),
      revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
      revenueCatAppleKey: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? '',
      revenueCatTestStoreKey: process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY ?? '',
    },
  };
};
