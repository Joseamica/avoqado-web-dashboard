# Settings Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sidebar's 7-item "Configuración" sub-menu with a unified two-pane Settings Hub at `/venues/:slug/settings/*` grouping "Tu cuenta" (user) vs "Este local" (venue) settings, with two entry points (sidebar single link → venue side; avatar menu → account side) and Integraciones promoted to its own section.

**Architecture:** A new routed `SettingsLayout` (left grouped nav + `<Outlet/>`) mounts under the existing `settings` path segment. Existing pages (`RolePermissions`, `BillingLayout`, `VenueActivityLog`, `VenueEditLayout` children, `VenueIntegrations`, `NotificationPreferences`) are re-parented under it — **URLs `settings/role-permissions` and `settings/billing/*` do not change**. `Account.tsx` splits into three pages (Profile / Security / Preferences). Every removed URL gets a `LegacyRedirect`.

**Tech Stack:** React 18 + React Router v6 (route objects in `src/routes/venueRoutes.tsx`), Radix UI + Tailwind semantic tokens, react-i18next, Playwright E2E with `setupApiMocks`.

## Global Constraints

- **Commits require Jose's explicit per-commit permission.** At each "Commit" step: show `git status` + proposed message, ASK, only commit after a yes. Co-Authored-By must be exactly `Claude Opus 4.6 (1M context) <noreply@anthropic.com>` (repo policy `.claude/rules/testing-and-git.md`).
- **Never break an old URL** — every removed path gets a `<LegacyRedirect>`. Old TPV/app deep links and bookmarks must keep working.
- **All user-facing text via `t()` with en + es** keys added in the same task (ESLint `no-missing-translation-keys` enforces). `es/*.json` files have a UTF-8 BOM — edit with the Edit tool (never rewrite whole file with python/jq).
- **Semantic tokens only** (`bg-muted`, `text-muted-foreground`, `border-input` for card/panel borders). No new gradients EXCEPT the mandated superadmin amber-pink accent (`from-amber-400 to-pink-500`) on SA-only elements.
- **White-label safe**: all absolute navigation via `fullBasePath` from `useCurrentVenue()`; route children are shared by `/venues/:slug` and `/wl/venues/:slug` automatically (they live in `createVenueRoutes()`).
- **Tier gating unchanged** (decision confirmed with Jose 2026-07-02: pure IA reorganization, no new capability). `VENUE_AUDIT_LOG` premium badge, `billing:read` gates etc. carry over verbatim.
- **`data-tour` attributes** (kebab-case, `settings-nav-*` scope) on every new nav item and page container.
- Feature registry: settings pages are internal/system → exempt (`src/config/feature-registry.ts` untouched). MCP + sales deck: no capability change → exempt.
- Verification commands: `npm run build`, `npm run lint`, `npx playwright test e2e/tests/settings/ --project=chromium` (E2E app locale is English).

---

### Task 1: i18n keys (en + es)

**Files:**
- Modify: `src/locales/en/settings.json` (top of file, before `"rolePermissions"`)
- Modify: `src/locales/es/settings.json` (same position)
- Modify: `src/locales/en/common.json` (inside existing `userMenu` object)
- Modify: `src/locales/es/common.json` (inside existing `userMenu` object)
- Modify: `src/locales/en/venue.json` + `src/locales/es/venue.json` (`edit.title` retitle)

**Interfaces:**
- Produces: `settings:hub.*`, `settings:preferences.*`, `settings:security.*`, `common:userMenu.settings`, updated `venue:edit.title`. Later tasks call these exact keys.

- [ ] **Step 1: Add the `hub`, `preferences` and `security` blocks to `src/locales/en/settings.json`**

Insert as the FIRST keys of the root object (keep the rest of the file intact):

```json
{
  "hub": {
    "title": "Settings",
    "back": "Back",
    "groups": {
      "account": "Your account",
      "venue": "This venue",
      "superadmin": "Superadmin"
    },
    "items": {
      "profile": "Profile",
      "security": "Security",
      "preferences": "Preferences",
      "notifications": "Notifications",
      "venueInfo": "Venue information",
      "integrations": "Integrations",
      "roles": "Roles & permissions",
      "billing": "Plan & billing",
      "activityLog": "Activity log",
      "paymentConfig": "Payment config",
      "ecommerceChannels": "E-commerce merchants",
      "merchantAccounts": "Merchant accounts"
    }
  },
  "preferences": {
    "title": "Preferences",
    "subtitle": "Language and appearance. These only apply to your account.",
    "language": {
      "label": "Language",
      "help": "The language of the dashboard for you."
    },
    "theme": {
      "label": "Theme",
      "help": "Light, dark, or follow your system."
    }
  },
  "security": {
    "title": "Security",
    "subtitle": "Your password and sign-in credentials.",
    "currentPassword": "Current password",
    "newPassword": "New password",
    "submit": "Update password"
  },
```

- [ ] **Step 2: Add the Spanish equivalents to `src/locales/es/settings.json`** (same position, Edit tool only — file has BOM)

```json
{
  "hub": {
    "title": "Configuración",
    "back": "Regresar",
    "groups": {
      "account": "Tu cuenta",
      "venue": "Este local",
      "superadmin": "Superadmin"
    },
    "items": {
      "profile": "Perfil",
      "security": "Seguridad",
      "preferences": "Preferencias",
      "notifications": "Notificaciones",
      "venueInfo": "Información del local",
      "integrations": "Integraciones",
      "roles": "Roles y permisos",
      "billing": "Plan y facturación",
      "activityLog": "Bitácora",
      "paymentConfig": "Config. de pagos",
      "ecommerceChannels": "Comercios e-commerce",
      "merchantAccounts": "Cuentas merchant"
    }
  },
  "preferences": {
    "title": "Preferencias",
    "subtitle": "Idioma y apariencia. Solo aplican a tu cuenta.",
    "language": {
      "label": "Idioma",
      "help": "El idioma del dashboard para ti."
    },
    "theme": {
      "label": "Tema",
      "help": "Claro, oscuro o seguir tu sistema."
    }
  },
  "security": {
    "title": "Seguridad",
    "subtitle": "Tu contraseña y credenciales de acceso.",
    "currentPassword": "Contraseña actual",
    "newPassword": "Contraseña nueva",
    "submit": "Actualizar contraseña"
  },
```

- [ ] **Step 3: Add `userMenu.settings` to common.json (en + es)**

In `src/locales/en/common.json`, find the `"userMenu"` object (it has `account`, `notifications`, `logout`) and add: `"settings": "Settings"`.
In `src/locales/es/common.json`, same object, add: `"settings": "Configuración"`.

- [ ] **Step 4: Retitle `edit.title` in venue.json**

- `src/locales/en/venue.json`: `edit.title` → `"Venue information"`
- `src/locales/es/venue.json`: `edit.title` → `"Información del local"`
(If the key doesn't exist in a file, add it under `edit`; the component supplies a defaultValue so nothing crashes meanwhile.)

- [ ] **Step 5: Verify lint + build pass**

Run: `npm run lint && npm run build`
Expected: both green (ESLint validates key existence only for keys referenced in code; nothing references the new keys yet, and JSON syntax is validated by the build).

- [ ] **Step 6: Commit (ASK JOSE FIRST)**

```bash
git add src/locales/en/settings.json src/locales/es/settings.json src/locales/en/common.json src/locales/es/common.json src/locales/en/venue.json src/locales/es/venue.json
git commit -m "feat(settings-hub): i18n keys for unified settings hub (en/es)"
```

---

### Task 2: Split Account.tsx into Profile / Security / Preferences pages

**Files:**
- Create: `src/pages/Account/ProfileSettings.tsx`
- Create: `src/pages/Account/SecuritySettings.tsx`
- Create: `src/pages/Account/PreferenceSettings.tsx`
- Modify: `src/routes/lazyComponents.ts:37` (keep `Account` export for now — removed in Task 4; add 3 new exports below it)
- Reference (do not modify yet): `src/pages/Account/Account.tsx` — source of the moved code

**Interfaces:**
- Consumes: `api` (`@/api`), `useAuth`, `useCurrentVenue`, `useVenueDateTime`, `googleCalendarService`, `GoogleCalendarConnectionCard`, `LanguageSwitcher` (`@/components/language-switcher`, default export), `ThemeToggle` (`@/components/theme-toggle`, named export), i18n keys from Task 1.
- Produces: default-exported components `ProfileSettings`, `SecuritySettings`, `PreferenceSettings`; lazy exports of the same names in `lazyComponents.ts`. Task 4's routes import these exact names.

- [ ] **Step 1: Create `src/pages/Account/ProfileSettings.tsx`**

This is `Account.tsx` minus the password section/dialog. Copy the existing file and apply exactly these changes — the result:

```tsx
import api from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { User, Mail, Shield, Calendar, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useVenueDateTime } from '@/utils/datetime'
import googleCalendarService from '@/services/googleCalendar.service'
import { GoogleCalendarConnectionCard } from '@/pages/GoogleCalendar/components/GoogleCalendarConnectionCard'

export default function ProfileSettings() {
  const { t } = useTranslation(['account', 'common'])
  const { t: tGcal } = useTranslation('googleCalendar')
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const { formatDate, formatDateTime } = useVenueDateTime()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const currentVenue = user?.venues?.find((v: any) => v.id === venueId)
  const currentPin = currentVenue?.pin || ''

  const { data: gcalConnectionsData, isLoading: gcalLoading } = useQuery({
    queryKey: ['google-calendar', 'connections'],
    queryFn: () => googleCalendarService.listConnections(),
  })
  const personalGoogleCalendarConnection =
    gcalConnectionsData?.connections.find(
      c => c.scope === 'STAFF_PERSONAL' && c.staffId === user?.id && c.status !== 'DISCONNECTED',
    ) ?? null

  const profileForm = useForm({
    defaultValues: {
      email: user?.email || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
      pin: currentPin,
    },
  })

  const editProfile = useMutation({
    mutationFn: async (formValues: any) => {
      const payload: any = { id: user?.id }
      if (formValues.firstName) payload.firstName = formValues.firstName
      if (formValues.lastName) payload.lastName = formValues.lastName
      if (formValues.email) payload.email = formValues.email
      if (formValues.phone) payload.phone = formValues.phone
      if (formValues.pin !== undefined) payload.pin = formValues.pin || null
      const response = await api.patch(`/api/v1/dashboard/${venueId}/account`, payload)
      return response.data
    },
    onSuccess: () => {
      toast({ title: t('toast.success.title'), description: t('toast.success.description') })
      queryClient.invalidateQueries({ queryKey: ['user'] })
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.message || t('toast.error.description'),
        variant: 'destructive',
      })
    },
  })

  return (
    <div className="p-6" data-tour="settings-profile-page">
      <div className="mb-6">
        <PageTitleWithInfo
          title={
            <>
              <User className="h-6 w-6" />
              <span>{t('title')}</span>
            </>
          }
          className="text-2xl font-semibold flex items-center gap-2"
          tooltip={t('info.page', {
            defaultValue: 'Administra tus datos de cuenta, perfil y credenciales.',
          })}
        />
        <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="border-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('accountInfo.title')}
              </CardTitle>
              <CardDescription>{t('accountInfo.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('accountInfo.email')}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('accountInfo.role')}</p>
                  <Badge variant="secondary">{user?.role}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('accountInfo.memberSince')}</p>
                  <p className="text-sm text-muted-foreground">{user?.createdAt ? formatDate(user.createdAt) : 'N/A'}</p>
                </div>
              </div>
              {user?.lastLogin && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t('accountInfo.lastLogin')}</p>
                    <p className="text-sm text-muted-foreground">{formatDateTime(user.lastLogin)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-input">
            <CardHeader>
              <CardTitle>{t('editProfile.title')}</CardTitle>
              <CardDescription>{t('editProfile.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(v => editProfile.mutate(v))} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={profileForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('editProfile.firstName')}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={editProfile.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('editProfile.lastName')}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={editProfile.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('editProfile.email')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" disabled={editProfile.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('editProfile.phone')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" disabled={editProfile.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="pin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4" />
                          {t('editProfile.pin', { defaultValue: 'PIN de acceso TPV' })}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={10}
                            placeholder={t('editProfile.pinPlaceholder', { defaultValue: '4-10 dígitos' })}
                            disabled={editProfile.isPending}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {t('editProfile.pinHelp', {
                            defaultValue: 'Este PIN te permite iniciar sesión rápidamente en las terminales de cobro (TPV).',
                          })}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-4">
                    <Button type="submit" disabled={editProfile.isPending}>
                      {editProfile.isPending ? t('common:saving') : t('common:save')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => profileForm.reset()} disabled={editProfile.isPending}>
                      {t('common:cancel')}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{tGcal('personal.title')}</h2>
          <p className="text-sm text-muted-foreground">{tGcal('personal.description')}</p>
        </div>
        <GoogleCalendarConnectionCard
          variant="personal"
          connection={personalGoogleCalendarConnection}
          isLoading={gcalLoading}
          requiredPermission="calendar:connect_self"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/pages/Account/SecuritySettings.tsx`** (password form inline — no dialog needed now that it has its own page)

```tsx
import api from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function SecuritySettings() {
  const { t } = useTranslation(['settings', 'account', 'common'])
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const { toast } = useToast()

  const passwordForm = useForm({
    defaultValues: { old_password: '', password: '' },
  })

  const changePassword = useMutation({
    mutationFn: async (formValues: { old_password: string; password: string }) => {
      const payload = { id: user?.id, old_password: formValues.old_password, password: formValues.password }
      const response = await api.patch(`/api/v1/dashboard/${venueId}/account`, payload)
      return response.data
    },
    onSuccess: () => {
      toast({ title: t('account:toast.success.title'), description: t('account:toast.success.description') })
      passwordForm.reset()
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.message || t('account:toast.error.description'),
        variant: 'destructive',
      })
    },
  })

  return (
    <div className="p-6 max-w-2xl" data-tour="settings-security-page">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Lock className="h-6 w-6" />
          {t('settings:security.title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('settings:security.subtitle')}</p>
      </div>

      <Card className="border-input">
        <CardHeader>
          <CardTitle>{t('account:password.title')}</CardTitle>
          <CardDescription>{t('account:password.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(v => changePassword.mutate(v))} className="space-y-6">
              <FormField
                control={passwordForm.control}
                name="old_password"
                rules={{ required: t('account:password.dialog.currentPasswordRequired') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings:security.currentPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="password"
                rules={{ required: t('account:password.dialog.newPasswordRequired') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings:security.newPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? t('common:saving') : t('settings:security.submit')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/pages/Account/PreferenceSettings.tsx`** (reuses the existing switcher components — zero new preference logic)

```tsx
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import LanguageSwitcher from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'

export default function PreferenceSettings() {
  const { t } = useTranslation('settings')

  return (
    <div className="p-6 max-w-2xl" data-tour="settings-preferences-page">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6" />
          {t('preferences.title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('preferences.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-input divide-y divide-border">
        <div className="flex items-center justify-between gap-6 p-4">
          <div>
            <p className="text-sm font-medium">{t('preferences.language.label')}</p>
            <p className="text-sm text-muted-foreground">{t('preferences.language.help')}</p>
          </div>
          <LanguageSwitcher />
        </div>
        <div className="flex items-center justify-between gap-6 p-4">
          <div>
            <p className="text-sm font-medium">{t('preferences.theme.label')}</p>
            <p className="text-sm text-muted-foreground">{t('preferences.theme.help')}</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add lazy exports in `src/routes/lazyComponents.ts`** (below line 37's `Account` export — keep `Account` itself until Task 4)

```ts
export const ProfileSettings = lazyWithRetry(() => import('@/pages/Account/ProfileSettings'))
export const SecuritySettings = lazyWithRetry(() => import('@/pages/Account/SecuritySettings'))
export const PreferenceSettings = lazyWithRetry(() => import('@/pages/Account/PreferenceSettings'))
```

- [ ] **Step 5: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: green. (New pages compile even though unrouted; `check:unused` would flag them — that check runs at the end of Task 7, after routing.)

- [ ] **Step 6: Commit (ASK JOSE FIRST)**

```bash
git add src/pages/Account/ProfileSettings.tsx src/pages/Account/SecuritySettings.tsx src/pages/Account/PreferenceSettings.tsx src/routes/lazyComponents.ts
git commit -m "feat(settings-hub): split Account into Profile/Security/Preferences pages"
```

---

### Task 3: SettingsLayout + redirect helpers

**Files:**
- Create: `src/pages/Settings/SettingsLayout.tsx`
- Create: `src/routes/LegacyRedirect.tsx`
- Create: `src/routes/SettingsIndexRedirect.tsx`
- Modify: `src/routes/lazyComponents.ts` (add `SettingsLayout` lazy export)

**Interfaces:**
- Consumes: `useAccess()` → `{ can, role, isWhiteLabelEnabled, canFeature }` (`src/hooks/use-access.ts:42-107`), `useVenueTier()` → `{ hasFeatureAccess }` (`src/hooks/use-tier-feature-access`), `useCurrentVenue()` → `{ fullBasePath }`, i18n `settings:hub.*` from Task 1.
- Produces: default export `SettingsLayout`; default export `SettingsIndexRedirect` (own eager file); default export `LegacyRedirect({ to: string })`. Task 4's routes use all three.

- [ ] **Step 1: Create the two eager route helpers**

`src/routes/LegacyRedirect.tsx`:

```tsx
import { Navigate } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'

/**
 * Redirects a legacy venue-scoped path to its new home, preserving
 * white-label mode via fullBasePath. `to` is relative to the venue root
 * (e.g. "settings/profile").
 */
export default function LegacyRedirect({ to }: { to: string }) {
  const { fullBasePath } = useCurrentVenue()
  return <Navigate to={`${fullBasePath}/${to}`} replace />
}
```

`src/routes/SettingsIndexRedirect.tsx`:

```tsx
import { Navigate } from 'react-router-dom'
import { useAccess } from '@/hooks/use-access'

const ADMIN_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN']

/** Index of /settings — admins land on the venue side, others on their account. */
export default function SettingsIndexRedirect() {
  const { role, isLoading } = useAccess()
  if (isLoading) return null
  return <Navigate to={ADMIN_ROLES.includes(role ?? '') ? 'local' : 'profile'} replace />
}
```

- [ ] **Step 2: Create `src/pages/Settings/SettingsLayout.tsx`**

```tsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Bell,
  CreditCard,
  Link2,
  Lock,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Star,
  Store,
  User,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAccess } from '@/hooks/use-access'
import { useVenueTier } from '@/hooks/use-tier-feature-access'
import { cn } from '@/lib/utils'

interface HubItem {
  to: string
  label: string
  icon: LucideIcon
  dataTour: string
  /** Show the tier Star badge (gating itself stays inside the page) */
  premiumLocked?: boolean
  /** Absolute link that leaves the hub (superadmin tools) */
  external?: boolean
}

const ADMIN_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN']

function HubNavLink({ item }: { item: HubItem }) {
  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
      isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    )
  return (
    <NavLink to={item.to} className={linkClasses} data-tour={item.dataTour}>
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.premiumLocked && <Star className="ml-auto h-3.5 w-3.5 shrink-0 text-green-500" />}
    </NavLink>
  )
}

export default function SettingsLayout() {
  const { t } = useTranslation('settings')
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { can, role, isWhiteLabelEnabled, canFeature } = useAccess()
  const { hasFeatureAccess } = useVenueTier()

  const isAdmin = ADMIN_ROLES.includes(role ?? '')
  const showVenueGroup = !isWhiteLabelEnabled || canFeature('AVOQADO_SETTINGS')

  const accountItems: HubItem[] = [
    { to: 'profile', label: t('hub.items.profile'), icon: User, dataTour: 'settings-nav-profile' },
    { to: 'security', label: t('hub.items.security'), icon: Lock, dataTour: 'settings-nav-security' },
    { to: 'preferences', label: t('hub.items.preferences'), icon: SlidersHorizontal, dataTour: 'settings-nav-preferences' },
    { to: 'notifications', label: t('hub.items.notifications'), icon: Bell, dataTour: 'settings-nav-notifications' },
  ]

  const venueItems: HubItem[] = showVenueGroup
    ? [
        ...(isAdmin
          ? [
              { to: 'local', label: t('hub.items.venueInfo'), icon: Store, dataTour: 'settings-nav-venue-info' },
              { to: 'integrations', label: t('hub.items.integrations'), icon: Link2, dataTour: 'settings-nav-integrations' },
              { to: 'role-permissions', label: t('hub.items.roles'), icon: Shield, dataTour: 'settings-nav-roles' },
            ]
          : []),
        ...(isAdmin && can('billing:read')
          ? [{ to: 'billing', label: t('hub.items.billing'), icon: CreditCard, dataTour: 'settings-nav-billing' }]
          : []),
        ...(can('activity:read')
          ? [
              {
                to: 'activity-log',
                label: t('hub.items.activityLog'),
                icon: ScrollText,
                dataTour: 'settings-nav-activity-log',
                premiumLocked: !hasFeatureAccess('VENUE_AUDIT_LOG'),
              },
            ]
          : []),
      ]
    : []

  const superadminItems: HubItem[] =
    role === 'SUPERADMIN'
      ? [
          { to: `${fullBasePath}/payment-config`, label: t('hub.items.paymentConfig'), icon: Shield, dataTour: 'settings-nav-sa-payment-config', external: true },
          { to: `${fullBasePath}/ecommerce-merchants`, label: t('hub.items.ecommerceChannels'), icon: Shield, dataTour: 'settings-nav-sa-ecommerce', external: true },
          { to: `${fullBasePath}/merchant-accounts`, label: t('hub.items.merchantAccounts'), icon: Shield, dataTour: 'settings-nav-sa-merchants', external: true },
        ]
      : []

  const groups = [
    { key: 'account', label: t('hub.groups.account'), items: accountItems, superadmin: false },
    { key: 'venue', label: t('hub.groups.venue'), items: venueItems, superadmin: false },
    { key: 'superadmin', label: t('hub.groups.superadmin'), items: superadminItems, superadmin: true },
  ].filter(g => g.items.length > 0)

  const nav = (
    <>
      {groups.map(group => (
        <div key={group.key} className="mb-4">
          <p
            className={cn(
              'px-2.5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider',
              group.superadmin
                ? 'bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent'
                : 'text-muted-foreground/70',
            )}
          >
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map(item => (
              <HubNavLink key={item.to} item={item} />
            ))}
          </div>
        </div>
      ))}
    </>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop nav */}
      <aside className="hidden w-60 shrink-0 border-r border-border px-3 py-4 md:block" data-tour="settings-hub-nav">
        <Button
          variant="ghost"
          className="mb-2 w-full justify-start gap-2 px-2.5 font-semibold"
          onClick={() => navigate(`${fullBasePath}/home`)}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('hub.title')}
        </Button>
        {nav}
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile nav: horizontal scroll strip */}
        <div className="border-b border-border px-2 py-2 md:hidden">
          <div className="flex items-center gap-1 overflow-x-auto">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(`${fullBasePath}/home`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {groups.flatMap(g => g.items).map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-full px-3 py-1.5 text-sm',
                    isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        <Outlet />
      </div>
    </div>
  )
}
```

Note: `bg-gradient-to-r from-amber-400 to-pink-500` on the SA label is the mandated superadmin accent from `.claude/rules/ui-patterns.md` — the one sanctioned gradient.

- [ ] **Step 3: Add the lazy export in `src/routes/lazyComponents.ts`** (next to the Task 2 exports)

```ts
export const SettingsLayout = lazyWithRetry(() => import('@/pages/Settings/SettingsLayout'))
```

`SettingsIndexRedirect` and `LegacyRedirect` are imported eagerly in Task 4 (tiny components, no lazy needed):

- [ ] **Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: green.

- [ ] **Step 5: Commit (ASK JOSE FIRST)**

```bash
git add src/pages/Settings/SettingsLayout.tsx src/routes/LegacyRedirect.tsx src/routes/SettingsIndexRedirect.tsx src/routes/lazyComponents.ts
git commit -m "feat(settings-hub): two-pane SettingsLayout + route redirect helpers"
```

---

### Task 4: Route rewiring + legacy redirects (E2E-first)

**Files:**
- Create: `e2e/tests/settings/settings-hub.spec.ts`
- Modify: `src/routes/venueRoutes.tsx` (blocks at lines ~161 `account`, ~411-435 `edit`, ~589-595 `activity-log`, ~629-673 `settings/*`)
- Modify: `src/routes/lazyComponents.ts:37` (remove the `Account` export)
- Delete: `src/pages/Account/Account.tsx`

**Interfaces:**
- Consumes: `SettingsLayout` (lazy, from `lazyComponents`), `ProfileSettings` / `SecuritySettings` / `PreferenceSettings` (lazy, Task 2), and the eager helpers `import LegacyRedirect from './LegacyRedirect'` + `import SettingsIndexRedirect from './SettingsIndexRedirect'` (Task 3).
- Produces: final URL map (below). Task 5/6 rely on `settings/local/*` and `settings/profile` existing.

**Final URL map (canonical → renders):**

| URL (under venue base) | Renders | Guard |
|---|---|---|
| `settings` | index → `local` (admins) / `profile` (others) | — |
| `settings/profile` | ProfileSettings | — |
| `settings/security` | SecuritySettings | — |
| `settings/preferences` | PreferenceSettings | — |
| `settings/notifications` | NotificationPreferences | — |
| `settings/local/{basic-info,contact-images,documents,chat}` | VenueEditLayout children | ADMIN |
| `settings/integrations` (+`/google`) | VenueIntegrations / GoogleIntegration | ADMIN |
| `settings/role-permissions` | RolePermissions | ADMIN (unchanged URL) |
| `settings/billing/*` | BillingLayout children | ADMIN + billing perms (unchanged URL) |
| `settings/activity-log` | VenueActivityLog | `activity:read` |
| `account`, `edit/*`, `activity-log` | LegacyRedirect | — |

- [ ] **Step 1: Write the failing E2E spec `e2e/tests/settings/settings-hub.spec.ts`**

```ts
/**
 * E2E — Settings Hub (/venues/:slug/settings/*).
 *
 * Covers: index redirect by role, grouped nav rendering, section
 * navigation, and legacy-URL redirects (account, edit/*, activity-log).
 * Entry points (sidebar + avatar menu) are covered in Task 6's additions.
 * App E2E locale is English.
 */
import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const SETTINGS_VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Restaurante Alpha',
  slug: 'venue-alpha',
  permissions: [
    'home:read',
    'venues:read', 'venues:update',
    'settings:read', 'settings:update',
    'activity:read',
    'billing:read', 'billing:subscriptions:read',
  ],
})

test.describe('Settings hub', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [SETTINGS_VENUE] })
  })

  test('settings index redirects admins to venue info and shows both groups', async ({ page }) => {
    await page.goto('/venues/venue-alpha/settings')
    await page.waitForURL('**/venues/venue-alpha/settings/local/basic-info', { timeout: 15_000 })
    await expect(page.locator('[data-tour="settings-nav-profile"]')).toBeVisible()
    await expect(page.locator('[data-tour="settings-nav-venue-info"]')).toBeVisible()
    await expect(page.locator('[data-tour="settings-nav-integrations"]')).toBeVisible()
    await expect(page.locator('[data-tour="settings-nav-billing"]')).toBeVisible()
  })

  test('hub nav navigates between account and venue sections', async ({ page }) => {
    await page.goto('/venues/venue-alpha/settings')
    await page.waitForURL('**/settings/local/basic-info', { timeout: 15_000 })

    await page.locator('[data-tour="settings-nav-profile"]').click()
    await page.waitForURL('**/settings/profile')
    await expect(page.locator('[data-tour="settings-profile-page"]')).toBeVisible()

    await page.locator('[data-tour="settings-nav-preferences"]').click()
    await page.waitForURL('**/settings/preferences')
    await expect(page.locator('[data-tour="settings-preferences-page"]')).toBeVisible()

    await page.locator('[data-tour="settings-nav-integrations"]').click()
    await page.waitForURL('**/settings/integrations')
  })

  test('legacy URLs redirect to their new homes', async ({ page }) => {
    await page.goto('/venues/venue-alpha/account')
    await page.waitForURL('**/venues/venue-alpha/settings/profile', { timeout: 15_000 })

    await page.goto('/venues/venue-alpha/edit')
    await page.waitForURL('**/venues/venue-alpha/settings/local/basic-info')

    await page.goto('/venues/venue-alpha/edit/contact-images')
    await page.waitForURL('**/venues/venue-alpha/settings/local/contact-images')

    await page.goto('/venues/venue-alpha/edit/integrations')
    await page.waitForURL('**/venues/venue-alpha/settings/integrations')

    await page.goto('/venues/venue-alpha/activity-log')
    await page.waitForURL('**/venues/venue-alpha/settings/activity-log')
  })
})
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx playwright test e2e/tests/settings/settings-hub.spec.ts --project=chromium`
Expected: FAIL (`waitForURL` timeout — `/settings` doesn't exist yet).

- [ ] **Step 3: Rewire `src/routes/venueRoutes.tsx`**

Imports: in the `from './lazyComponents'` list, remove `Account`, add `SettingsLayout`, `ProfileSettings`, `SecuritySettings`, `PreferenceSettings`. Add eager imports:

```tsx
import LegacyRedirect from './LegacyRedirect'
import SettingsIndexRedirect from './SettingsIndexRedirect'
```

(a) Replace line 161 `{ path: 'account', element: <Account /> },` with:

```tsx
    // Legacy: account page moved into the Settings Hub
    { path: 'account', element: <LegacyRedirect to="settings/profile" /> },
```

(b) Replace the whole `edit` block (lines ~411-435) with legacy redirects:

```tsx
    // Legacy: venue edit moved into the Settings Hub (settings/local + settings/integrations)
    {
      path: 'edit',
      children: [
        { index: true, element: <LegacyRedirect to="settings/local/basic-info" /> },
        { path: 'basic-info', element: <LegacyRedirect to="settings/local/basic-info" /> },
        { path: 'general', element: <LegacyRedirect to="settings/local/basic-info" /> },
        { path: 'contact-images', element: <LegacyRedirect to="settings/local/contact-images" /> },
        { path: 'documents', element: <LegacyRedirect to="settings/local/documents" /> },
        { path: 'chat', element: <LegacyRedirect to="settings/local/chat" /> },
        { path: 'integrations', element: <LegacyRedirect to="settings/integrations" /> },
        { path: 'integrations/google', element: <LegacyRedirect to="settings/integrations/google" /> },
      ],
    },
```

(c) Replace the `activity-log` block (lines ~589-595) with:

```tsx
    // Legacy: activity log moved into the Settings Hub
    { path: 'activity-log', element: <LegacyRedirect to="settings/activity-log" /> },
```

(d) Replace BOTH the `settings/role-permissions` block (~629-634) AND the `settings/billing` block (~636-673) with ONE `settings` parent (billing's inner children are moved verbatim — only the outer `path` changes from `'settings/billing'` to `'billing'`):

```tsx
    // ── Settings Hub — "Tu cuenta" + "Este local" in one two-pane layout ──
    {
      path: 'settings',
      element: <SettingsLayout />,
      children: [
        { index: true, element: <SettingsIndexRedirect /> },

        // Tu cuenta (no special permission — mirrors the old /account route)
        { path: 'profile', element: <ProfileSettings /> },
        { path: 'security', element: <SecuritySettings /> },
        { path: 'preferences', element: <PreferenceSettings /> },
        { path: 'notifications', element: <NotificationPreferences /> },

        // Este local — venue information (ex /edit, minus integrations)
        {
          path: 'local',
          element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
          children: [
            {
              element: <VenueEditLayout />,
              children: [
                { index: true, element: <Navigate to="basic-info" replace /> },
                { path: 'basic-info', element: <BasicInfo /> },
                { path: 'contact-images', element: <ContactImages /> },
                { path: 'documents', element: <VenueDocuments /> },
                { path: 'chat', element: <VenueChat /> },
              ],
            },
          ],
        },

        // Este local — integrations, promoted to its own section
        {
          path: 'integrations',
          element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
          children: [
            { index: true, element: <VenueIntegrations /> },
            { path: 'google', element: <GoogleIntegration /> },
          ],
        },

        // Este local — roles (URL unchanged: settings/role-permissions)
        {
          path: 'role-permissions',
          element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
          children: [{ index: true, element: <RolePermissions /> }],
        },

        // Este local — billing (URL unchanged: settings/billing/*) — inner block moved VERBATIM from the old settings/billing route
        {
          path: 'billing',
          element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
          children: [
            {
              element: <PermissionProtectedRoute permission="billing:read" />,
              children: [
                {
                  element: <BillingLayout />,
                  children: [
                    { index: true, element: <Navigate to="subscriptions" replace /> },
                    {
                      path: 'subscriptions',
                      element: <PermissionProtectedRoute permission="billing:subscriptions:read" />,
                      children: [{ index: true, element: <BillingSubscriptions /> }],
                    },
                    {
                      path: 'history',
                      element: <PermissionProtectedRoute permission="billing:history:read" />,
                      children: [{ index: true, element: <BillingHistory /> }],
                    },
                    {
                      path: 'payment-methods',
                      element: <PermissionProtectedRoute permission="billing:payment-methods:read" />,
                      children: [{ index: true, element: <BillingPaymentMethods /> }],
                    },
                    {
                      path: 'tokens',
                      element: <PermissionProtectedRoute permission="billing:tokens:read" />,
                      children: [{ index: true, element: <BillingTokens /> }],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Este local — activity log (page self-gates with FeatureGate VENUE_AUDIT_LOG)
        {
          path: 'activity-log',
          element: <PermissionProtectedRoute permission="activity:read" />,
          children: [{ index: true, element: <VenueActivityLog /> }],
        },
      ],
    },
```

(e) Delete `src/pages/Account/Account.tsx` and remove `export const Account = ...` from `lazyComponents.ts:37`.

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx playwright test e2e/tests/settings/settings-hub.spec.ts --project=chromium`
Expected: 3/3 PASS. If `legacy URLs` fails on `edit/*`: check `LegacyRedirect` renders inside the venue route context (it must — it's a child of the venue base route, so `useCurrentVenue` resolves).

- [ ] **Step 5: Verify no regressions in existing suites**

Run: `npm run build && npm run lint && npm run test:e2e`
Expected: all green — especially `e2e/tests/billing/*` (billing URLs unchanged, now rendered inside the hub frame).

- [ ] **Step 6: Commit (ASK JOSE FIRST)**

```bash
git add e2e/tests/settings/settings-hub.spec.ts src/routes/venueRoutes.tsx src/routes/lazyComponents.ts src/routes/SettingsIndexRedirect.tsx src/pages/Settings/SettingsLayout.tsx
git rm src/pages/Account/Account.tsx
git commit -m "feat(settings-hub): mount hub routes, promote integrations, legacy redirects"
```

---

### Task 5: Adapt VenueEditLayout to live inside the hub

**Files:**
- Modify: `src/pages/Venue/VenueEditLayout.tsx:1-10` (imports), `:74-86` (header), `:139-148` (tabs)

**Interfaces:**
- Consumes: routes `settings/local/*` from Task 4; `venue:edit.title` retitled in Task 1.
- Produces: nothing new — children (`BasicInfo` etc.) are untouched.

- [ ] **Step 1: Remove the back arrow (the hub nav owns "back" now)**

Delete the `ArrowLeft` import (line 4), the `useNavigate` import usage if now unused, and the back `<Button>` (lines 76-78). The header keeps `PageTitleWithInfo` only:

```tsx
          <div className="space-x-3 flex items-center">
            <PageTitleWithInfo
              title={t('edit.title', { defaultValue: 'Información del local' })}
              className="text-xl font-semibold text-foreground"
              tooltip={t('info.edit', {
                defaultValue: 'Actualiza datos del venue, documentos e integraciones.',
              })}
            />
          </div>
```

(If `navigate`/`fullBasePath` remain used only by NavTabs, keep `useCurrentVenue`; remove `useNavigate` entirely.)

- [ ] **Step 2: Retarget the tabs and drop the Integrations tab** (lines 139-148)

```tsx
        <NavTabs
          className="sticky top-14 bg-background h-14 z-10"
          items={[
            { to: `${fullBasePath}/settings/local/basic-info`, label: t('edit.nav.basicInfo', { defaultValue: 'Información Básica' }) },
            { to: `${fullBasePath}/settings/local/contact-images`, label: t('edit.nav.contactImages', { defaultValue: 'Contacto e Imágenes' }) },
            { to: `${fullBasePath}/settings/local/documents`, label: t('edit.nav.documents', { defaultValue: 'Documentación' }) },
            { to: `${fullBasePath}/settings/local/chat`, label: t('edit.nav.chat', { defaultValue: 'Chat con clientes' }) },
          ]}
        />
```

- [ ] **Step 3: Fix internal navigations that still point at `edit/`**

Run: `grep -rn "edit/integrations\|/edit/basic-info\|/edit/contact-images\|/edit/documents\|/edit/chat\|}/edit\`" src/ --include="*.tsx" --include="*.ts" | grep -v routes/ | grep -v "\.test\."`
For every hit in page/component code (e.g. Home setup checklist steps, KYC prompts, integration CTAs), replace the target with the new `settings/...` path using the same `fullBasePath` prefix pattern the file already uses. The legacy redirects make old links WORK, but in-app links should point at canonical URLs. List each changed file in the commit body.

- [ ] **Step 4: Verify**

Run: `npm run build && npm run lint && npx playwright test e2e/tests/settings/settings-hub.spec.ts --project=chromium`
Expected: green (the hub spec's nav test still passes; tabs now stay inside `settings/local/*` without bouncing through redirects).

- [ ] **Step 5: Commit (ASK JOSE FIRST)**

```bash
git add src/pages/Venue/VenueEditLayout.tsx <files-from-step-3>
git commit -m "refactor(settings-hub): VenueEditLayout lives inside the hub; canonical links"
```

---

### Task 6: Entry points — sidebar single link + avatar menu

**Files:**
- Modify: `src/components/Sidebar/app-sidebar.tsx:580-623` (delete `settingsSubItems`), `:785-790` (single-link push), `:810` (delete sub-sidebar registration)
- Modify: `src/components/Sidebar/nav-user.tsx:3` (icons), `:84-89` (menu item)
- Modify: `e2e/tests/settings/settings-hub.spec.ts` (append entry-point test)

**Interfaces:**
- Consumes: route `settings` (Task 4), `common:userMenu.settings` (Task 1), existing `canWL` (app-sidebar.tsx:308) and `isWhiteLabelVenue`.
- Produces: final UX. Nothing downstream.

- [ ] **Step 1: Append the failing entry-point test to `settings-hub.spec.ts`**

```ts
  test('sidebar link and avatar menu both enter the hub', async ({ page }) => {
    await page.goto('/venues/venue-alpha/home')

    // Entry 1: sidebar "Configuración" — single link straight to the hub (admin → venue side)
    await page.getByRole('button', { name: /settings|configuración/i }).first().click()
    await page.waitForURL('**/settings/local/basic-info', { timeout: 15_000 })

    // Entry 2: avatar menu → Configuración → account side
    await page.goto('/venues/venue-alpha/home')
    await page.getByText('owner@test.com').first().click()
    await page.locator('[data-tour="user-menu-settings"]').click()
    await page.waitForURL('**/settings/profile')
  })
```

Run: `npx playwright test e2e/tests/settings/settings-hub.spec.ts --project=chromium`
Expected: new test FAILS (sidebar still opens the sub-sidebar; menu item still says "Cuenta"). Note: if the sidebar item renders as a link not a button, adjust the role in the selector after inspecting — NavMain renders `SidebarMenuButton`; direct-link items (like `tpv`) render as links. After Step 3 the settings item IS a direct link.

- [ ] **Step 2: `nav-user.tsx` — replace "Cuenta" with "Configuración"**

Line 3: replace `BadgeCheck` with `Settings` in the lucide import. Lines 84-89 become:

```tsx
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link to="settings/profile" data-tour="user-menu-settings">
                  <Settings />
                  {t('common:userMenu.settings')}
                </Link>
              </DropdownMenuItem>
```

(Keep the Notificaciones item and logout unchanged. The relative `to` resolves against the venue base exactly like the old `to="account"` did.)

- [ ] **Step 3: `app-sidebar.tsx` — collapse the group to a single link**

1. DELETE the whole `settingsSubItems` array (lines 580-623, from `// ── Configuracion ──` through `]) as any[]`).
2. DELETE line 810: `if (settingsSubItems.length > 0) allSubSidebarSections.settings = settingsSubItems`.
3. REPLACE the push block (lines ~785-790) with:

```tsx
    // Configuracion — single link into the Settings Hub (account + venue settings).
    // Sub-items now live in the hub's own left nav; keywords keep them findable
    // in the command palette.
    if (!isWhiteLabelVenue || canWL('AVOQADO_SETTINGS')) {
      mainItems.push({
        title: t('sidebar:settingsMenu.title', { defaultValue: 'Configuración' }),
        url: 'settings',
        icon: Settings,
        keywords: [
          'ajustes', 'configuracion', 'settings', 'cuenta', 'perfil', 'seguridad', 'idioma', 'tema',
          'integraciones', 'integrations', 'stripe', 'google', 'pos',
          'plan', 'suscripcion', 'facturacion', 'roles', 'permisos', 'bitacora', 'notificaciones',
        ],
      })
    }
```

4. Clean now-unused imports if ESLint flags them (`Store`, `Link2`, `ScrollText`, `Settings2` may still be used by other groups — only remove what `npm run lint` reports as unused).

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx playwright test e2e/tests/settings/settings-hub.spec.ts --project=chromium`
Expected: 4/4 PASS.

- [ ] **Step 5: Full regression**

Run: `npm run build && npm run lint && npm run test:e2e`
Expected: green. Watch `e2e/tests/` suites that navigated via the old sidebar sub-menu (grep `#settings` / `edit/integrations` in `e2e/` and fix any spec that clicked the old sub-items).

- [ ] **Step 6: Commit (ASK JOSE FIRST)**

```bash
git add src/components/Sidebar/app-sidebar.tsx src/components/Sidebar/nav-user.tsx e2e/tests/settings/settings-hub.spec.ts
git commit -m "feat(settings-hub): sidebar single link + avatar-menu Configuración entry points"
```

---

### Task 7: Final verification sweep

**Files:** none created — verification + cleanup only.

- [ ] **Step 1: Dead code + unused files**

Run: `npm run check:unused`
Expected: no new entries vs `develop` (Account.tsx deleted in Task 4; the three new pages + SettingsLayout are routed). If `NotificationPreferences1-5` variants or others surface, they pre-date this work — do NOT delete, just note.

- [ ] **Step 2: Full pre-deploy gate**

Run: `npm run build && npm run lint && npm run test:e2e`
Expected: all green.

- [ ] **Step 3: Manual checklist (dev server, `npm run dev`)**

- Light AND dark mode: hub nav, active item contrast, SA gradient label.
- Roles: OWNER (sees both groups + billing), MANAGER (account group + only `activity-log` if granted; index lands on `profile`), VIEWER (account group only), SUPERADMIN (SA group visible, amber-pink).
- White-label venue (`/wl/venues/:slug/settings`): hub renders, back button goes to WL home, venue group hidden without `AVOQADO_SETTINGS`.
- Mobile viewport (390px): horizontal nav strip scrolls, sections render.
- Save/Cancel sticky actions still work in `settings/local/basic-info` (VenueEditContext untouched).
- Language + theme switch from Preferencias take effect immediately.

- [ ] **Step 4: Docs touch-up (same-PR learning layer)**

Update `docs/architecture/routing.md`: add the `settings` hub block to the route inventory and mark `edit/*`, `account`, `activity-log` as legacy redirects. Update `CLAUDE.md` only if a rule text references `/edit` paths (grep first: `grep -n "venues/:slug/edit\|'edit'" CLAUDE.md .claude/rules/*.md`).

- [ ] **Step 5: Commit docs (ASK JOSE FIRST), then hand off**

```bash
git add docs/architecture/routing.md
git commit -m "docs(settings-hub): route inventory for the settings hub + legacy redirects"
```

Then use superpowers:finishing-a-development-branch — target is `develop` (auto-deploys demo + staging); production merge is Jose's call.

---

## Self-Review Notes

- **Spec coverage:** two-pane hub ✅ (T3/T4) · account/venue split ✅ (T2/T4) · Integraciones own section ✅ (T4 routes + hub nav item) · language/theme into Preferencias ✅ (T2, global chrome toggles intentionally kept as quick access — no removal) · two entry points ✅ (T6) · redirects ✅ (T4) · premium badge Bitácora ✅ (T3) · SA tools group ✅ (T3, links out to existing pages).
- **Type consistency:** `SettingsIndexRedirect` and `LegacyRedirect` are eager default exports created in T3 Step 1 (`src/routes/`); `SettingsLayout` + the three account pages are lazy via `lazyComponents.ts`. Names match across T3/T4 imports.
- **Known risk:** other components deep-linking to `edit/*` (T5 Step 3 sweeps them); E2E specs clicking old sidebar sub-items (T6 Step 5 sweeps them).
