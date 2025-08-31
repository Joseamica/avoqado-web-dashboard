# 🔐 Frontend Secrets Setup Guide

## Required Secrets for GitHub Actions

### Current Secrets ✅
- `CLOUDFLARE_API_TOKEN` - Already configured
- `CLOUDFLARE_ACCOUNT_ID` - Already configured
- `VITE_STAGING_API_URL` - ✅ Set to `https://avoqado-server-staging-cm35.onrender.com`
- `VITE_STAGING_FRONTEND_URL` - ✅ Set to `https://staging.dashboard.avoqado.io`
- `VITE_PRODUCTION_API_URL` - ✅ Set to `https://avoqado-server.onrender.com`
- `VITE_PRODUCTION_FRONTEND_URL` - ✅ Set to `https://app.avoqado.io`

### Missing Secrets ❌ (YOU NEED TO ADD THESE)

#### Staging Environment Secrets
```bash
# You need to find these values from your current setup and add them:
gh secret set VITE_STAGING_GOOGLE_CLIENT_ID --body "YOUR_STAGING_GOOGLE_CLIENT_ID"
gh secret set VITE_STAGING_FIREBASE_API_KEY --body "YOUR_STAGING_FIREBASE_API_KEY"
gh secret set VITE_STAGING_FIREBASE_AUTH_DOMAIN --body "YOUR_STAGING_FIREBASE_AUTH_DOMAIN"
gh secret set VITE_STAGING_FIREBASE_RECAPTCHA_SITE_KEY --body "YOUR_STAGING_RECAPTCHA_SITE_KEY"
```

#### Production Environment Secrets
```bash
# You need to find these values from your current setup and add them:
gh secret set VITE_PRODUCTION_GOOGLE_CLIENT_ID --body "YOUR_PRODUCTION_GOOGLE_CLIENT_ID"
gh secret set VITE_PRODUCTION_FIREBASE_API_KEY --body "YOUR_PRODUCTION_FIREBASE_API_KEY"
gh secret set VITE_PRODUCTION_FIREBASE_AUTH_DOMAIN --body "YOUR_PRODUCTION_FIREBASE_AUTH_DOMAIN"
gh secret set VITE_PRODUCTION_FIREBASE_RECAPTCHA_SITE_KEY --body "YOUR_PRODUCTION_RECAPTCHA_SITE_KEY"
```

## 🎯 Next Steps

1. **Get your current environment variables from the old deploy.yml**
2. **Replace placeholder values with real secrets**
3. **Run the commands above to set up secrets**
4. **Test the new CI/CD pipeline**

## 🔍 How to Find Current Values

Check your existing configuration files or ask your team for:
- Google OAuth Client IDs (staging vs production)
- Firebase configuration for both environments
- reCAPTCHA site keys for both environments