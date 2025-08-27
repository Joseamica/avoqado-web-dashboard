# AGENTS.md

Guidelines for coding agents (ChatGPT, Claude Code, Copilot, etc.) contributing to this repository.

## Non‑negotiable: Internationalization (i18n)

Every user‑facing change (new component, page, dialog, button, label, placeholder, toast, etc.) must include i18n support.

- Use `react-i18next` (`useTranslation`) and wrap all strings with `t('...')`.
- Add keys for both English (`en`) and Spanish (`es`) in `src/i18n.ts` under the relevant group (`header`, `sidebar`, `dashboard`, `revenue`, `featureMgmt`, `venueMgmt`, `detailsView`, `categories`, `featureStatuses`).
- Use interpolation and pluralization in translations instead of string concatenation.
- Do not render raw enum or category codes; map them to translation keys.
- Format currency, numbers, and dates using locale‑aware APIs based on `i18n.language`.
- Reuse the existing language switcher at `src/components/language-switcher.tsx` when a language toggle is needed; do not add duplicates.

## How to add translations

1. Add keys to `src/i18n.ts` under both `en.translation` and `es.translation`.
2. Import `useTranslation` and replace hardcoded strings with `t('group.key')`.
3. For dynamic values, use interpolation, e.g. `t('revenue.features.meta', { count, amount })`.
4. For relative times and pluralization, prefer translation keys that account for singular/plural forms.
5. Verify both languages at runtime and ensure there are no missing keys.

## PR checklist (i18n)

- [ ] All user‑visible text uses `t('...')`
- [ ] Keys exist for `en` and `es` in `src/i18n.ts`
- [ ] Interpolation/pluralization applied where applicable
- [ ] No hardcoded strings remain in modified files
- [ ] Locale‑aware formatting used for numbers/dates/currency
- [ ] Build passes (`npm run build`) and UI verified in both languages

## General coding notes

- Follow existing patterns and group keys within the appropriate namespace under `translation` in `src/i18n.ts`.
- Keep code minimal and avoid introducing new i18n frameworks; we standardize on `react-i18next`.
- Maintain consistency with theme and UI conventions described in `THEME-GUIDELINES.md` and `CLAUDE.md`.

