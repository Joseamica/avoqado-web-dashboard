# AGENTS.md

Guidelines for coding agents (ChatGPT, Claude Code, Copilot, etc.) contributing to this repository.

## ⚠️ MANDATORY: Internationalization (i18n) - NO EXCEPTIONS

**EVERY single user‑facing change MUST include complete i18n support before considering the task complete.** This applies to:

- **Component creation**: New components, pages, dialogs, modals, forms
- **Component modification**: Adding/changing buttons, labels, placeholders, tooltips, error messages  
- **UI elements**: Toasts, alerts, confirmations, loading messages, empty states
- **Data display**: Table headers, status labels, category names, action buttons
- **Form elements**: Input labels, placeholders, validation messages, submit buttons
- **Navigation**: Menu items, breadcrumbs, page titles, tab labels

**If you create ANY user-visible text without i18n support, the implementation is INCOMPLETE.**

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

## ✅ MANDATORY COMPLETION CHECKLIST (i18n)

**A task is NOT complete until ALL of these are verified:**

- [ ] **Zero hardcoded strings**: Every user‑visible text uses `t('...')` - no exceptions
- [ ] **Complete translations**: Keys exist for both `en` and `es` in `src/i18n.ts`
- [ ] **Proper interpolation**: Dynamic values use interpolation/pluralization, not concatenation
- [ ] **Meaningful translations**: Spanish translations are culturally appropriate, not literal
- [ ] **Locale formatting**: Numbers/dates/currency use `Intl.*` APIs based on `i18n.language`
- [ ] **Runtime testing**: UI manually tested in BOTH English and Spanish
- [ ] **Clean build**: `npm run build` passes without i18n-related warnings
- [ ] **No raw enums**: Status/category codes mapped to translation keys

**IMPORTANT**: If you're asked to "add a button", "create a dialog", "modify a form", etc., i18n support is automatically included in that request. Do not ask if i18n should be added - it's mandatory.

## Common i18n Implementation Examples

### ❌ WRONG - Hardcoded text:
```tsx
<Button>Save Changes</Button>
<div>Loading...</div>
<p>No items found</p>
```

### ✅ CORRECT - With i18n:
```tsx
const { t } = useTranslation()

<Button>{t('common.save_changes')}</Button>
<div>{t('common.loading')}</div>  
<p>{t('common.no_items_found')}</p>
```

### Required i18n.ts additions:
```typescript
en: {
  common: {
    save_changes: 'Save Changes',
    loading: 'Loading...',
    no_items_found: 'No items found'
  }
},
es: {
  common: {
    save_changes: 'Guardar Cambios',
    loading: 'Cargando...',
    no_items_found: 'No se encontraron elementos'
  }
}
```

## General coding notes

- Follow existing patterns and group keys within the appropriate namespace under `translation` in `src/i18n.ts`.
- Keep code minimal and avoid introducing new i18n frameworks; we standardize on `react-i18next`.
- Maintain consistency with theme and UI conventions described in `THEME-GUIDELINES.md` and `CLAUDE.md`.

