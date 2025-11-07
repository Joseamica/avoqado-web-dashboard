# Changelog - Avoqado Web Dashboard

All notable changes to the web dashboard frontend will be documented in this file.

## [Unreleased]

### Added

#### Merchant Account Deletion UX Improvements (2025-01-06)
- **src/pages/Superadmin/MerchantAccounts.tsx** (lines 85-111, 197-260): Enhanced merchant account deletion handling
  - Added toggle mutation for activating/deactivating accounts
  - Improved error handling to display specific backend error messages
  - Added tooltips to explain action availability
  - Disabled delete button when account is in use (cost structures or venue configs)
  - Added toggle button with visual status indicator (green/muted)
  - Added venue configs count column to table
  - Shows detailed usage information in tooltip ("In use by X cost structure(s), Y venue config(s)")

- **src/services/paymentProvider.service.ts** (lines 38-41): Updated MerchantAccount type
  - Added `venueConfigs` count to `_count` interface

- **src/components/ui/tooltip.tsx**: Imported Radix UI Tooltip components
  - TooltipProvider, Tooltip, TooltipTrigger, TooltipContent

- **.github/workflows/ci-cd.yml** (lines 124, 211, 298): Added Stripe publishable key to all environments
  - Added `VITE_STRIPE_PUBLISHABLE_KEY` to demo, staging, and production builds
  - Fixes Stripe initialization error on deployed environments

#### Activation Code Feature (2025-01-03)
- **src/services/tpv.service.ts** (lines 21-30): Added `generateActivationCode` API service
  - POST endpoint to `/api/v1/dashboard/venues/{venueId}/tpv/{terminalId}/activation-code`
  - Returns activation code with expiration data

- **src/locales/en/tpv.json** (lines 13, 52-53, 150-169): Added English translations for activation feature
  - `actions.generateCode`: "Generate Activation Code"
  - `status.activated`: "Activated"
  - `status.notActivated`: "Not Activated"
  - Complete `activation` namespace with dialog translations, instructions, and messages

- **src/locales/es/tpv.json** (lines 13, 52-53, 150-169): Added Spanish translations for activation feature
  - `actions.generateCode`: "Generar Código de Activación"
  - `status.activated`: "Activado"
  - `status.notActivated`: "Sin Activar"
  - Complete `activation` namespace with dialog translations, instructions, and messages

- **src/pages/Tpv/ActivationCodeDialog.tsx** (NEW FILE - 127 lines): Created activation code dialog component
  - Large, copyable activation code display (text-3xl, monospace font)
  - Copy to clipboard with visual feedback (Check/Copy icon toggle)
  - Expiration date display with format (using date-fns)
  - Days until expiry badge
  - Step-by-step activation instructions with serial number interpolation
  - Toast notifications for copy success/error
  - Responsive dialog layout with muted card background

- **src/pages/Tpv/TpvId.tsx** (lines 25, 45-46, 90-97, 277-305, 861-871, 924-929): Integrated activation code generation
  - Added Key icon import from lucide-react
  - Added imports for ActivationCodeDialog component and generateActivationCode service
  - Added state management for activation dialog (open/close, activation data)
  - Added `generateActivationCodeMutation` with success/error handling
  - Added "Generate Activation Code" button in Quick Actions section (PermissionGate: tpv:update)
  - Button shows loading state during API call
  - ActivationCodeDialog component integration at end of component

- **src/pages/Tpv/Tpvs.tsx** (lines 140-183): Added activation status badge to terminal list
  - Displays "Activated" (green) or "Not Activated" (amber) badge next to operational status
  - Uses `activatedAt` field from API response to determine activation status
  - Styled with theme-aware colors (emerald-50/700 for activated, amber-50/700 for not activated)
  - Small text size (text-xs) for secondary importance

### Technical Details
- All user-facing text uses i18n translations (mandatory per CLAUDE.md)
- Components follow Radix UI + Tailwind CSS pattern
- Mutation uses TanStack Query for state management
- Permission-gated with "tpv:update" permission
- Theme-aware colors (no hardcoded grays)
- Clipboard API for modern copy functionality
- Toast notifications for user feedback
