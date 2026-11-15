# KitchDo legal site

Live on Netlify:

- Privacy: https://kitchdo-legal.netlify.app/privacy/
- Terms: https://kitchdo-legal.netlify.app/terms/
- Support: https://kitchdo-legal.netlify.app/support/

Paste the privacy and support URLs into App Store Connect before review. Terms of Use goes in the version metadata (or EULA field) as well.

Redeploy from this folder:

```bash
npx netlify-cli deploy --prod --dir=. --site 39869d9f-8560-45be-9545-44efeec6dec0
```
