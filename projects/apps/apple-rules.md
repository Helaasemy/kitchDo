# Apple rules

Shared App Store review rules. Add new ones here when Apple rejects or warns.

## Subscriptions: Terms of Use link on the product page

If the app offers auto-renewable subscriptions, every App Store localization description must include a working Terms of Use (EULA) URL.

Apple checks the product-page metadata, not the binary.

- Standard Apple EULA: put Apple's Terms of Use URL in the description for every localization.
- Custom EULA: put the hosted Terms of Use URL in the description, or add the custom EULA in App Store Connect.

These do **not** count:

- in-app Settings links
- App Review notes
- What's New
- the Privacy Policy URL field (that is a different requirement)

Do not strip this footer when editing descriptions (including when removing plan or pricing copy):

```
Privacy Policy: https://kitchdo-legal.netlify.app/privacy/
Terms of Use: https://kitchdo-legal.netlify.app/terms/
```

Guideline 3.1.2. Hit on KitchDo 1.1.0 (November 2026) after those lines were removed from the listing.
