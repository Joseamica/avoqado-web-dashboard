/**
 * `/plan-tier` para las pruebas del conector Shopify, con el contrato REAL del dashboard (features.service.ts:
 * `accessSchemaVersion: 1` exige `accessObservedAt` ISO y `grantedFeatureCodes`). La comparten el E2E de Shopify (por
 * `e2e/fixtures/shopify-plan-tier.ts`, que la re-exporta) y `ShopifyIntegration.test.tsx`, que la pasa por
 * `parseVenuePlanTierInfo`: si el contrato cambia, truena la unitaria.
 *
 * Vive en `src/` y no en `e2e/` porque `tsconfig.app.json` es `composite` con `include: ["src"]`: un archivo de `src` que importa
 * uno de `e2e/` rompe `tsc -b` con TS6307. El E2E sí puede importar desde `src/` (como `class-session-mocks.ts`).
 */
export const planTierShopify = (grantedFeatureCodes: string[]) => ({
  tier: 'PREMIUM',
  grandfathered: false,
  exempt: false,
  accessSchemaVersion: 1,
  accessObservedAt: '2026-10-08T12:00:00.000Z',
  commercialPlanTier: 'PREMIUM',
  grantedFeatureCodes,
})
