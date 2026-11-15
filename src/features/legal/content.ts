export type LegalDoc = 'privacy' | 'terms';

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export const LEGAL_UPDATED = '13 November 2026';
export const LEGAL_CONTACT = 'hamza93acimi@gmail.com';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'Who this is for',
    paragraphs: [
      'This policy explains how KitchDo (“we”, “us”) handles information when you use the KitchDo iPhone app. KitchDo is operated by Hamza Elaasemy.',
      `Questions: ${LEGAL_CONTACT}.`,
    ],
  },
  {
    title: 'What we collect',
    paragraphs: [
      'Account: your email address and a password stored by our auth provider. We also store the display name you choose.',
      'Kitchen data: kitchen name and type, checklists, tasks, notes, who is assigned, invite codes, and who is in the kitchen.',
      'Notifications: if you allow them, a push token so we can ping you when someone assigns you a task. Scheduled reminders stay on your phone.',
      'Purchases: Apple handles payment. We (and RevenueCat) store whether a kitchen has an active Light or Pro subscription so the app can enforce list and people caps.',
      'Device: timezone for schedules, language, and light/dark appearance. The camera is used only if you scan a join-code QR; we do not keep photos.',
    ],
  },
  {
    title: 'What we do not collect',
    paragraphs: [
      'We do not sell your data. We do not run ads. We do not use your information for tracking across other companies’ apps or websites.',
      'We do not ask for contacts, precise location, or health data.',
    ],
  },
  {
    title: 'Why we use it',
    paragraphs: [
      'To run your account and kitchens, sync checklists across devices, send assignment pings, show the right plan limits, and improve reliability of the service.',
    ],
  },
  {
    title: 'Who else sees it',
    paragraphs: [
      'Supabase hosts accounts and kitchen data. Expo delivers push notifications and app updates. RevenueCat reads Apple subscription status. Apple processes App Store payments.',
      'People you invite into a kitchen can see that kitchen’s checklists and notes. They cannot see your other kitchens.',
    ],
  },
  {
    title: 'How long we keep it',
    paragraphs: [
      'We keep it while your account exists. Delete your account in Settings to remove your KitchDo data and sign-in for this app. Backups stored only on a device stay on that device until you remove the app.',
    ],
  },
  {
    title: 'Your choices',
    paragraphs: [
      'You can edit your name and kitchen in Settings, turn reminders off, leave a kitchen, or delete your account. You can also email us at the address above.',
      'KitchDo is not directed at children under 13.',
    ],
  },
  {
    title: 'Changes',
    paragraphs: [
      `We will update this page if our practices change. Last updated ${LEGAL_UPDATED}.`,
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'The app',
    paragraphs: [
      'KitchDo is a kitchen checklist app. By creating an account you agree to these terms. If you do not agree, do not use the app.',
      'KitchDo is operated by Hamza Elaasemy. Apple’s Licensed Application End User License Agreement also applies to the iOS app.',
    ],
  },
  {
    title: 'Accounts and kitchens',
    paragraphs: [
      'You are responsible for the email and password you use to sign in, and for the checklists and notes you add.',
      'The person who creates a kitchen is its owner. The owner pays if the kitchen is on Light or Pro. People who join with a code do not pay for that kitchen.',
    ],
  },
  {
    title: 'Subscriptions',
    paragraphs: [
      'Free kitchens include a small number of lists and one person. Light and Pro are auto-renewable subscriptions billed by Apple through your Apple ID. Prices shown in the app are the prices Apple charges in your storefront.',
      'Payment is charged at confirmation of purchase. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period. Your Apple ID is charged for renewal within 24 hours prior to the end of that period.',
      'Manage or cancel in Settings → Apple ID → Subscriptions, or with Manage subscription in KitchDo. Restore purchases if you reinstall or switch phones.',
      'Downgrading is blocked until the kitchen fits the smaller plan (fewer people or lists). We do not remove people for you.',
    ],
  },
  {
    title: 'Acceptable use',
    paragraphs: [
      'Do not use KitchDo to break the law, harass others, or try to access kitchens you were not invited to. We may suspend an account that abuses the service.',
    ],
  },
  {
    title: 'Availability',
    paragraphs: [
      'The app is provided as-is. Checklists you complete offline sync when you are back online. We may change features, and we are not liable for lost notes, downtime, or indirect damages beyond what the law requires.',
    ],
  },
  {
    title: 'Contact',
    paragraphs: [
      `Questions: ${LEGAL_CONTACT}. Last updated ${LEGAL_UPDATED}.`,
    ],
  },
];

export function legalSections(doc: LegalDoc): LegalSection[] {
  return doc === 'privacy' ? PRIVACY_SECTIONS : TERMS_SECTIONS;
}
