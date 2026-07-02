# Financial Connections Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un OWNER conecte la cuenta bancaria de su sucursal (catálogo → credenciales → 2FA/OTP → elegir negocio) y vea su saldo en vivo dentro de Integraciones, sin salir de avoqado-web-dashboard; y reapuntar el panel superadmin al modelo nuevo.

**Architecture:** Un service module tipado (`financialConnection.service.ts`) sobre el REST ya desplegado en avoqado-server (`/api/v1/dashboard/venues/:venueId/financial-connections`); una sección nueva en la página existente `Venue/Edit/Integrations.tsx` (patrón Card + TanStack Query + PermissionGate); un wizard multi-paso (`BankConnectWizard`) que refleja la máquina de estados del backend, modelado sobre el `EcommerceMerchantWizard` existente; y el `AggregatorDetailSheet` de superadmin reconstruido como vista de solo-lectura del nuevo modelo.

**Tech Stack:** React 18 + TypeScript + Vite · TanStack Query · react-i18next (es/en/fr) · shadcn/ui · axios (`@/api`) · vitest.

## Global Constraints

- **Backend ya desplegado (origin/develop de avoqado-server, verificado en vivo).** Contrato EXACTO (envelope `{ success: true, data: ... }` en éxito):
  - `GET /api/v1/dashboard/financial-providers` → `data: Array<{ id, code, name, active, connectionType, createdAt, updatedAt }>`
  - `GET /api/v1/dashboard/venues/:venueId/financial-connections` → `data: Array<{ id, status, mode, lastError, provider: { code, name }, accounts: Array<{ id, externalId, label, clabe, currency, lastBalance, lastSyncedAt, balanceState, merchantAccounts: Array<{ id }> }> }>`
  - `POST /api/v1/dashboard/venues/:venueId/financial-connections` body `{ providerId, email, password }` → **201** `data: { connectionId, status, accountOptions? }`
  - `POST .../financial-connections/:id/validate-2fa` body `{ code }` → `data: { connectionId, status, accountOptions? }`
  - `POST .../financial-connections/:id/validate-device` body `{ code }` → `data: { connectionId, status, accountOptions? }`
  - `POST .../financial-connections/:id/select-account` body `{ externalId }` → `data: { status: 'CONNECTED' }` (NO enviar `merchantAccountId` — el ligado a slots de cobro es flujo superadmin/futuro, fuera de alcance)
  - `GET /api/v1/dashboard/venues/:venueId/financial-accounts/:id/balance` → `data: { amount: number | null, currency: string, syncedAt: string | null, state: 'OK' | 'ERROR' }`
  - `DELETE .../financial-connections/:id` → `{ success: true }`
- **Statuses de conexión** (string union, copiar literal): `'PENDING_DEVICE_VALIDATION' | 'PENDING_TWO_FACTOR_AUTH' | 'PENDING_ACCOUNT_SELECTION' | 'CONNECTED' | 'NEEDS_REAUTH' | 'REVOKED' | 'ERROR'`. **balanceState**: `'OK' | 'ERROR' | 'UNKNOWN'`.
- **Errores:** 400 → `{ message, errorName }` (los `message` del backend YA vienen en español — mostrarlos directo con fallback genérico i18n); 401/403/404 → `{ message }`; **429** → `{ error: 'RATE_LIMIT_EXCEEDED', message, retryAfter }` (create/validate-2fa/validate-device tienen rate limit: mostrar el `message` del 429 en toast destructivo).
- **Contrato de saldo honesto:** `lastBalance`/`amount` `null` JAMÁS se muestra como `$0` — mostrar `—` + badge de estado. `Currency(null)` ya devuelve `'N/A'`; para saldos usar `balance != null ? Currency(balance) : '—'`.
- **Sin nombres de vendors en el código** (regla del proyecto): el nombre a mostrar del banco viene del catálogo (`provider.name`); jamás hardcodear "Moneygiver"/"QPay" en código ni en locales.
- **i18n obligatorio:** CERO strings de UI hardcodeados. Namespace nuevo `financialConnections` en `src/locales/{es,en,fr}/financialConnections.json`, registrado en `src/i18n.ts` (patrón idéntico a `googleIntegration`).
- **Permiso:** UI visible solo con `financialConnections:manage` (solo OWNER lo tiene) vía `<PermissionGate permission="financialConnections:manage">` (`src/components/PermissionGate.tsx`). El backend igual rechaza 403 — el gate es UX, no seguridad.
- **Convenciones del repo:** service = módulo en `src/services/*.service.ts` con `import api from '@/api'` + objeto API exportado; query keys `['financial-connections', venueId]`, `['financial-providers']`, `['financial-account-balance', accountId]`; dinero con `Currency()` de `@/utils/currency`; toasts con `useToast` de `@/hooks/use-toast`; modal wizard con `FullScreenModal` de `@/components/ui/full-screen-modal`; commits directos a `develop` (convención del equipo).
- **Working tree:** los archivos `src/pages/Superadmin/components/AggregatorDetailSheet.tsx`, `src/services/aggregator.service.ts` y `src/services/paymentProvider.service.ts` tienen cambios sin commitear de la era V1 (apuntan a campos que el backend ya eliminó). La Task 5 los RESETEA a HEAD antes de reconstruir. Ningún otro archivo modificado debe tocarse.
- **Verificación por task:** `npx tsc --noEmit` (o `npm run typecheck` si existe) + `npx vitest run <archivo de test del task>` + `npx oxlint <archivos tocados>` si el repo usa oxlint (si no existe, `npm run lint` acotado). Dev server para pruebas visuales: `npm run dev` en `http://localhost:5173` con backend en `localhost:3000` (login de prueba: `owner@owner.com` / `owner`, venue "Mobanq").

---

### Task 1: Service layer tipado (`financialConnection.service.ts`)

**Files:**
- Create: `src/services/financialConnection.service.ts`
- Test: `src/services/__tests__/financialConnection.service.test.ts`

**Interfaces:**
- Consumes: `api` (axios instance, `@/api`).
- Produces (los components de Tasks 3-4 dependen de estos nombres EXACTOS): tipos `FinancialProvider`, `FinancialConnectionStatus`, `BalanceState`, `FinancialAccountSummary`, `FinancialConnectionSummary`, `ConnectionStepResult`, `AccountBalance`; objeto `financialConnectionAPI` con métodos `listProviders()`, `listConnections(venueId)`, `createConnection(venueId, { providerId, email, password })`, `validateTwoFactor(venueId, connectionId, code)`, `validateDevice(venueId, connectionId, code)`, `selectAccount(venueId, connectionId, externalId)`, `getBalance(venueId, financialAccountId)`, `disconnect(venueId, connectionId)`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/services/__tests__/financialConnection.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

import api from '@/api'
import { financialConnectionAPI } from '@/services/financialConnection.service'

const mocked = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('financialConnectionAPI', () => {
  it('listProviders: GET al catálogo y desenvuelve data', async () => {
    mocked.get.mockResolvedValue({ data: { success: true, data: [{ id: 'p1', code: 'EXTERNAL_BANK', name: 'Banco', active: true }] } })
    const r = await financialConnectionAPI.listProviders()
    expect(mocked.get).toHaveBeenCalledWith('/api/v1/dashboard/financial-providers')
    expect(r[0].code).toBe('EXTERNAL_BANK')
  })

  it('listConnections: GET venue-scoped y desenvuelve data', async () => {
    mocked.get.mockResolvedValue({ data: { success: true, data: [{ id: 'c1', status: 'CONNECTED', provider: { code: 'X', name: 'Banco' }, accounts: [] }] } })
    const r = await financialConnectionAPI.listConnections('v1')
    expect(mocked.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections')
    expect(r[0].status).toBe('CONNECTED')
  })

  it('createConnection: POST credenciales, devuelve el paso (2FA)', async () => {
    mocked.post.mockResolvedValue({ data: { success: true, data: { connectionId: 'c9', status: 'PENDING_TWO_FACTOR_AUTH' } } })
    const r = await financialConnectionAPI.createConnection('v1', { providerId: 'p1', email: 'a@b.co', password: 'x' })
    expect(mocked.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections', {
      providerId: 'p1',
      email: 'a@b.co',
      password: 'x',
    })
    expect(r.status).toBe('PENDING_TWO_FACTOR_AUTH')
  })

  it('validateTwoFactor / validateDevice / selectAccount: POST al endpoint correcto', async () => {
    mocked.post.mockResolvedValue({ data: { success: true, data: { connectionId: 'c9', status: 'CONNECTED' } } })
    await financialConnectionAPI.validateTwoFactor('v1', 'c9', '123456')
    expect(mocked.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections/c9/validate-2fa', { code: '123456' })
    await financialConnectionAPI.validateDevice('v1', 'c9', '654321')
    expect(mocked.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections/c9/validate-device', { code: '654321' })
    await financialConnectionAPI.selectAccount('v1', 'c9', 'neg-1')
    expect(mocked.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections/c9/select-account', { externalId: 'neg-1' })
  })

  it('getBalance: GET saldo de una cuenta; un amount null se preserva null (nunca 0)', async () => {
    mocked.get.mockResolvedValue({ data: { success: true, data: { amount: null, currency: 'MXN', syncedAt: null, state: 'ERROR' } } })
    const r = await financialConnectionAPI.getBalance('v1', 'fa1')
    expect(mocked.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-accounts/fa1/balance')
    expect(r.amount).toBeNull()
    expect(r.state).toBe('ERROR')
  })

  it('disconnect: DELETE a la conexión', async () => {
    mocked.delete.mockResolvedValue({ data: { success: true } })
    await financialConnectionAPI.disconnect('v1', 'c9')
    expect(mocked.delete).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/financial-connections/c9')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/services/__tests__/financialConnection.service.test.ts`
Expected: FAIL — `Cannot find module '@/services/financialConnection.service'` (o equivalente).

- [ ] **Step 3: Implementar el service**

```ts
// src/services/financialConnection.service.ts
/**
 * Financial Connections — API client (dashboard OWNER).
 *
 * Un OWNER conecta la cuenta bancaria de su sucursal con sus propias
 * credenciales (self-connect), resuelve retos 2FA/dispositivo, elige qué
 * negocio ligar y consulta saldo en vivo. Backend: avoqado-server
 * `/api/v1/dashboard/venues/:venueId/financial-connections`.
 */
import api from '@/api'

export type FinancialConnectionStatus =
  | 'PENDING_DEVICE_VALIDATION'
  | 'PENDING_TWO_FACTOR_AUTH'
  | 'PENDING_ACCOUNT_SELECTION'
  | 'CONNECTED'
  | 'NEEDS_REAUTH'
  | 'REVOKED'
  | 'ERROR'

export type BalanceState = 'OK' | 'ERROR' | 'UNKNOWN'

export interface FinancialProvider {
  id: string
  code: string
  name: string
  active: boolean
  connectionType: string
}

export interface ProviderAccountOption {
  externalId: string
  label?: string | null
  clabe?: string | null
  active?: boolean | null
  balance?: number | null
}

export interface ConnectionStepResult {
  connectionId: string
  status: FinancialConnectionStatus
  accountOptions?: ProviderAccountOption[]
}

export interface FinancialAccountSummary {
  id: string
  externalId: string
  label: string | null
  clabe: string | null
  currency: string
  lastBalance: number | null
  lastSyncedAt: string | null
  balanceState: BalanceState
  merchantAccounts: Array<{ id: string }>
}

export interface FinancialConnectionSummary {
  id: string
  status: FinancialConnectionStatus
  mode: string
  lastError: string | null
  provider: { code: string; name: string }
  accounts: FinancialAccountSummary[]
}

export interface AccountBalance {
  amount: number | null
  currency: string
  syncedAt: string | null
  state: 'OK' | 'ERROR'
}

const BASE = '/api/v1/dashboard'

export const financialConnectionAPI = {
  async listProviders(): Promise<FinancialProvider[]> {
    const { data } = await api.get(`${BASE}/financial-providers`)
    return data.data
  },

  async listConnections(venueId: string): Promise<FinancialConnectionSummary[]> {
    const { data } = await api.get(`${BASE}/venues/${venueId}/financial-connections`)
    return data.data
  },

  async createConnection(
    venueId: string,
    body: { providerId: string; email: string; password: string },
  ): Promise<ConnectionStepResult> {
    const { data } = await api.post(`${BASE}/venues/${venueId}/financial-connections`, body)
    return data.data
  },

  async validateTwoFactor(venueId: string, connectionId: string, code: string): Promise<ConnectionStepResult> {
    const { data } = await api.post(`${BASE}/venues/${venueId}/financial-connections/${connectionId}/validate-2fa`, { code })
    return data.data
  },

  async validateDevice(venueId: string, connectionId: string, code: string): Promise<ConnectionStepResult> {
    const { data } = await api.post(`${BASE}/venues/${venueId}/financial-connections/${connectionId}/validate-device`, { code })
    return data.data
  },

  async selectAccount(venueId: string, connectionId: string, externalId: string): Promise<{ status: 'CONNECTED' }> {
    const { data } = await api.post(`${BASE}/venues/${venueId}/financial-connections/${connectionId}/select-account`, { externalId })
    return data.data
  },

  async getBalance(venueId: string, financialAccountId: string): Promise<AccountBalance> {
    const { data } = await api.get(`${BASE}/venues/${venueId}/financial-accounts/${financialAccountId}/balance`)
    return data.data
  },

  async disconnect(venueId: string, connectionId: string): Promise<void> {
    await api.delete(`${BASE}/venues/${venueId}/financial-connections/${connectionId}`)
  },
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/services/__tests__/financialConnection.service.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.

```bash
git add src/services/financialConnection.service.ts src/services/__tests__/financialConnection.service.test.ts
git commit -m "feat(financial-connections): typed API client for venue bank connections"
```

---

### Task 2: Namespace i18n `financialConnections` (es/en/fr)

**Files:**
- Create: `src/locales/es/financialConnections.json`
- Create: `src/locales/en/financialConnections.json`
- Create: `src/locales/fr/financialConnections.json`
- Modify: `src/i18n.ts` (imports + registro en los 3 bundles, patrón idéntico a `googleIntegration` — ver `src/i18n.ts:90-92` para el patrón de import y buscar `googleIntegration:` dentro del objeto `resources` para el registro por idioma)

**Interfaces:**
- Produces: namespace `financialConnections` disponible vía `useTranslation('financialConnections')`. Tasks 3-4 usan EXACTAMENTE las keys de abajo.

- [ ] **Step 1: Crear los 3 JSON**

`src/locales/es/financialConnections.json`:

```json
{
  "section": {
    "title": "Cuentas de banco",
    "description": "Conecta la cuenta bancaria donde se depositan tus ventas y consulta su saldo sin salir de Avoqado.",
    "empty": "Aún no tienes ninguna cuenta de banco conectada.",
    "connectCta": "Conectar banco",
    "loadError": "No se pudieron cargar tus conexiones bancarias."
  },
  "status": {
    "CONNECTED": "Conectada",
    "NEEDS_REAUTH": "Requiere reconexión",
    "PENDING_DEVICE_VALIDATION": "Validación pendiente",
    "PENDING_TWO_FACTOR_AUTH": "Código 2FA pendiente",
    "PENDING_ACCOUNT_SELECTION": "Falta elegir cuenta",
    "REVOKED": "Desconectada",
    "ERROR": "Error"
  },
  "account": {
    "balance": "Saldo",
    "noBalance": "—",
    "lastSynced": "Actualizado {{when}}",
    "neverSynced": "Sin consultar",
    "refresh": "Actualizar saldo",
    "balanceError": "No se pudo obtener el saldo"
  },
  "actions": {
    "disconnect": "Desconectar",
    "reconnect": "Reconectar",
    "disconnectTitle": "¿Desconectar esta cuenta?",
    "disconnectDesc": "Dejarás de ver el saldo de este banco en Avoqado. Puedes volver a conectarla cuando quieras.",
    "disconnectConfirm": "Sí, desconectar",
    "cancel": "Cancelar",
    "disconnected": "Cuenta desconectada"
  },
  "wizard": {
    "title": "Conectar cuenta de banco",
    "step1": {
      "title": "Elige tu banco",
      "description": "Selecciona la institución donde recibes tus depósitos.",
      "none": "No hay bancos disponibles por ahora."
    },
    "step2": {
      "title": "Inicia sesión en tu banco",
      "description": "Usa las credenciales con las que entras al portal de tu banco. Se envían cifradas y no se guardan en texto plano.",
      "email": "Correo electrónico",
      "password": "Contraseña",
      "submit": "Conectar",
      "connecting": "Conectando…"
    },
    "code": {
      "twoFactorTitle": "Código de verificación",
      "twoFactorDesc": "Ingresa el código de 6 dígitos de tu app de autenticación (Google Authenticator). Caduca en menos de un minuto — tenlo a la mano.",
      "deviceTitle": "Valida este dispositivo",
      "deviceDesc": "Tu banco envió un código de verificación para autorizar esta conexión. Ingrésalo aquí.",
      "codeLabel": "Código",
      "submit": "Validar",
      "validating": "Validando…"
    },
    "selectAccount": {
      "title": "Elige la cuenta",
      "description": "Tu banco tiene más de un negocio asociado a este acceso. Elige cuál quieres ver en Avoqado.",
      "submit": "Usar esta cuenta"
    },
    "done": {
      "title": "¡Banco conectado!",
      "description": "Ya puedes ver el saldo de tu cuenta en Integraciones.",
      "close": "Listo"
    },
    "errors": {
      "generic": "Algo salió mal. Intenta de nuevo.",
      "rateLimited": "Demasiados intentos. Espera unos minutos e intenta de nuevo."
    }
  }
}
```

`src/locales/en/financialConnections.json`:

```json
{
  "section": {
    "title": "Bank accounts",
    "description": "Connect the bank account where your sales are deposited and check its balance without leaving Avoqado.",
    "empty": "You haven't connected a bank account yet.",
    "connectCta": "Connect bank",
    "loadError": "Your bank connections could not be loaded."
  },
  "status": {
    "CONNECTED": "Connected",
    "NEEDS_REAUTH": "Needs reconnection",
    "PENDING_DEVICE_VALIDATION": "Validation pending",
    "PENDING_TWO_FACTOR_AUTH": "2FA code pending",
    "PENDING_ACCOUNT_SELECTION": "Account selection pending",
    "REVOKED": "Disconnected",
    "ERROR": "Error"
  },
  "account": {
    "balance": "Balance",
    "noBalance": "—",
    "lastSynced": "Updated {{when}}",
    "neverSynced": "Never fetched",
    "refresh": "Refresh balance",
    "balanceError": "Could not fetch balance"
  },
  "actions": {
    "disconnect": "Disconnect",
    "reconnect": "Reconnect",
    "disconnectTitle": "Disconnect this account?",
    "disconnectDesc": "You'll stop seeing this bank's balance in Avoqado. You can reconnect anytime.",
    "disconnectConfirm": "Yes, disconnect",
    "cancel": "Cancel",
    "disconnected": "Account disconnected"
  },
  "wizard": {
    "title": "Connect bank account",
    "step1": {
      "title": "Choose your bank",
      "description": "Select the institution where you receive your deposits.",
      "none": "No banks available yet."
    },
    "step2": {
      "title": "Sign in to your bank",
      "description": "Use the credentials you use for your bank's portal. They are sent encrypted and never stored in plain text.",
      "email": "Email",
      "password": "Password",
      "submit": "Connect",
      "connecting": "Connecting…"
    },
    "code": {
      "twoFactorTitle": "Verification code",
      "twoFactorDesc": "Enter the 6-digit code from your authenticator app (Google Authenticator). It expires in under a minute — have it ready.",
      "deviceTitle": "Validate this device",
      "deviceDesc": "Your bank sent a verification code to authorize this connection. Enter it here.",
      "codeLabel": "Code",
      "submit": "Validate",
      "validating": "Validating…"
    },
    "selectAccount": {
      "title": "Choose the account",
      "description": "Your bank has more than one business under this login. Choose which one to see in Avoqado.",
      "submit": "Use this account"
    },
    "done": {
      "title": "Bank connected!",
      "description": "You can now see your account balance in Integrations.",
      "close": "Done"
    },
    "errors": {
      "generic": "Something went wrong. Try again.",
      "rateLimited": "Too many attempts. Wait a few minutes and try again."
    }
  }
}
```

`src/locales/fr/financialConnections.json`:

```json
{
  "section": {
    "title": "Comptes bancaires",
    "description": "Connectez le compte bancaire où vos ventes sont déposées et consultez son solde sans quitter Avoqado.",
    "empty": "Vous n'avez pas encore connecté de compte bancaire.",
    "connectCta": "Connecter une banque",
    "loadError": "Impossible de charger vos connexions bancaires."
  },
  "status": {
    "CONNECTED": "Connecté",
    "NEEDS_REAUTH": "Reconnexion requise",
    "PENDING_DEVICE_VALIDATION": "Validation en attente",
    "PENDING_TWO_FACTOR_AUTH": "Code 2FA en attente",
    "PENDING_ACCOUNT_SELECTION": "Choix du compte en attente",
    "REVOKED": "Déconnecté",
    "ERROR": "Erreur"
  },
  "account": {
    "balance": "Solde",
    "noBalance": "—",
    "lastSynced": "Mis à jour {{when}}",
    "neverSynced": "Jamais consulté",
    "refresh": "Actualiser le solde",
    "balanceError": "Impossible d'obtenir le solde"
  },
  "actions": {
    "disconnect": "Déconnecter",
    "reconnect": "Reconnecter",
    "disconnectTitle": "Déconnecter ce compte ?",
    "disconnectDesc": "Vous ne verrez plus le solde de cette banque dans Avoqado. Vous pouvez la reconnecter à tout moment.",
    "disconnectConfirm": "Oui, déconnecter",
    "cancel": "Annuler",
    "disconnected": "Compte déconnecté"
  },
  "wizard": {
    "title": "Connecter un compte bancaire",
    "step1": {
      "title": "Choisissez votre banque",
      "description": "Sélectionnez l'institution où vous recevez vos dépôts.",
      "none": "Aucune banque disponible pour le moment."
    },
    "step2": {
      "title": "Connectez-vous à votre banque",
      "description": "Utilisez les identifiants du portail de votre banque. Ils sont envoyés chiffrés et jamais stockés en clair.",
      "email": "E-mail",
      "password": "Mot de passe",
      "submit": "Connecter",
      "connecting": "Connexion…"
    },
    "code": {
      "twoFactorTitle": "Code de vérification",
      "twoFactorDesc": "Saisissez le code à 6 chiffres de votre application d'authentification (Google Authenticator). Il expire en moins d'une minute.",
      "deviceTitle": "Validez cet appareil",
      "deviceDesc": "Votre banque a envoyé un code de vérification pour autoriser cette connexion. Saisissez-le ici.",
      "codeLabel": "Code",
      "submit": "Valider",
      "validating": "Validation…"
    },
    "selectAccount": {
      "title": "Choisissez le compte",
      "description": "Votre banque a plusieurs entreprises sous cet accès. Choisissez celle à afficher dans Avoqado.",
      "submit": "Utiliser ce compte"
    },
    "done": {
      "title": "Banque connectée !",
      "description": "Vous pouvez maintenant voir le solde de votre compte dans Intégrations.",
      "close": "Terminé"
    },
    "errors": {
      "generic": "Une erreur s'est produite. Réessayez.",
      "rateLimited": "Trop de tentatives. Attendez quelques minutes et réessayez."
    }
  }
}
```

- [ ] **Step 2: Registrar en `src/i18n.ts`**

Junto a los imports de `googleIntegration` (líneas ~90-92), agregar:

```ts
import financialConnectionsEn from '@/locales/en/financialConnections.json'
import financialConnectionsEs from '@/locales/es/financialConnections.json'
import financialConnectionsFr from '@/locales/fr/financialConnections.json'
```

Y en el objeto `resources`, dentro de cada idioma (buscar dónde está `googleIntegration:` para cada uno y agregar al lado, respetando el orden alfabético si el archivo lo sigue):

```ts
// en:
financialConnections: financialConnectionsEn,
// es:
financialConnections: financialConnectionsEs,
// fr:
financialConnections: financialConnectionsFr,
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` → exit 0. Run: `npx vitest run src/services/__tests__/financialConnection.service.test.ts` → PASS (sanity de que nada se rompió).

- [ ] **Step 4: Commit**

```bash
git add src/locales/es/financialConnections.json src/locales/en/financialConnections.json src/locales/fr/financialConnections.json src/i18n.ts
git commit -m "feat(financial-connections): i18n namespace es/en/fr"
```

---

### Task 3: Wizard de conexión (`BankConnectWizard`)

**Files:**
- Create: `src/pages/Venue/components/bankConnectSteps.ts` (helper puro, testeable)
- Create: `src/pages/Venue/components/BankConnectWizard.tsx`
- Test: `src/pages/Venue/components/__tests__/bankConnectSteps.test.ts`

**Interfaces:**
- Consumes: `financialConnectionAPI`, tipos de Task 1; namespace i18n de Task 2; `FullScreenModal` (`@/components/ui/full-screen-modal` — leer sus props antes de usar: sigue el uso que hace `EcommerceMerchantWizard.tsx` en este mismo directorio).
- Produces: `<BankConnectWizard open onClose venueId />` (props: `{ open: boolean; onClose: () => void; venueId: string }`). Al conectar con éxito invalida `['financial-connections', venueId]`.

- [ ] **Step 1: Test del helper puro (mapea status del backend → paso del wizard)**

```ts
// src/pages/Venue/components/__tests__/bankConnectSteps.test.ts
import { describe, it, expect } from 'vitest'
import { stepForStatus } from '../bankConnectSteps'

describe('stepForStatus', () => {
  it('mapea cada status del backend al paso de UI correcto', () => {
    expect(stepForStatus('PENDING_TWO_FACTOR_AUTH')).toEqual({ step: 'code', variant: 'twoFactor' })
    expect(stepForStatus('PENDING_DEVICE_VALIDATION')).toEqual({ step: 'code', variant: 'device' })
    expect(stepForStatus('PENDING_ACCOUNT_SELECTION')).toEqual({ step: 'selectAccount' })
    expect(stepForStatus('CONNECTED')).toEqual({ step: 'done' })
  })
  it('estados no-wizard (NEEDS_REAUTH/REVOKED/ERROR) regresan a credenciales', () => {
    expect(stepForStatus('NEEDS_REAUTH')).toEqual({ step: 'credentials' })
    expect(stepForStatus('REVOKED')).toEqual({ step: 'credentials' })
    expect(stepForStatus('ERROR')).toEqual({ step: 'credentials' })
  })
})
```

- [ ] **Step 2: Correr el test → FAIL** (`stepForStatus` no existe).

- [ ] **Step 3: Implementar el helper**

```ts
// src/pages/Venue/components/bankConnectSteps.ts
import type { FinancialConnectionStatus } from '@/services/financialConnection.service'

export type WizardStep =
  | { step: 'providers' }
  | { step: 'credentials' }
  | { step: 'code'; variant: 'twoFactor' | 'device' }
  | { step: 'selectAccount' }
  | { step: 'done' }

/** Traduce el status que devuelve el backend al paso de UI que sigue. */
export function stepForStatus(status: FinancialConnectionStatus): WizardStep {
  switch (status) {
    case 'PENDING_TWO_FACTOR_AUTH':
      return { step: 'code', variant: 'twoFactor' }
    case 'PENDING_DEVICE_VALIDATION':
      return { step: 'code', variant: 'device' }
    case 'PENDING_ACCOUNT_SELECTION':
      return { step: 'selectAccount' }
    case 'CONNECTED':
      return { step: 'done' }
    default:
      // NEEDS_REAUTH / REVOKED / ERROR: la única salida es volver a dar credenciales.
      return { step: 'credentials' }
  }
}
```

- [ ] **Step 4: Correr el test → PASS.**

- [ ] **Step 5: Implementar el componente**

Antes de escribir: leer `src/pages/Venue/components/EcommerceMerchantWizard.tsx` (los primeros ~150 renglones) para copiar el uso EXACTO de `FullScreenModal` (props reales) y el estilo de tiles. Estructura completa:

```tsx
// src/pages/Venue/components/BankConnectWizard.tsx
/**
 * BankConnectWizard — flujo self-connect de cuenta bancaria (OWNER).
 *
 * Pasos (espejo de la máquina de estados del backend):
 *   providers → credentials → [code 2FA | code device] → [selectAccount] → done
 * El paso siguiente SIEMPRE lo decide la respuesta del backend vía
 * stepForStatus(result.status) — el wizard no asume el orden.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Building2, CheckCircle2, Loader2 } from 'lucide-react'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Currency } from '@/utils/currency'
import {
  financialConnectionAPI,
  type FinancialProvider,
  type ProviderAccountOption,
  type ConnectionStepResult,
} from '@/services/financialConnection.service'
import { stepForStatus, type WizardStep } from './bankConnectSteps'

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
}

/** Mensaje de error legible: el backend ya responde en español; 429 tiene copy propio. */
function errorMessage(err: unknown, t: (k: string) => string): string {
  const e = err as { response?: { status?: number; data?: { message?: string } } }
  if (e?.response?.status === 429) return e.response.data?.message ?? t('wizard.errors.rateLimited')
  return e?.response?.data?.message ?? t('wizard.errors.generic')
}

export function BankConnectWizard({ open, onClose, venueId }: Props) {
  const { t } = useTranslation('financialConnections')
  const queryClient = useQueryClient()

  const [wizard, setWizard] = useState<WizardStep>({ step: 'providers' })
  const [provider, setProvider] = useState<FinancialProvider | null>(null)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [accountOptions, setAccountOptions] = useState<ProviderAccountOption[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ['financial-providers'],
    queryFn: financialConnectionAPI.listProviders,
    enabled: open,
  })

  const advance = (r: ConnectionStepResult) => {
    setConnectionId(r.connectionId)
    if (r.accountOptions) setAccountOptions(r.accountOptions)
    const next = stepForStatus(r.status)
    setWizard(next)
    setError(null)
    setCode('')
    if (next.step === 'done') {
      queryClient.invalidateQueries({ queryKey: ['financial-connections', venueId] })
    }
  }

  const connect = useMutation({
    mutationFn: () => financialConnectionAPI.createConnection(venueId, { providerId: provider!.id, email, password }),
    onSuccess: advance,
    onError: err => setError(errorMessage(err, t)),
  })

  const validate = useMutation({
    mutationFn: () =>
      wizard.step === 'code' && wizard.variant === 'device'
        ? financialConnectionAPI.validateDevice(venueId, connectionId!, code)
        : financialConnectionAPI.validateTwoFactor(venueId, connectionId!, code),
    onSuccess: advance,
    onError: err => setError(errorMessage(err, t)),
  })

  const select = useMutation({
    mutationFn: (externalId: string) => financialConnectionAPI.selectAccount(venueId, connectionId!, externalId),
    onSuccess: () => advance({ connectionId: connectionId!, status: 'CONNECTED' }),
    onError: err => setError(errorMessage(err, t)),
  })

  const reset = () => {
    setWizard({ step: 'providers' })
    setProvider(null)
    setConnectionId(null)
    setAccountOptions([])
    setEmail('')
    setPassword('')
    setCode('')
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const codeCopy = useMemo(() => {
    if (wizard.step !== 'code') return null
    return wizard.variant === 'twoFactor'
      ? { title: t('wizard.code.twoFactorTitle'), desc: t('wizard.code.twoFactorDesc') }
      : { title: t('wizard.code.deviceTitle'), desc: t('wizard.code.deviceDesc') }
  }, [wizard, t])

  return (
    <FullScreenModal open={open} onClose={handleClose} title={t('wizard.title')}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {wizard.step === 'providers' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">{t('wizard.step1.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('wizard.step1.description')}</p>
            </div>
            {loadingProviders && <Loader2 className="h-5 w-5 animate-spin" />}
            {!loadingProviders && providers.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('wizard.step1.none')}</p>
            )}
            <div className="grid gap-3">
              {providers.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProvider(p)
                    setWizard({ step: 'credentials' })
                  }}
                  className="flex items-center gap-3 rounded-2xl border-2 border-input bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {wizard.step === 'credentials' && provider && (
          <form
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault()
              connect.mutate()
            }}
          >
            <div>
              <h2 className="text-lg font-semibold">{t('wizard.step2.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('wizard.step2.description')}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fc-email">{t('wizard.step2.email')}</Label>
              <Input id="fc-email" type="email" required autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fc-password">{t('wizard.step2.password')}</Label>
              <Input
                id="fc-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={connect.isPending || !email || !password}>
              {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {connect.isPending ? t('wizard.step2.connecting') : t('wizard.step2.submit')}
            </Button>
          </form>
        )}

        {wizard.step === 'code' && codeCopy && (
          <form
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault()
              validate.mutate()
            }}
          >
            <div>
              <h2 className="text-lg font-semibold">{codeCopy.title}</h2>
              <p className="text-sm text-muted-foreground">{codeCopy.desc}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fc-code">{t('wizard.code.codeLabel')}</Label>
              <Input
                id="fc-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                className="text-center text-2xl tracking-[0.5em]"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <Button type="submit" disabled={validate.isPending || code.length !== 6}>
              {validate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {validate.isPending ? t('wizard.code.validating') : t('wizard.code.submit')}
            </Button>
          </form>
        )}

        {wizard.step === 'selectAccount' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">{t('wizard.selectAccount.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('wizard.selectAccount.description')}</p>
            </div>
            <div className="grid gap-3">
              {accountOptions.map(a => (
                <button
                  key={a.externalId}
                  type="button"
                  disabled={select.isPending}
                  onClick={() => select.mutate(a.externalId)}
                  className="flex items-center justify-between rounded-2xl border-2 border-input bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md disabled:opacity-50"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{a.label ?? a.externalId}</span>
                    {a.clabe && <span className="text-xs text-muted-foreground">CLABE {a.clabe}</span>}
                  </div>
                  {a.balance != null && <Badge variant="secondary">{Currency(a.balance)}</Badge>}
                </button>
              ))}
            </div>
          </div>
        )}

        {wizard.step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden />
            <h2 className="text-lg font-semibold">{t('wizard.done.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('wizard.done.description')}</p>
            <Button onClick={handleClose}>{t('wizard.done.close')}</Button>
          </div>
        )}
      </div>
    </FullScreenModal>
  )
}
```

Nota para el implementador: si las props reales de `FullScreenModal` difieren (p.ej. `isOpen`/`onOpenChange`), ajustar a las props REALES que usa `EcommerceMerchantWizard` — ese archivo es la referencia canónica, no este snippet.

- [ ] **Step 6: Verificar**

Run: `npx vitest run src/pages/Venue/components/__tests__/bankConnectSteps.test.ts` → PASS. Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Venue/components/bankConnectSteps.ts src/pages/Venue/components/BankConnectWizard.tsx src/pages/Venue/components/__tests__/bankConnectSteps.test.ts
git commit -m "feat(financial-connections): bank connect wizard (providers → credentials → 2FA/device → account)"
```

---

### Task 4: Sección "Cuentas de banco" en Integraciones

**Files:**
- Create: `src/pages/Venue/Edit/components/BankAccountsSection.tsx`
- Modify: `src/pages/Venue/Edit/Integrations.tsx` (1 import + 1 render — ver Step 2)

**Interfaces:**
- Consumes: `financialConnectionAPI` + tipos (Task 1), i18n (Task 2), `BankConnectWizard` (Task 3), `PermissionGate`, `Currency`, `useCurrentVenue`, `useToast`, shadcn `Card/Badge/Button/AlertDialog/Skeleton`.
- Produces: `<BankAccountsSection />` (sin props — toma venueId de `useCurrentVenue()`).

- [ ] **Step 1: Implementar la sección**

```tsx
// src/pages/Venue/Edit/components/BankAccountsSection.tsx
/**
 * BankAccountsSection — "Cuentas de banco" dentro de Integraciones.
 * Lista las conexiones bancarias de la sucursal con saldo en vivo.
 * Visible solo con financialConnections:manage (OWNER). El gate es UX;
 * la seguridad real la pone el backend (403/404).
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Landmark, Plus, RefreshCw, Unlink } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import {
  financialConnectionAPI,
  type FinancialAccountSummary,
  type FinancialConnectionSummary,
  type FinancialConnectionStatus,
} from '@/services/financialConnection.service'
import { BankConnectWizard } from '@/pages/Venue/components/BankConnectWizard'

const STATUS_BADGE: Record<FinancialConnectionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CONNECTED: 'default',
  NEEDS_REAUTH: 'destructive',
  PENDING_DEVICE_VALIDATION: 'secondary',
  PENDING_TWO_FACTOR_AUTH: 'secondary',
  PENDING_ACCOUNT_SELECTION: 'secondary',
  REVOKED: 'outline',
  ERROR: 'destructive',
}

function AccountRow({ venueId, account }: { venueId: string; account: FinancialAccountSummary }) {
  const { t } = useTranslation('financialConnections')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const refresh = useMutation({
    mutationFn: () => financialConnectionAPI.getBalance(venueId, account.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial-connections', venueId] }),
    onError: () => toast({ title: t('account.balanceError'), variant: 'destructive' }),
  })

  const synced = account.lastSyncedAt
    ? t('account.lastSynced', { when: new Date(account.lastSyncedAt).toLocaleString() })
    : t('account.neverSynced')

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{account.label ?? account.externalId}</span>
        {account.clabe && <span className="text-xs text-muted-foreground">CLABE {account.clabe}</span>}
        <span className="text-xs text-muted-foreground">{synced}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold tabular-nums">
          {account.lastBalance != null ? Currency(account.lastBalance) : t('account.noBalance')}
        </span>
        {account.balanceState !== 'OK' && <Badge variant="destructive">{account.balanceState}</Badge>}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('account.refresh')}
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          <RefreshCw className={`h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  )
}

function ConnectionCard({
  venueId,
  connection,
  onReconnect,
}: {
  venueId: string
  connection: FinancialConnectionSummary
  onReconnect: () => void
}) {
  const { t } = useTranslation('financialConnections')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const disconnect = useMutation({
    mutationFn: () => financialConnectionAPI.disconnect(venueId, connection.id),
    onSuccess: () => {
      toast({ title: t('actions.disconnected') })
      queryClient.invalidateQueries({ queryKey: ['financial-connections', venueId] })
    },
  })

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-muted-foreground" aria-hidden />
          <span className="font-medium">{connection.provider.name}</span>
          <Badge variant={STATUS_BADGE[connection.status]}>{t(`status.${connection.status}`)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {connection.status === 'NEEDS_REAUTH' && (
            <Button variant="outline" size="sm" onClick={onReconnect}>
              {t('actions.reconnect')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
            <Unlink className="mr-1 h-4 w-4" />
            {t('actions.disconnect')}
          </Button>
        </div>
      </div>
      {connection.accounts.map(a => (
        <AccountRow key={a.id} venueId={venueId} account={a} />
      ))}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.disconnectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('actions.disconnectDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnect.mutate()}>{t('actions.disconnectConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function BankAccountsSection() {
  const { t } = useTranslation('financialConnections')
  const { venueId } = useCurrentVenue()
  const [wizardOpen, setWizardOpen] = useState(false)

  const {
    data: connections,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['financial-connections', venueId],
    queryFn: () => financialConnectionAPI.listConnections(venueId!),
    enabled: !!venueId,
  })

  // Filas REVOKED/ERROR son residuos operativos (intentos fallidos, cuentas
  // desconectadas): no se listan — el dueño solo ve conexiones vivas o accionables.
  const visible = (connections ?? []).filter(c => c.status !== 'REVOKED' && c.status !== 'ERROR')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('section.title')}</CardTitle>
            <CardDescription>{t('section.description')}</CardDescription>
          </div>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('section.connectCta')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {isError && <p className="text-sm text-destructive">{t('section.loadError')}</p>}
        {!isLoading && !isError && visible.length === 0 && <p className="text-sm text-muted-foreground">{t('section.empty')}</p>}
        {visible.map(c => (
          <ConnectionCard key={c.id} venueId={venueId!} connection={c} onReconnect={() => setWizardOpen(true)} />
        ))}
      </CardContent>
      {venueId && <BankConnectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} venueId={venueId} />}
    </Card>
  )
}
```

- [ ] **Step 2: Insertarla en `Integrations.tsx`**

Import (junto a los demás imports):

```tsx
import { BankAccountsSection } from './components/BankAccountsSection'
import { PermissionGate } from '@/components/PermissionGate'
```

Render: dentro del JSX principal, DESPUÉS de la Card de Google Business Profile (la que abre en la línea ~229) y ANTES de `<CryptoConfigSection />` (~297), agregar:

```tsx
<PermissionGate permission="financialConnections:manage">
  <BankAccountsSection />
</PermissionGate>
```

(Verificar que `src/pages/Venue/Edit/components/` exista; si el directorio no existe, crearlo. Si otras secciones de esa página viven en otro directorio de components, seguir ESA convención y ajustar el import.)

- [ ] **Step 3: Verificar typecheck + build**

Run: `npx tsc --noEmit` → exit 0. Run: `npx vite build` → success (o `npm run build` si el script agrega pasos).

- [ ] **Step 4: Smoke visual (dev)**

Con backend (`localhost:3000`) y `npm run dev` corriendo: login `owner@owner.com`/`owner` → venue Mobanq → Editar sucursal → Integraciones. Esperado: aparece la Card "Cuentas de banco" con estado vacío + botón "Conectar banco"; el wizard abre y lista "Proveedor bancario externo" (del catálogo seed). Login como `admin@admin.com`/`admin`: la sección NO aparece. NO completar una conexión real (requiere TOTP del usuario) — eso es de la verificación final (Task 6).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Venue/Edit/components/BankAccountsSection.tsx src/pages/Venue/Edit/Integrations.tsx
git commit -m "feat(financial-connections): Cuentas de banco section in venue Integrations (OWNER-only)"
```

---

### Task 5: Reapuntar superadmin al modelo nuevo (limpiar V1 stale)

**Files:**
- Modify (primero RESETEAR a HEAD, ver Step 1): `src/pages/Superadmin/components/AggregatorDetailSheet.tsx`, `src/services/aggregator.service.ts`, `src/services/paymentProvider.service.ts`

**Interfaces:**
- Consumes: el endpoint superadmin existente `GET /api/v1/dashboard/superadmin/merchant-accounts/:id/balance` → `{ success, data: { amount, currency, syncedAt, state } }` (mismo shape `AccountBalance` de Task 1 — importar el tipo desde `@/services/financialConnection.service`, no duplicarlo). El detalle de aggregator (`GET .../superadmin/aggregators/:id`) ahora incluye por merchant: `financialAccount: { id, label, lastBalance, balanceState, connection: { provider: { code, name } } } | null`.
- Produces: `AggregatorDetailSheet` muestra saldo bancario de solo lectura por merchant; sin UI de configuración de "balance provider" (eso ya no existe — el ligado lo hace el OWNER al conectar, o superadmin por API en el futuro).

**Contexto crítico:** estos 3 archivos tienen ~222 líneas de cambios SIN COMMITEAR de la era V1 (apuntan a `balanceProviderId`/`balanceProviderAccountId`, campos que el backend eliminó — hoy ese formulario guarda en silencio sin efecto). Ese WIP es de esta misma iniciativa (superseded), NO de otro desarrollador: es seguro descartarlo.

- [ ] **Step 1: Descartar el WIP V1 (SOLO estos 3 archivos, verificar antes)**

```bash
git diff --stat src/pages/Superadmin/components/AggregatorDetailSheet.tsx src/services/aggregator.service.ts src/services/paymentProvider.service.ts
# Confirmar que el diff es el V1 stale (referencias a balanceProviderId). Luego:
git checkout -- src/pages/Superadmin/components/AggregatorDetailSheet.tsx src/services/aggregator.service.ts src/services/paymentProvider.service.ts
git status --short   # esos 3 ya no deben aparecer
```

- [ ] **Step 2: Actualizar el tipo del merchant en `aggregator.service.ts`**

Localizar la interface del merchant dentro del detalle del aggregator (en el archivo a nivel HEAD) y agregarle el campo que el backend ya envía:

```ts
export interface AggregatorMerchantFinancialAccount {
  id: string
  label: string | null
  lastBalance: number | null
  balanceState: 'OK' | 'ERROR' | 'UNKNOWN'
  connection: { provider: { code: string; name: string } }
}

// dentro de la interface del merchant del aggregator:
financialAccount?: AggregatorMerchantFinancialAccount | null
```

- [ ] **Step 3: BalanceCell V2 en `AggregatorDetailSheet.tsx`**

En la fila de cada merchant del sheet, agregar una celda/bloque de saldo:

```tsx
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import api from '@/api'
import { Currency } from '@/utils/currency'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AccountBalance } from '@/services/financialConnection.service'

/**
 * Saldo bancario del merchant vía su FinancialAccount ligada.
 * Solo-lectura: el ligado lo hace el OWNER del venue al conectar su banco
 * (Integraciones); si no hay cuenta ligada se muestra el aviso.
 */
function MerchantBankBalance({ merchantId, hasLinkedAccount }: { merchantId: string; hasLinkedAccount: boolean }) {
  const { data, isFetching, refetch, isError } = useQuery({
    queryKey: ['superadmin-merchant-balance', merchantId],
    queryFn: async (): Promise<AccountBalance> => {
      const r = await api.get(`/api/v1/dashboard/superadmin/merchant-accounts/${merchantId}/balance`)
      return r.data.data
    },
    enabled: false, // saldo bajo demanda: cada consulta pega al banco real
    retry: false,
  })

  if (!hasLinkedAccount) {
    return <span className="text-xs text-muted-foreground">Sin banco conectado — el dueño lo conecta en Integraciones</span>
  }
  return (
    <div className="flex items-center gap-2">
      {data && (data.state === 'OK' && data.amount != null ? (
        <span className="font-medium tabular-nums">{Currency(data.amount)}</span>
      ) : (
        <Badge variant="destructive">Sin saldo</Badge>
      ))}
      {isError && <Badge variant="destructive">Error</Badge>}
      <Button variant="ghost" size="icon" aria-label="Consultar saldo" disabled={isFetching} onClick={() => refetch()}>
        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  )
}
```

Uso en la fila del merchant (donde el sheet ya itera `merchants`): `<MerchantBankBalance merchantId={m.id} hasLinkedAccount={!!m.financialAccount} />`, y si `m.financialAccount` existe, mostrar junto el nombre del banco (`m.financialAccount.connection.provider.name`) y el último saldo conocido (`m.financialAccount.lastBalance != null ? Currency(m.financialAccount.lastBalance) : '—'`). Superadmin no usa i18n en este sheet hoy (verificarlo al leer el archivo a nivel HEAD); seguir la convención existente del archivo (si el sheet SÍ usa `useTranslation`, mover estos strings al namespace que ya use).

- [ ] **Step 4: `paymentProvider.service.ts`**

A nivel HEAD este archivo NO tiene los helpers V1 (se descartaron en Step 1). Verificar con `grep -n "balanceProvider" src/services/paymentProvider.service.ts` → sin resultados. No agregar nada.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` → exit 0. `grep -rn "balanceProviderId\|balanceProviderAccountId\|balance-providers" src/` → CERO resultados en `src/`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Superadmin/components/AggregatorDetailSheet.tsx src/services/aggregator.service.ts
git commit -m "refactor(superadmin): repoint merchant bank balance to financial-connections model, drop stale V1 provider-config UI"
```

---

### Task 6: Verificación integral

**Files:** ninguno nuevo (solo correcciones que surjan).

- [ ] **Step 1: Suite completa**

Run: `npx vitest run` → todos los tests pasan (incluidos los 2 nuevos archivos). Run: `npx tsc --noEmit` → exit 0. Run: `npm run build` → success.

- [ ] **Step 2: Smoke E2E en dev (checklist para el controlador humano/agente con browser)**

Backend `localhost:3000` + frontend `localhost:5173`:
1. `owner@owner.com`/`owner` → Mobanq → Integraciones: la sección aparece; vacío + CTA.
2. Wizard: catálogo lista el proveedor del seed; credenciales inválidas → error inline en español del backend ("Este usuario no tiene una cuenta."), sin crash; el retry NO duplica secciones.
3. `admin@admin.com` → la sección NO se renderiza (PermissionGate) y la API devolvería 403 si se llamara directo.
4. Flujo completo con credenciales reales + TOTP: SOLO si el operador humano provee un código en vivo (caduca <1 min) — conecta, ve saldo real, refresca saldo, desconecta. Si no hay código disponible, marcar este punto como "pendiente de humano" en el reporte, no simularlo.
5. Superadmin: abrir un aggregator → merchants sin cuenta ligada muestran el aviso; sin errores de consola.

- [ ] **Step 3: Commit final (si hubo correcciones) y reporte**

```bash
git add <solo archivos corregidos>
git commit -m "fix(financial-connections): verification pass corrections"
```

Reportar: resultados de suite/typecheck/build + checklist E2E punto por punto (OK / pendiente-de-humano / falla).

---

## Self-Review (hecho al escribir el plan)

- **Cobertura:** catálogo→wizard→saldo→desconectar (Tasks 1-4), permiso OWNER (Task 4), superadmin V2 + limpieza V1 (Task 5), i18n ×3 (Task 2), verificación (Task 6). El `merchantAccountId` de select-account queda explícitamente fuera de alcance (Global Constraints).
- **Placeholders:** ninguno — todo step con código lo trae completo; los dos puntos donde el implementador debe verificar contra el repo real (props de FullScreenModal, ubicación exacta de components de la página) están señalados con la referencia canónica a seguir.
- **Consistencia de tipos:** `financialConnectionAPI` y sus tipos se definen en Task 1 y se consumen con los mismos nombres en Tasks 3-5; `AccountBalance` se reusa en Task 5 (import, no duplicado); `stepForStatus`/`WizardStep` definidos en Task 3 y usados solo ahí.
